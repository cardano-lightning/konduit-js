import type { Json } from "@konduit/codec/json";
import type { JsonCodec, JsonAsyncCodec, JsonError } from "@konduit/codec/json/codecs";
import { ResultAsync, type Result } from "neverthrow";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import * as asyncCodec from "@konduit/codec/async";
import { Address, AddressBech32, json2LovelaceCodec, Lovelace, Network, NetworkMagicNumber, TxHash } from "../cardano";
import type { Mnemonic, SKey, VKey } from "@konduit/cardano-keys";
import { generateMnemonic, KeyIndex, KeyRole, RootPrivateKey, WalletIndex } from "@konduit/cardano-keys";
import { NonNegativeInt } from "@konduit/codec/integers/smallish";
import { Milliseconds, type Seconds } from "../time/duration";
import type { TransactionReadyForSigning } from "../../wasm/konduit_wasm";
import { json2RootPrivateKeyCodec } from "../cardano/codecs";
import { Connector } from "../cardano/connector";
import { hoistToResultAsync, resultAsyncToPromise } from "../neverthrow";
import { rmap, mkIdentityCodec } from "@konduit/codec";
import { json2ValidDateCodec, ValidDate } from "../time/absolute";

type WalletEvent<T> = CustomEvent<T>;

export type WalletEvents = {
  "balance-changed": { newBalance: Lovelace }
  "balance-update-failed": { error: JsonError };
  "tx-submitted": { txHash: TxHash, context?: Json };
};

// We separate this tiny interface so we can plug in quickly not only cardano-connector
// but also blockfrost or mock connectors for testing.
export type ChainConnectorBase = {
  getBalance: (vKey: VKey) => Promise<Result<Lovelace, JsonError>>;
  networkMagicNumber: NetworkMagicNumber;
  signAndSubmit: (tx: TransactionReadyForSigning, sKey: SKey) => Promise<Result<TxHash, JsonError>>;
};

export type SuccessfulFetch = {
  lovelace: Lovelace;
  fetched: ValidDate;
};

export type FailedFetch = {
  error: JsonError;
  fetched: ValidDate;
  previousSuccessfulFetch: SuccessfulFetch | null;
};

export type BalanceFetch =
  | SuccessfulFetch
  | FailedFetch;

export const json2BalanceFetchCodec: JsonCodec<BalanceFetch> = (() => {
  let json2SuccessfulFetchCodec: JsonCodec<SuccessfulFetch> = jsonCodecs.objectOf({
    lovelace: json2LovelaceCodec,
    fetched: json2ValidDateCodec,
  });
  let json2FailedFetchCodec: JsonCodec<FailedFetch> = jsonCodecs.objectOf({
    error: mkIdentityCodec(),
    fetched: json2ValidDateCodec,
    previousSuccessfulFetch: jsonCodecs.nullable(json2SuccessfulFetchCodec),
  });
  return jsonCodecs.altJsonCodecs(
    json2SuccessfulFetchCodec,
    json2FailedFetchCodec,
    (serSuccess, serFailed) => (value: BalanceFetch) => {
      if ("lovelace" in value) {
        return serSuccess(value);
      } else {
        return serFailed(value);
      }
    }
  );
})();

export class BalanceInfo {
  readonly lastFetch: BalanceFetch;

  constructor(lastFetch: BalanceFetch) {
    this.lastFetch = lastFetch;
  }

  public get lovelace(): Lovelace | null {
    if ("lovelace" in this.lastFetch) {
      return this.lastFetch.lovelace;
    } if ("previousSuccessfulFetch" in this.lastFetch && this.lastFetch.previousSuccessfulFetch) {
      return this.lastFetch.previousSuccessfulFetch.lovelace;
    }
    return null;
  }

  public static mkNew(result: Lovelace | JsonError): BalanceInfo {
    const now = ValidDate.now();
    if (typeof result === "bigint") {
      return new BalanceInfo({
        lovelace: result as Lovelace,
        fetched: now,
      });
    } else {
      return new BalanceInfo({
        error: result,
        fetched: now,
        previousSuccessfulFetch: null,
      });
    }
  }

  public mkSuccessor(result: Lovelace | JsonError): BalanceInfo {
    const now = ValidDate.now();
    if (typeof result === "bigint") {
      return new BalanceInfo({
        lovelace: result as Lovelace,
        fetched: now,
      });
    } else {
      const previousSuccessfulFetch = "lovelace" in this.lastFetch
        ? {
            lovelace: this.lastFetch.lovelace,
            fetched: this.lastFetch.fetched,
          }
        : ("previousSuccessfulFetch" in this.lastFetch
            ? this.lastFetch.previousSuccessfulFetch
            : null);
      return new BalanceInfo({
        error: result,
        fetched: now,
        previousSuccessfulFetch,
      });
    }
  }
};

