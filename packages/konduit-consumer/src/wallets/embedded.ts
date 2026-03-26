import type { Json } from "@konduit/codec/json";
import type { JsonCodec, JsonError } from "@konduit/codec/json/codecs";
import { err, ok, type Result } from "neverthrow";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { Address, AddressBech32, Lovelace, Network, PubKeyHash, TransactionUnspentOutput, TxHash } from "../cardano";
import * as codec from "@konduit/codec";
import { NetworkMagicNumber } from "../cardano";
import type { Mnemonic, Ed25519VerificationKey } from "@konduit/cardano-keys";
import { generateMnemonic, Ed25519PrivateKey } from "@konduit/cardano-keys";
import { NonNegativeInt } from "@konduit/codec/integers/smallish";
import { Milliseconds, type Seconds } from "../time/duration";
import { json2Ed25519PrivateKeyCodec } from "../cardano/keys";
import type { Transaction, WasmError } from "../txBuilder";
// import { Connector, type Transaction } from "../cardano/connector";
import { mkIdentityCodec } from "@konduit/codec";
import { json2ValidDateCodec, ValidDate } from "../time/absolute";
import { mkBlockfrostClient } from "../blockfrostClient";
import { mkJson2PollingInfoCodec, PollingInfo } from "../polling";
import { mkConnectorClient, type ConnectorClient } from "../cardano/connectorClient";
import { json2HttpEndpointErrorCodec, type HttpEndpointError } from "../http";
import { unwrapOrPanic } from "../neverthrow";

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
  submit: (tx: Transaction) => Promise<Result<TxHash, HttpEndpointError>>;
  utxosAtAddress: (address: Address) => Promise<Result<Array<TransactionUnspentOutput>, HttpEndpointError>>;
  // utxosAtAddress(address: Address): Promise<Result<Array<TransactionUnspentOutput>, JsonError>>;
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
    lovelace: Lovelace.jsonCodec,
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

export type BalanceInfo = PollingInfo<Lovelace>;
export const BalanceInfo = PollingInfo;

export const json2BalanceInfoCodec: JsonCodec<BalanceInfo> = mkJson2PollingInfoCodec(Lovelace.jsonCodec);

export type SelectUtxosError =
  | { queryError: HttpEndpointError }
  | { insufficientFunds: { available: Lovelace; required: Lovelace } };

/* A simple, single-address, no staking wallet implementation */
export class Wallet<WalletBackend extends WalletBackendBase> {
  public readonly networkMagicNumber: NetworkMagicNumber;
  // This is publicly accessible so we can serialise the state.
  public readonly privateKey: Ed25519PrivateKey;

  private _subscriptionCounter: number = 0;
  private _balanceInfo: BalanceInfo;
  private _walletBackend: WalletBackend;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private pollingInterval = Milliseconds.fromNonNegativeInt(NonNegativeInt.fromSmallNumber(0));

  private readonly eventTarget = new EventTarget();

  constructor(privateKey: Ed25519PrivateKey, walletBackend: WalletBackend, balanceInfo?: BalanceInfo) {
    this.privateKey = privateKey;
    this._walletBackend = walletBackend;
    this.networkMagicNumber = walletBackend.networkMagicNumber;
    this._balanceInfo = balanceInfo || new BalanceInfo(null);
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
    return this._balanceInfo.lastValue;
  }

  public get balanceInfo(): BalanceInfo | null {
    return this._balanceInfo;
  }

