import type { Json } from "@konduit/codec/json";
import type { JsonCodec, JsonError } from "@konduit/codec/json/codecs";
import { err, ok, type Result } from "neverthrow";
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
import { JsonAsyncCodec } from "@konduit/codec/json/async";

type WalletEvent<T> = CustomEvent<T>;

export type WalletEvents<WalletBackend> = {
  "backend-changed": { oldBackend: WalletBackend; newBackend: WalletBackend };
  "balance-changed": { newBalance: Lovelace };
  // Regardless of the change
  "balance-fetched": { currentBalance: Lovelace };
  "balance-update-failed": { error: JsonError };
  "tx-submitted": { txHash: TxHash, context?: Json };
};

// We separate this tiny interface so we can plug in quickly not only cardano-connector
// but also blockfrost or mock connectors for testing.
export type WalletBackendBase = {
  getBalance: (vKey: VKey) => Promise<Result<Lovelace, JsonError>>;
  networkMagicNumber: NetworkMagicNumber;
  signAndSubmit: (tx: TransactionReadyForSigning, sKey: SKey) => Promise<Result<TxHash, JsonError>>;
};

export type SuccessfulFetch = {
  lovelace: Lovelace;
  fetchedAt: ValidDate;
};

export type FailedFetch = {
  error: JsonError;
  fetchedAt: ValidDate;
  previousSuccessfulFetch: SuccessfulFetch | null;
};

export type BalanceFetch =
  | SuccessfulFetch
  | FailedFetch;

