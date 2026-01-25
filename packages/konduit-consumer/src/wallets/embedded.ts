import type { Json } from "@konduit/codec/json";
import * as codec from "@konduit/codec";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { Address, AddressBech32, Lovelace, mainnet, TxHash } from "../cardano";
import type { Ed25519Prv, Mnemonic } from "@konduit/cardano-keys";
import { generateMnemonic, KeyIndex, KeyRole, RootPrivateKey, WalletIndex } from "@konduit/cardano-keys";
import { NonNegativeInt } from "@konduit/codec/integers/smallish";
import { Milliseconds, type Seconds } from "../time/duration";
import type { TransactionReadyForSigning } from "../../wasm/konduit_wasm";
import { json2RootPrivateKeyCodec } from "../cardano/codecs";

type WalletEvent<T> = CustomEvent<T>;

export type WalletEvents = {
  "balance-changed": { oldBalance?: Lovelace; newBalance: Lovelace };
  "tx-submitted": { txHash: TxHash, context?: Json };
};

// We separate this tiny interface so we can plug in quickly not only cardano-connector
// but also blockfrost or mock connectors for testing.
export type ChainConnector = {
  getBalance: (addr: AddressBech32) => Promise<Lovelace>;
  signAndSubmit: (tx: TransactionReadyForSigning, sKey: Ed25519Prv) => Promise<TxHash>;
};

/* A simple, single-address, no staking wallet implementation */
export class Wallet {
  private _balance: Lovelace = 0n as Lovelace;
  private provider: ChainConnector;
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

  constructor(rootPrivateKey: RootPrivateKey, provider: ChainConnector) {
    this.rootPrivateKey = rootPrivateKey;
    this.provider = provider;
  }

  // Restore from mnemonic
  static async restore(connector: ChainConnector, mnemonic: Mnemonic, password?: Uint8Array): Promise<Wallet> {
    const rootPrivateKey = await RootPrivateKey.fromMnemonic(mnemonic, password);
    return Promise.resolve(new Wallet(rootPrivateKey, connector));
  }

  static async create(connector: ChainConnector, mnemonicPassword?: Uint8Array): Promise<{ wallet: Wallet; mnemonic: Mnemonic }> {
    const mnemonic = generateMnemonic("24-words");
    const rootPrivateKey = await RootPrivateKey.fromMnemonic(mnemonic, mnemonicPassword);
    const wallet = new Wallet(rootPrivateKey, connector);
    return Promise.resolve({ wallet, mnemonic });
  }

  private get skey() {
    return this.rootPrivateKey.deriveSKey(this.addrPath.walletIdx, this.addrPath.role, this.addrPath.addressIdx);
  }

  public get address(): Address {
    const sKey = this.rootPrivateKey.deriveSKey(this.addrPath.walletIdx, this.addrPath.role, this.addrPath.addressIdx);
    const vKey = sKey.toVKey();
    return Address.fromVKeys(mainnet, vKey);
  }

  public get addressBech32(): AddressBech32 {
    return AddressBech32.fromAddress(this.address);
  }

  public get balance(): Lovelace {
    return this._balance;
  }

  private set balance(newBalance: Lovelace) {
    if (this._balance !== newBalance) {
      this._balance = newBalance;
      this.emit("balance-changed", { oldBalance: this._balance, newBalance });
    }
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
    const newBalance = await this.provider.getBalance(this.addressBech32);
    this.balance = newBalance;
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

  public async signAndSubmit(tx: TransactionReadyForSigning, context?: Json): Promise<TxHash> {
    const txHash = await this.provider.signAndSubmit(tx, this.skey.getKey());
    this.emit("tx-submitted", context ? { txHash, context } : { txHash });
    return txHash;
  }

  // A bit convoluted - we keep that method on the class level so it can access private
  // members, but in general it could be considered a stand alone function.
  public static mkWalletCodec(connectorCodec: jsonCodecs.JsonCodec<ChainConnector>) {
    const walletRecordCodec = jsonCodecs.objectOf({
      // Don't ask me why we store the private key in a plain text :-P
      root_private_key: json2RootPrivateKeyCodec,
      connector: connectorCodec,
    });
    return codec.rmap(
      walletRecordCodec,
      ({ root_private_key, connector }) => {
        return new Wallet(root_private_key, connector);
      },
      (wallet: Wallet) => ({
        root_private_key: wallet.rootPrivateKey,
        connector: wallet.provider,
      })
    );
  }
}