  public async selectUtxos(minLovelace: Lovelace): Promise<Result<Array<TransactionUnspentOutput>, SelectUtxosError>> {
    return (await this.walletBackend.utxosAtAddress(this.address))
      .mapErr((error: HttpEndpointError) => {
        return { queryError: error };
      })
      .andThen((result) => {
        const reduced = result.reduce((acc, utxo) => {
          if(acc.sum >= minLovelace) return acc;
          const sum: bigint = acc.sum + utxo.output.value.lovelace;
          const utxos = [...acc.utxos, utxo];
          return { sum, utxos };
        }, { sum: BigInt(0), utxos: [] as Array<TransactionUnspentOutput> });
        if (reduced.sum >= minLovelace) return ok(reduced.utxos);
        else return err({ insufficientFunds: {
          available: unwrapOrPanic(Lovelace.fromBigInt(reduced.sum), "Failed to convert sum of utxos to Lovelace"),
          required: minLovelace
        }});
      })
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
    let origBalance = this.balance;
    this._balanceInfo = this._balanceInfo.mkSuccessor(result);
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

  public async sign(tx: Transaction, context?: Json): Promise<Result<Transaction, WasmError>> {
    return tx.sign(this.privateKey).map((signedTx) => {
      this.emit("tx-signed", context ? { tx: signedTx, context } : { tx: signedTx });
      return signedTx;
    });
  }

  public async submit(tx: Transaction, context?: Json): Promise<Result<TxHash, HttpEndpointError>> {
    const result = await this.walletBackend.submit(tx);
    return result.map(txHash => {
      this.emit("tx-submitted", context ? { txHash, context } : { txHash });
      return txHash;
    });
  }
}

const mkWalletCodec = <Backend extends WalletBackendBase>(
  json2BackendCodec: JsonCodec<Backend>,
): JsonCodec<Wallet<Backend>> => {
  const json2WalletStateRecordCodec:JsonCodec<{ balance_info: BalanceInfo | null, private_key: Ed25519PrivateKey }> = jsonCodecs.objectOf({
    balance_info: jsonCodecs.nullable(json2BalanceInfoCodec),
    private_key: json2Ed25519PrivateKeyCodec,
  });
  return codec.rmap(
    jsonCodecs.objectOf({
      backend: json2BackendCodec,
      state: json2WalletStateRecordCodec,
    }),
    (r) => {
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
    readonly connector: ConnectorClient;
  };

  export const mkWalletBackendFromConnector = (connector: ConnectorClient, networkMagicNumber: NetworkMagicNumber): WalletBackend => {
    return {
      connector,
      getBalance: async (vKey: Ed25519VerificationKey) => {
        const address: Address = {
          network: Network.fromNetworkMagicNumber(networkMagicNumber),
          paymentCredential: {
            type: "PubKeyHash",
            hash: PubKeyHash.fromPubKey(vKey.key),
          }
        };
        return (await connector.balance(address)).mapErr((error) => {
          return json2HttpEndpointErrorCodec.serialise(error);
        });
      },
      submit: (tx: Transaction) => connector.submit(tx.toCbor()),
      utxosAtAddress: async (address: Address) => {
        const utxosWithExtraInfo = await connector.utxosAt(address);
        return utxosWithExtraInfo
          .map((utxos) => utxos.map((u) => u.out));
      },
      networkMagicNumber,
    };
  };

  export const mkWalletBackendFromUrl = (backendUrl: string, networkMagicNumber: NetworkMagicNumber): WalletBackend => {
    const connector = mkConnectorClient(backendUrl);
    return mkWalletBackendFromConnector(connector, networkMagicNumber);
  }

  export const mkWalletBackend = (connectorOrUrl: ConnectorClient | string, networkMagicNumber: NetworkMagicNumber): WalletBackend => {
    if(typeof connectorOrUrl === "string") {
      return mkWalletBackendFromUrl(connectorOrUrl, networkMagicNumber);
    } else {
      return mkWalletBackendFromConnector(connectorOrUrl, networkMagicNumber);
    }
  }

  export const createBackend = (backendUrl: string, networkMagicNumber: NetworkMagicNumber): WalletBackend => {
    return mkWalletBackend(backendUrl, networkMagicNumber);
  }

  export function fromPrivateKey(
    connectorConfig: string | ConnectorClient,
    networkMagicNumber: NetworkMagicNumber,
    privateKey: Ed25519PrivateKey,
    balanceInfo?: BalanceInfo
  ): Wallet<CardanoConnectorWallet.WalletBackend> {
    const walletBackend = mkWalletBackend(connectorConfig, networkMagicNumber);
    return new Wallet(privateKey, walletBackend, balanceInfo);
  }

  export async function create(
    connector: string | ConnectorClient,
    networkMagicNumber: NetworkMagicNumber,
  ): Promise<{ wallet: Wallet<WalletBackend>; mnemonic: Mnemonic }> {
    const backend = mkWalletBackend(connector, networkMagicNumber);
    return Wallet.create(backend);
  }

  export async function restore(
    connector: string | ConnectorClient,
    networkMagicNumber: NetworkMagicNumber,
    mnemonic: Mnemonic,
  ): Promise<Wallet<WalletBackend>> {
    const backend = mkWalletBackend(connector, networkMagicNumber);
    return Wallet.restore(backend, mnemonic);
  }

  export const json2WalletBackendCodec: JsonCodec<WalletBackend> = codec.rmap(
    jsonCodecs.objectOf({
      backend_url: jsonCodecs.json2StringCodec,
      network_magic_number: NetworkMagicNumber.jsonCodec,
      type: jsonCodecs.constant("CardanoConnectorWallet.WalletBackend"),
    }),
    (r) => createBackend(r.backend_url, r.network_magic_number),
    (walletBackend: WalletBackend) => {
        return {
          backend_url: walletBackend.connector.baseUrl,
          network_magic_number: walletBackend.networkMagicNumber,
          type: "CardanoConnectorWallet.WalletBackend" as const,
        };
    }
  );

  export const json2WalletCodec: JsonCodec<Wallet<WalletBackend>> =
    mkWalletCodec(json2WalletBackendCodec);
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
          return (await blockfrostClient.getAddressInfo(addressBech32))
            .map(addressInfo => addressInfo.lovelace)
            .mapErr((error) => {
              return json2HttpEndpointErrorCodec.serialise(error);
            });
        },
        submit: async (tx: Transaction) => {
          const txCbor = tx.toCbor();
          return blockfrostClient.submitTx(txCbor);
        },
        utxosAtAddress: async (address: Address) => {
          const utxosWithExtraInfo = await blockfrostClient.utxosAt(AddressBech32.fromAddress(address));
          return utxosWithExtraInfo;
        },
        networkMagicNumber: blockfrostClient.networkMagicNumber,
      };
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