export const json2BalanceInfoCodec: JsonCodec<BalanceInfo> = rmap(
  json2BalanceFetchCodec,
  (balanceFetch: BalanceFetch) => new BalanceInfo(balanceFetch),
  (balanceInfo: BalanceInfo) => balanceInfo.lastFetch,
);


/* A simple, single-address, no staking wallet implementation */
export class Wallet<ChainConnector extends ChainConnectorBase> {
  public readonly networkMagicNumber: NetworkMagicNumber;
  public readonly chainConnector: ChainConnector;

  private _balanceInfo: BalanceInfo | null = null;
  private rootPrivateKey: RootPrivateKey;
  private addrPath = {
    walletIdx: WalletIndex.fromSmallInt(0),
    role: KeyRole.External,
    addressIdx: KeyIndex.fromSmallInt(0),
  }
  // Polling state
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private pollingInterval = Milliseconds.fromNonNegativeInt(NonNegativeInt.fromSmallNumber(0));
  // Event handling
  private readonly eventTarget = new EventTarget();

  constructor(rootPrivateKey: RootPrivateKey, chainConnector: ChainConnector, balanceInfo?: BalanceInfo) {
    this.rootPrivateKey = rootPrivateKey;
    this.chainConnector = chainConnector;
    this.networkMagicNumber = chainConnector.networkMagicNumber;
    this._balanceInfo = balanceInfo || null;
  }

  // Restore from mnemonic
  static async restore<C extends ChainConnectorBase>(connector: C, mnemonic: Mnemonic, password?: Uint8Array): Promise<Wallet<C>> {
    const rootPrivateKey = await RootPrivateKey.fromMnemonic(mnemonic, password);
    return Promise.resolve(new Wallet(rootPrivateKey, connector));
  }

  static async create<C extends ChainConnectorBase>(connector: C, mnemonicPassword?: Uint8Array): Promise<{ wallet: Wallet<C>; mnemonic: Mnemonic }> {
    const mnemonic = generateMnemonic("24-words");
    const rootPrivateKey = await RootPrivateKey.fromMnemonic(mnemonic, mnemonicPassword);
    const wallet = new Wallet(rootPrivateKey, connector);
    return Promise.resolve({ wallet, mnemonic });
  }

  private get sKey() {
    return this.rootPrivateKey.deriveSKey(this.addrPath.walletIdx, this.addrPath.role, this.addrPath.addressIdx);
  }

  public get vKey(): VKey {
    return this.sKey.toVKey();
  }

  public get network(): Network {
    return Network.fromNetworkMagicNumber(this.networkMagicNumber);
  }

  public get address(): Address {
    return Address.fromVKeys(this.network, this.vKey);
  }

  public get addressBech32(): AddressBech32 {
    return AddressBech32.fromAddress(this.address);
  }

  public get balance(): Lovelace | null {
    return this._balanceInfo && this._balanceInfo.lovelace;
  }

  public get balanceInfo(): BalanceInfo | null {
    return this._balanceInfo;
  }

  private emit<K extends keyof WalletEvents>(event: K, payload: WalletEvents[K]) {
    this.eventTarget.dispatchEvent(
      new CustomEvent<WalletEvents[K]>(event, { detail: payload })
    );
  }

  subscribe<K extends keyof WalletEvents>(
    event: K,
    listener: (payload: WalletEvents[K]) => void
  ): () => void {  // returns unsubscribe function — very convenient!
    const handler = (e: Event) => {
      const ce = e as WalletEvent<WalletEvents[K]>;
      listener(ce.detail);
    };

    this.eventTarget.addEventListener(event, handler as EventListener);

    // Return cleanup function
    return () => {
      this.eventTarget.removeEventListener(event, handler as EventListener);
    };
  }

  private async poll() {
    const result = await this.chainConnector.getBalance(this.vKey);
    const resultFlattened = result.match((lovelace) => lovelace, (error) => error);
    result.match(
      (lovelace) => {
        if(this.balance !== lovelace)
          this._balanceInfo = this._balanceInfo? this._balanceInfo.mkSuccessor(resultFlattened) : BalanceInfo.mkNew(resultFlattened);
          this.emit('balance-changed', { newBalance: lovelace });
      },
      (error) => {
        this.emit('balance-update-failed', { error });
      }
    );
  }

