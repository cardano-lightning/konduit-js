import type { Json } from "@konduit/codec/json";
import type { JsonCodec, JsonError } from "@konduit/codec/json/codecs";
import { err, ok, type Result } from "neverthrow";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import * as jsonAsyncCodecs from "@konduit/codec/json/async";
import * as asyncCodec from "@konduit/codec/async";
import { Address, AddressBech32, json2LovelaceCodec, Lovelace, Network, NetworkMagicNumber, PubKeyHash, TxHash } from "../cardano";
import type { Mnemonic, Ed25519VerificationKey } from "@konduit/cardano-keys";
import { generateMnemonic, Ed25519PrivateKey } from "@konduit/cardano-keys";
import { NonNegativeInt } from "@konduit/codec/integers/smallish";
import { Milliseconds, type Seconds } from "../time/duration";
import { json2Ed25519PrivateKeyCodec } from "../cardano/keys";
import { Connector, type Transaction } from "../cardano/connector";
import { hoistToResultAsync, resultAsyncToPromise } from "../neverthrow";
import { rmap, mkIdentityCodec } from "@konduit/codec";
import { json2ValidDateCodec, ValidDate } from "../time/absolute";
import type { JsonAsyncCodec } from "@konduit/codec/json/async";
import { mkBlockfrostClient } from "../adaptorClient";

type WalletEvent<T> = CustomEvent<T>;

export type WalletEvents<WalletBackend> = {
  "backend-changed": { oldBackend: WalletBackend; newBackend: WalletBackend };
  "balance-changed": { newBalance: Lovelace };
  // Regardless of the change
  "balance-fetched": { currentBalance: Lovelace };
  "balance-update-failed": { error: JsonError };
  "tx-signed": { tx: Transaction, context?: Json };
  "tx-submitted": { txHash: TxHash, context?: Json };
};

