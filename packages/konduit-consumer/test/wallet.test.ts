import type { Tagged } from "type-fest";
import { describe, it, expect, beforeEach } from 'vitest';
import { ok, type Result } from "neverthrow";
import { Wallet, type WalletBackendBase } from '../src/wallets/embedded';
import { Lovelace, NetworkMagicNumber, type TxHash} from '../src/cardano';
import { Ed25519Pub, generateMnemonic, VKey } from '@konduit/cardano-keys';
import type { TransactionReadyForSigning } from '../wasm/konduit_wasm';
import { Milliseconds, Seconds } from '../src/time/duration';
import { JsonError } from '@konduit/codec/json/codecs';
import { PositiveBigInt } from '@konduit/codec/integers/big';
import { HexString } from '@konduit/codec/hexString';
import { expectOk, expectToBe } from "./assertions";

type Ed25519PubHex = Tagged<HexString, "Ed25519PubHex">;
namespace Ed25519PubHex {
  export function fromEd25519Pub(pub: Ed25519Pub): Ed25519PubHex {
    return HexString.fromUint8Array(pub) as Ed25519PubHex;
  }
  export function fromVKey(vKey: VKey): Ed25519PubHex {
    return fromEd25519Pub(vKey.getKey());
  }
}

// Mock WalletBackend for testing
class MockWalletBackend implements WalletBackendBase {
  private balances = new Map<Ed25519PubHex, Lovelace>();
  private txCounter = 0;
  public readonly networkMagicNumber = NetworkMagicNumber.fromPositiveBigInt(PositiveBigInt.fromDigits(6, 6, 6));

  setBalance(addr: VKey, balance: Lovelace): void {
    this.balances.set(Ed25519PubHex.fromVKey(addr), balance);
  }

  async getBalance(vKey: VKey): Promise<Result<Lovelace, JsonError>> {
    return ok(this.balances.get(Ed25519PubHex.fromVKey(vKey)) || 0n as Lovelace);
  }

  async signAndSubmit(_tx: TransactionReadyForSigning, _sKey: any): Promise<Result<TxHash, JsonError>> {
    this.txCounter++;
    return ok((new Uint8Array(32).fill(0x00)) as TxHash);
  }
}

describe('Wallet Events', () => {
  let mockConnector: MockWalletBackend;
  let wallet: Wallet<MockWalletBackend>;

  beforeEach(async () => {
    mockConnector = new MockWalletBackend();
    const mnemonic = generateMnemonic("24-words");
    wallet = await Wallet.restore(mockConnector, mnemonic);
  });

  it('should emit balance-changed event when balance updates via polling', async () => {
    const balanceChanges: Array<{ newBalance: Lovelace }> = [];

    const unsubscribe = wallet.subscribe('balance-changed', (payload) => {
      balanceChanges.push(payload);
    });

    // Set initial balance
    mockConnector.setBalance(wallet.vKey, 1000000n as Lovelace);

    let pollingInterval = Seconds.fromSmallNumber(1);

    // Start polling with short interval
    await wallet.startPolling(pollingInterval);

    // Wait for first poll
    let pollingCheckDelay = 2 * Milliseconds.fromSeconds(pollingInterval);
    await new Promise(resolve => setTimeout(resolve, pollingCheckDelay));

    // Change balance
    mockConnector.setBalance(wallet.vKey, 2000000n as Lovelace);

    // Wait for second poll
    await new Promise(resolve => setTimeout(resolve, pollingCheckDelay));

    wallet.stopPolling();
    unsubscribe();

    // Should have received at least 2 balance change events
    expect(balanceChanges.length).toBeGreaterThanOrEqual(2);
    expect(balanceChanges[0].newBalance).toBe(1000000n);
    expect(balanceChanges[1].newBalance).toBe(2000000n);
  });

  it('should emit tx-submitted event when transaction is submitted', async () => {
    const txSubmissions: Array<{ txHash: TxHash; context?: any }> = [];

    const unsubscribe = wallet.subscribe('tx-submitted', (payload) => {
      txSubmissions.push(payload);
    });

    // Create dummy transaction (opaque object)
    const dummyTx = { type: 'dummy-tx' } as unknown as TransactionReadyForSigning;
    const context = { purpose: 'test-payment', amount: 500000n };

    // Submit transaction with context
    const txHash1 = expectOk(await wallet.signAndSubmit(dummyTx, context));

    // Submit transaction without context
    const txHash2 = expectOk(await wallet.signAndSubmit(dummyTx));

    unsubscribe();

    // Verify events were emitted
    expect(txSubmissions.length).toBe(2);

    // First submission with context
    expect(txSubmissions[0].txHash).toBe(txHash1);
    expect(txSubmissions[0].context).toEqual(context);

    // Second submission without context
    expectToBe(txSubmissions[1].txHash, txHash2);
    expect(txSubmissions[1].context).toBeUndefined();
  });
});