  // (Re)start polling
  public async startPolling(interval: Seconds) {
    let intervalMs = Milliseconds.fromSeconds(interval);
    if (this.pollingTimer) {
      if(this.pollingInterval !== intervalMs) {
        clearInterval(this.pollingTimer);
      } else {
        return;
      }
    }
    this.pollingInterval = intervalMs;
    this.pollingTimer = setInterval(() =>
      this.poll(),
      Number(intervalMs)
    );
  }

  public stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  public async signAndSubmit(tx: TransactionReadyForSigning, context?: Json): Promise<Result<TxHash, JsonError>> {
    const result = await this.chainConnector.signAndSubmit(tx, this.sKey);
    return result.map(txHash => {
      this.emit("tx-submitted", context ? { txHash, context } : { txHash });
      return txHash;
    });
  }
}

type WalletRecord = {
  balance_info: BalanceInfo | null;
  root_private_key: RootPrivateKey;
};

const json2WalletRecordCodec: JsonCodec<WalletRecord> = jsonCodecs.objectOf({
  balance_info: jsonCodecs.nullable(json2BalanceInfoCodec),
  root_private_key: json2RootPrivateKeyCodec,
});


export namespace CardanoConnectorWallet {
  // We additionally store the url
  export type ChainConnector = ChainConnectorBase & {
    readonly backendUrl: string;
  };

  const createConnector = async (backendUrl: string): Promise<Result<ChainConnector, JsonError>> => {
    const result = await Connector.new(backendUrl);
    return result.map(
      (connector: Connector) => {
        return {
          backendUrl,
          getBalance: async (vKey: VKey) => connector.balance(vKey),
          signAndSubmit: async (tx: TransactionReadyForSigning, sKey: SKey) => connector.signAndSubmit(tx, sKey),
          networkMagicNumber: connector.networkMagicNumber,
        };
      }
    );
  }

  export async function create(
    backendUrl: string,
    mnemonicPassword?: Uint8Array
  ): Promise<Result<{ wallet: Wallet<ChainConnector>; mnemonic: Mnemonic }, JsonError>> {
    return resultAsyncToPromise(hoistToResultAsync(createConnector(backendUrl)).map(async (connector) => {
      return Wallet.create(connector, mnemonicPassword);
    }));
  }

  export async function restore(
    backendUrl: string,
    mnemonic: Mnemonic,
    password?: Uint8Array
  ): Promise<Result<Wallet<ChainConnector>, JsonError>> {
    return resultAsyncToPromise(hoistToResultAsync(createConnector(backendUrl)).map(async (connector) => {
      return Wallet.restore(connector, mnemonic, password);
    }));
  }

  type ChainConnectorRecord = {
    backend_url: string;
    type: "CardanoConnectorWallet.ChainConnector";
  };

  const chainConnectorRecordCodec = jsonCodecs.objectOf({
    backend_url: jsonCodecs.json2StringCodec,
    type: jsonCodecs.constant("CardanoConnectorWallet.ChainConnector"),
  });

  type FullWalletRecord = {
    connector: ChainConnectorRecord;
    wallet: WalletRecord;
  };

  export const json2WalletAsyncCodec: JsonAsyncCodec<Wallet<ChainConnector>> = (() => {
    const json2FullWalletRecordCodec: JsonAsyncCodec<FullWalletRecord> = asyncCodec.fromSync(jsonCodecs.objectOf({
        connector: chainConnectorRecordCodec,
        wallet: json2WalletRecordCodec,
    }));
    const fullWalletRecord2WalletAsyncCodec: asyncCodec.AsyncCodec<FullWalletRecord, Wallet<ChainConnector>, JsonError> = {
      deserialise: ({ wallet: w, connector: c }): ResultAsync<Wallet<ChainConnector>, JsonError> => {
        return hoistToResultAsync(createConnector(c.backend_url)).map((connector) => {
          return new Wallet(
            w.root_private_key,
            connector,
            w.balance_info || undefined
          );
        });
      },
      serialise: (wallet: Wallet<ChainConnector>) => {
        return {
          connector: {
            backend_url: wallet.chainConnector.backendUrl,
            type: "CardanoConnectorWallet.ChainConnector" as const,
          },
          wallet: {
            balance_info: wallet.balanceInfo,
            root_private_key: wallet["rootPrivateKey"],
          },
        };
      },
    };
    return asyncCodec.pipe(
      json2FullWalletRecordCodec,
      fullWalletRecord2WalletAsyncCodec,
    );
  })();
}