// We separate this tiny interface so we can plug in quickly not only cardano-connector
// but also blockfrost or mock connectors for testing.
export type WalletBackendBase = {
  getBalance: (vKey: Ed25519VerificationKey) => Promise<Result<Lovelace, JsonError>>;
  networkMagicNumber: NetworkMagicNumber;
  submit: (tx: Transaction) => Promise<Result<TxHash, JsonError>>;
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

// TODO: Refactor and xtract BalanceFetch
// into something like `Cyclical<response>`
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
  // This is publicly accessible so we can serialise the state.
  public readonly privateKey: Ed25519PrivateKey;

  private _subscriptionCounter: number = 0;
  private _balanceInfo: BalanceInfo | null = null;
  private _walletBackend: WalletBackend;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private pollingInterval = Milliseconds.fromNonNegativeInt(NonNegativeInt.fromSmallNumber(0));

  private readonly eventTarget = new EventTarget();

  constructor(privateKey: Ed25519PrivateKey, walletBackend: WalletBackend, balanceInfo?: BalanceInfo) {
    this.privateKey = privateKey;
    this._walletBackend = walletBackend;
    this.networkMagicNumber = walletBackend.networkMagicNumber;
    this._balanceInfo = balanceInfo || null;
  }

  // Restore from mnemonic
  static async restore<C extends WalletBackendBase>(backend: C, mnemonic: Mnemonic): Promise<Wallet<C>> {
    const privateKey = Ed25519PrivateKey.fromMnemonic(mnemonic);
    return Promise.resolve(new Wallet(privateKey, backend));
  }

  static async create<C extends WalletBackendBase>(backend: C): Promise<{ wallet: Wallet<C>; mnemonic: Mnemonic }> {
    const mnemonic = generateMnemonic("24-words");
    const privateKey = Ed25519PrivateKey.fromMnemonic(mnemonic);
    const wallet = new Wallet(privateKey, backend);
    return { wallet, mnemonic };
  }

  public switchBackend(newBackend: WalletBackend): Result<null, string> {
    if (newBackend.networkMagicNumber !== this.networkMagicNumber) {
      return err("Cannot switch to a backend with a different network magic number");
    }
    this._walletBackend = newBackend;
    this.emit("backend-changed", { oldBackend: this._walletBackend, newBackend });
    return ok(null);
  }

  public get walletBackend(): WalletBackend {
    return this._walletBackend;
  }

  private get sKey() {
    return this.privateKey.toSigningKey();
  }

  public get vKey(): Ed25519VerificationKey {
    return this.sKey.toVerificationKey();
  }

  public get network(): Network {
    return Network.fromNetworkMagicNumber(this.networkMagicNumber);
  }

  public get address(): Address {
    return Address.fromEd25519VerificationKeys(this.network, this.vKey);
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
    const resultFlattened = result.match((info) => info, (failure) => failure);
    let origBalance = this.balance;
    this._balanceInfo = this._balanceInfo? this._balanceInfo.mkSuccessor(resultFlattened) : BalanceInfo.mkNew(resultFlattened);
    result.match(
      (lovelace) => {
        this.emit('balance-fetched', { currentBalance: lovelace });
        if(origBalance !== lovelace)
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
    await this.poll();
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

  public async sign(tx: Transaction, context?: Json): Promise<Result<Transaction, JsonError>> {
    return tx.sign(this.privateKey).map((signedTx) => {
      this.emit("tx-signed", context ? { tx: signedTx, context } : { tx: signedTx });
      return signedTx;
    });
  }

  public async submit(tx: Transaction, context?: Json): Promise<Result<TxHash, JsonError>> {
    const result = await this.walletBackend.submit(tx);
    return result.map(txHash => {
      this.emit("tx-submitted", context ? { txHash, context } : { txHash });
      return txHash;
    });
  }
}

const mkWalletAsyncCodec = <Backend extends WalletBackendBase>(
  json2BackendAsyncCodec: JsonAsyncCodec<Backend>,
): JsonAsyncCodec<Wallet<Backend>> => {
  const json2WalletStateRecordCodec:JsonCodec<{ balance_info: BalanceInfo | null, private_key: Ed25519PrivateKey }> = jsonCodecs.objectOf({
    balance_info: jsonCodecs.nullable(json2BalanceInfoCodec),
    private_key: json2Ed25519PrivateKeyCodec,
  });
  return asyncCodec.rmap(
    jsonAsyncCodecs.objectOf({
      backend: json2BackendAsyncCodec,
      state: asyncCodec.fromSync(json2WalletStateRecordCodec),
    }),
    async (r) => {
      return new Wallet(r.state.private_key, r.backend, r.state.balance_info || undefined)
    },
    (wallet) => {
      return {
        backend: wallet.walletBackend,
        state: {
          balance_info: wallet.balanceInfo,
          private_key: wallet.privateKey
        }
      };
    }
  );
}


export type CardanoConnectorWallet = Wallet<CardanoConnectorWallet.WalletBackend>;
export namespace CardanoConnectorWallet {
  // We additionally store the url
  export type WalletBackend = WalletBackendBase & {
    readonly connector: Connector;
  };

  export const mkWalletBackend = (connector: Connector): WalletBackend => {
    return {
      connector,
      getBalance: async (vKey: Ed25519VerificationKey) => connector.balance(vKey),
      submit: async (tx: Transaction) => {
        // TODO:
        // When we have pure TS implementation of the cardano-connect client
        // then we will be able to remove that _inner lookup completely and
        // just submit the cbor directly.
        const result = await connector.submit(tx._inner);
        result.mapErr((error) => {
          console.debug("Error submitting transaction:", error);
        });
        return result;
      },
      networkMagicNumber: connector.networkMagicNumber,
    };
  }

  export const createBackend = async (backendUrl: string, httpTimeout?: Milliseconds): Promise<Result<WalletBackend, JsonError>> => {
    const result = await Connector.new(backendUrl, httpTimeout);
    return result.map(mkWalletBackend);
  }

  export async function fromPrivateKey(
    connector: string | Connector,
    privateKey: Ed25519PrivateKey,
    balanceInfo?: BalanceInfo
  ): Promise<Result<Wallet<CardanoConnectorWallet.WalletBackend>, JsonError>> {
    if(connector instanceof Connector) {
      const walletBackend =  mkWalletBackend(connector);
      return ok(new Wallet(privateKey, walletBackend, balanceInfo));
    }
    return resultAsyncToPromise(hoistToResultAsync(createBackend(connector)).map(async (backend) => {
      return new Wallet(privateKey, backend, balanceInfo);
    }));
  }

  export async function create(
    connector: string | Connector,
  ): Promise<Result<{ wallet: Wallet<WalletBackend>; mnemonic: Mnemonic }, JsonError>> {
    if(connector instanceof Connector) {
      const walletBackend =  mkWalletBackend(connector);
      return ok(await Wallet.create(walletBackend));
    }
    return resultAsyncToPromise(hoistToResultAsync(createBackend(connector)).map(async (backend) => {
      return Wallet.create(backend);
    }));
  }

  export async function restore(
    connector: string | Connector,
    mnemonic: Mnemonic,
  ): Promise<Result<Wallet<WalletBackend>, JsonError>> {
    if(connector instanceof Connector) {
      const walletBackend =  mkWalletBackend(connector);
      return ok(await Wallet.restore(walletBackend, mnemonic));
    }
    return resultAsyncToPromise(hoistToResultAsync(createBackend(connector)).map(async (connector) => {
      return Wallet.restore(connector, mnemonic);
    }));
  }

  export const json2WalletBackendAsyncCodec: JsonAsyncCodec<WalletBackend> = (asyncCodec.pipe(
    asyncCodec.fromSync(jsonCodecs.objectOf({
      backend_url: jsonCodecs.json2StringCodec,
      type: jsonCodecs.constant("CardanoConnectorWallet.WalletBackend"),
    })), {
      deserialise: async (r) => {
        return createBackend(r.backend_url);
      },
      serialise: (walletBackend: WalletBackend) => {
        return {
          backend_url: walletBackend.connector.backendUrl,
          type: "CardanoConnectorWallet.WalletBackend" as const,
        };
      }
    }
  ));

  export const json2WalletAsyncCodec: JsonAsyncCodec<Wallet<WalletBackend>> =
    mkWalletAsyncCodec(json2WalletBackendAsyncCodec);
}

export type BlockfrostWallet = Wallet<BlockfrostWallet.WalletBackend>;
export namespace BlockfrostWallet {
  export type WalletBackend = WalletBackendBase & {
    readonly projectId: string;
  };

  export const createBackend = (projectId: string): Result<WalletBackend, JsonError> => {
    return mkBlockfrostClient(projectId).map((blockfrostClient) => {
      let network = Network.fromNetworkMagicNumber(blockfrostClient.networkMagicNumber);
      return {
        projectId,
        getBalance: async (vKey: Ed25519VerificationKey) => {
          const pubKeyHash = PubKeyHash.fromPubKey(vKey.key);
          const address: Address = {
            network,
            paymentCredential: {
              type: "PubKeyHash",
              hash: pubKeyHash,
            },
          };
          let addressBech32 = AddressBech32.fromAddress(address);
          return (await blockfrostClient.getAddressInfo(addressBech32)).map(addressInfo => addressInfo.lovelace);
        },
        submit: async (tx: Transaction) => {
          const txCbor = tx.toCbor();
          return blockfrostClient.submitTx(txCbor);
        },
        networkMagicNumber: blockfrostClient.networkMagicNumber,
      } as WalletBackend;
    });
  };

  export async function fromPrivateKey(
    projectId: string,
    privateKey: Ed25519PrivateKey,
    balanceInfo?: BalanceInfo
  ): Promise<Result<Wallet<BlockfrostWallet.WalletBackend>, JsonError>> {
    const backendResult = createBackend(projectId);
    return backendResult.map((backend) => new Wallet(privateKey, backend, balanceInfo));
  }

  export async function create(
    projectId: string,
  ): Promise<Result<{ wallet: Wallet<WalletBackend>; mnemonic: Mnemonic }, JsonError>> {
    const backendResult = createBackend(projectId);
    return backendResult.match(
      (backend) => Wallet.create(backend).then(res => ok(res)),
      (error) => Promise.resolve(err(error)),
    );
  }

  export const json2WalletBackendAsyncCodec: JsonAsyncCodec<WalletBackend> = (asyncCodec.pipe(
    asyncCodec.fromSync(jsonCodecs.objectOf({
      project_id: jsonCodecs.json2StringCodec,
      type: jsonCodecs.constant("BlockfrostWallet.WalletBackend"),
    })), {
      deserialise: async (r) => {
        return createBackend(r.project_id);
      },
      serialise: (walletBackend: WalletBackend) => {
        return {
          project_id: walletBackend.projectId,
          type: "BlockfrostWallet.WalletBackend" as const,
        };
      }
    }
  ));

  export const json2WalletAsyncCodec: JsonAsyncCodec<Wallet<WalletBackend>>
    = mkWalletAsyncCodec(json2WalletBackendAsyncCodec);
}

export type AnyWalletBackend =
  | CardanoConnectorWallet.WalletBackend
  | BlockfrostWallet.WalletBackend;

export const isCardanoConnectorBackend = (backend: AnyWalletBackend): backend is CardanoConnectorWallet.WalletBackend => {
  return "connector" in backend;
}

export const isBlockfrostBackend = (backend: AnyWalletBackend): backend is BlockfrostWallet.WalletBackend => {
  return "projectId" in backend;
}

export type AnyWallet =
  | CardanoConnectorWallet
  | BlockfrostWallet

export const isBlockfrostWallet = (wallet: AnyWallet): wallet is BlockfrostWallet => {
  return isBlockfrostBackend(wallet.walletBackend);
}

export const isCardanoConnectorWallet = (wallet: AnyWallet): wallet is CardanoConnectorWallet => {
  return isCardanoConnectorBackend(wallet.walletBackend);
}
export const json2AnyWalletBackendAsyncCodec: JsonAsyncCodec<AnyWalletBackend> = asyncCodec.altCodec(
  CardanoConnectorWallet.json2WalletBackendAsyncCodec,
  BlockfrostWallet.json2WalletBackendAsyncCodec,
  (serConnector, serBlockfrost) => (backend: AnyWalletBackend) => {
    if (isCardanoConnectorBackend(backend)) {
      return serConnector(backend);
    }
    return serBlockfrost(backend);
  },
  (...errors: JsonError[]): JsonError => errors
);


export const json2AnyWalletAsyncCodec: JsonAsyncCodec<AnyWallet> = asyncCodec.altCodec(
  CardanoConnectorWallet.json2WalletAsyncCodec,
  BlockfrostWallet.json2WalletAsyncCodec,
  (serConnector, serBlockfrost) => (wallet: AnyWallet) => {
    if (isCardanoConnectorWallet(wallet)) {
      return serConnector(wallet);
   }
    return serBlockfrost(wallet);
  },
  (...errors: JsonError[]): JsonError => errors
);