  export const json2WalletBackendCodec: JsonCodec<WalletBackend> = codec.pipe(
    jsonCodecs.objectOf({
      project_id: jsonCodecs.json2StringCodec,
      type: jsonCodecs.constant("BlockfrostWallet.WalletBackend"),
    }), {
      deserialise: (r) => {
        return createBackend(r.project_id);
      },
      serialise: (walletBackend: WalletBackend) => {
        return {
          project_id: walletBackend.projectId,
          type: "BlockfrostWallet.WalletBackend" as const,
        };
      }
    }
  );

  export const json2WalletCodec: JsonCodec<Wallet<WalletBackend>>
    = mkWalletCodec(json2WalletBackendCodec);
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
export const json2AnyWalletBackendCodec: JsonCodec<AnyWalletBackend> = jsonCodecs.altJsonCodecs(
  [CardanoConnectorWallet.json2WalletBackendCodec, BlockfrostWallet.json2WalletBackendCodec],
  (serConnector, serBlockfrost) => (backend: AnyWalletBackend) => {
    if (isCardanoConnectorBackend(backend)) {
      return serConnector(backend);
    }
    return serBlockfrost(backend);
  },
);


export const json2AnyWalletCodec: JsonCodec<AnyWallet> = jsonCodecs.altJsonCodecs(
  [CardanoConnectorWallet.json2WalletCodec, BlockfrostWallet.json2WalletCodec],
  (serConnector, serBlockfrost) => (wallet: AnyWallet) => {
    if (isCardanoConnectorWallet(wallet)) {
      return serConnector(wallet);
   }
    return serBlockfrost(wallet);
  },
);