export const json2BalanceFetchCodec: JsonCodec<BalanceFetch> = (() => {
  let json2SuccessfulFetchCodec: JsonCodec<SuccessfulFetch> = jsonCodecs.objectOf({
    lovelace: json2LovelaceCodec,
    fetchedAt: json2ValidDateCodec,
  });
  let json2FailedFetchCodec: JsonCodec<FailedFetch> = jsonCodecs.objectOf({
    error: mkIdentityCodec(),
    fetchedAt: json2ValidDateCodec,
    previousSuccessfulFetch: jsonCodecs.nullable(json2SuccessfulFetchCodec),
  });
  return jsonCodecs.altJsonCodecs(
    [json2SuccessfulFetchCodec, json2FailedFetchCodec],
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

  public get successfulFetch(): SuccessfulFetch | null {
    if ("lovelace" in this.lastFetch) {
        return this.lastFetch;
    }
    return this.lastFetch.previousSuccessfulFetch;
  }

  public static mkNew(result: Lovelace | JsonError): BalanceInfo {
    const now = ValidDate.now();
    if (typeof result === "bigint") {
      return new BalanceInfo({
        lovelace: result as Lovelace,
        fetchedAt: now,
      });
    } else {
      return new BalanceInfo({
        error: result,
        fetchedAt: now,
        previousSuccessfulFetch: null,
      });
    }
  }

  public mkSuccessor(result: Lovelace | JsonError): BalanceInfo {
    const now = ValidDate.now();
    if (typeof result === "bigint") {
      return new BalanceInfo({
        lovelace: result as Lovelace,
        fetchedAt: now,
      });
    } else {
      const previousSuccessfulFetch = "lovelace" in this.lastFetch
        ? {
            lovelace: this.lastFetch.lovelace,
            fetchedAt: this.lastFetch.fetchedAt,
          }
        : ("previousSuccessfulFetch" in this.lastFetch
            ? this.lastFetch.previousSuccessfulFetch
            : null);
      return new BalanceInfo({
        error: result,
        fetchedAt: now,
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
export class Wallet<WalletBackend extends WalletBackendBase> {
  public readonly networkMagicNumber: NetworkMagicNumber;
  // A memory leak debugging helper
  public readonly subscriptionCounter: number;

  private _subscriptionCounter: number = 0;
  private _balanceInfo: BalanceInfo | null = null;
  private _walletBackend: WalletBackend;
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

  constructor(rootPrivateKey: RootPrivateKey, walletBackend: WalletBackend, balanceInfo?: BalanceInfo) {
    this.rootPrivateKey = rootPrivateKey;
    this._walletBackend = walletBackend;
    this.networkMagicNumber = walletBackend.networkMagicNumber;
    this._balanceInfo = balanceInfo || null;
  }

  // Restore from mnemonic
  static async restore<C extends WalletBackendBase>(backend: C, mnemonic: Mnemonic, password?: Uint8Array): Promise<Wallet<C>> {
    const rootPrivateKey = await RootPrivateKey.fromMnemonic(mnemonic, password);
    return Promise.resolve(new Wallet(rootPrivateKey, backend));
  }

  static async create<C extends WalletBackendBase>(backend: C, mnemonicPassword?: Uint8Array): Promise<{ wallet: Wallet<C>; mnemonic: Mnemonic }> {
    const mnemonic = generateMnemonic("24-words");
    const rootPrivateKey = await RootPrivateKey.fromMnemonic(mnemonic, mnemonicPassword);
    const wallet = new Wallet(rootPrivateKey, backend);
    return { wallet, mnemonic };
  }

  public switchBackend(newBackend: WalletBackend): Result<null, string> {
    if (newBackend.networkMagicNumber !== this.networkMagicNumber) {
      return err("Cannot switch to a backend with a different network magic number");
    }
    this._walletBackend = newBackend;
    this.emit("backend-changed", { oldBackend: this._walletBackend, newBackend });
    return ok(undefined);
  }

  public get walletBackend(): WalletBackend {
    return this._walletBackend;
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

  private emit<K extends keyof WalletEvents<WalletBackend>>(event: K, payload: WalletEvents<WalletBackend>[K]) {
    this.eventTarget.dispatchEvent(
      new CustomEvent<WalletEvents<WalletBackend>[K]>(event, { detail: payload })
    );
  }

  // WARNING! Please do not forget to unsubscribe when you no longer need the events
  // as the listeners will stay in memory otherwise!
  subscribe<K extends keyof WalletEvents<WalletBackend>>(
    event: K,
    listener: (payload: WalletEvents<WalletBackend>[K]) => void
  ): () => void {  // returns unsubscribe function — very convenient!
    const handler = (e: Event) => {
      const ce = e as WalletEvent<WalletEvents<WalletBackend>[K]>;
      listener(ce.detail);
    };

    this.eventTarget.addEventListener(event, handler as EventListener);
    this._subscriptionCounter += 1;

    // Return cleanup function
    return () => {
      this.eventTarget.removeEventListener(event, handler as EventListener);
      this._subscriptionCounter -= 1;
    };
  }

  private async poll() {
    const result = await this.walletBackend.getBalance(this.vKey);
    const resultFlattened = result.match((lovelace) => lovelace, (error) => error);
    this._balanceInfo = this._balanceInfo? this._balanceInfo.mkSuccessor(resultFlattened) : BalanceInfo.mkNew(resultFlattened);
    console.log("Polled balance:", this._balanceInfo);
    result.match(
      (lovelace) => {
        this.emit('balance-fetched', { currentBalance: lovelace });
        if(this.balance !== lovelace)
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
    this.poll();
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

  // WARNING! Please do not forget to stop polling
  // when you no longer need it, as the instance
  // will stay in memory otherwise!
  public stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  public async signAndSubmit(tx: TransactionReadyForSigning, context?: Json): Promise<Result<TxHash, JsonError>> {
    const result = await this.walletBackend.signAndSubmit(tx, this.sKey);
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


export type CardanoConnectorWallet = Wallet<CardanoConnectorWallet.WalletBackend>;
export namespace CardanoConnectorWallet {
  // We additionally store the url
  export type WalletBackend = WalletBackendBase & {
    readonly connector: Connector;
  };

  const mkWalletBackend = (connector: Connector): WalletBackend => {
    return {
      connector,
      getBalance: async (vKey: VKey) => connector.balance(vKey),
      signAndSubmit: async (tx: TransactionReadyForSigning, sKey: SKey) => connector.signAndSubmit(tx, sKey),
      networkMagicNumber: connector.networkMagicNumber,
    };
  }

  export const createBackend = async (backendUrl: string, httpTimeout?: Milliseconds): Promise<Result<WalletBackend, JsonError>> => {
    const result = await Connector.new(backendUrl, httpTimeout);
    return result.map(mkWalletBackend);
  }

  export async function create(
    connector: string | Connector,
    mnemonicPassword?: Uint8Array
  ): Promise<Result<{ wallet: Wallet<WalletBackend>; mnemonic: Mnemonic }, JsonError>> {
    if(connector instanceof Connector) {
      const walletBackend =  mkWalletBackend(connector);
      return ok(await Wallet.create(walletBackend, mnemonicPassword));
    }
    return resultAsyncToPromise(hoistToResultAsync(createBackend(connector)).map(async (connector) => {
      return Wallet.create(connector, mnemonicPassword);
    }));
  }

  export async function restore(
    connector: string | Connector,
    mnemonic: Mnemonic,
    password?: Uint8Array
  ): Promise<Result<Wallet<WalletBackend>, JsonError>> {
    if(connector instanceof Connector) {
      const walletBackend =  mkWalletBackend(connector);
      return ok(await Wallet.restore(walletBackend, mnemonic, password));
    }
    return resultAsyncToPromise(hoistToResultAsync(createBackend(connector)).map(async (connector) => {
      return Wallet.restore(connector, mnemonic, password);
    }));
  }

  type WalletBackendRecord = {
    backend_url: string;
    type: "CardanoConnectorWallet.WalletBackend";
  };

  const walletBackendRecordCodec = jsonCodecs.objectOf({
    backend_url: jsonCodecs.json2StringCodec,
    type: jsonCodecs.constant("CardanoConnectorWallet.WalletBackend"),
  });

  type FullWalletRecord = {
    connector: WalletBackendRecord;
    state: WalletRecord;
  };

  export const json2WalletAsyncCodec: JsonAsyncCodec<Wallet<WalletBackend>> = (() => {
    const json2FullWalletRecordCodec: JsonAsyncCodec<FullWalletRecord> = asyncCodec.fromSync(jsonCodecs.objectOf({
        connector: walletBackendRecordCodec,
        state: json2WalletRecordCodec,
    }));
    const fullWalletRecord2WalletAsyncCodec: asyncCodec.AsyncCodec<FullWalletRecord, Wallet<WalletBackend>, JsonError> = {
      deserialise: async ({ state: w, connector: c }): Promise<Result<Wallet<WalletBackend>, JsonError>> => {
        return resultAsyncToPromise(hoistToResultAsync(createBackend(c.backend_url)).map((connector) => {
          return new Wallet(
            w.root_private_key,
            connector,
            w.balance_info || undefined
          );
        }));
      },
      serialise: (wallet: Wallet<WalletBackend>) => {
        return {
          connector: {
            backend_url: wallet.walletBackend.connector.backendUrl,
            type: "CardanoConnectorWallet.WalletBackend" as const,
          },
          state: {
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
