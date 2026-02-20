import type { Tagged } from "type-fest";
import { describe, it, expect, beforeEach } from 'vitest';
import { ok, type Result } from "neverthrow";
import { Wallet, type WalletBackendBase } from '../src/wallets/embedded';
import { Lovelace, NetworkMagicNumber, type TxHash} from '../src/cardano';
import { Ed25519PublicKey, generateMnemonic, Ed25519VerificationKey } from '@konduit/cardano-keys';
import { Milliseconds, Seconds } from '../src/time/duration';
import type { JsonError } from '@konduit/codec/json/codecs';
import { PositiveBigInt } from '@konduit/codec/integers/big';
import { HexString } from '@konduit/codec/hexString';
import { expectOk, expectToBe } from "./assertions";
import type { Transaction } from "../src/cardano/connector";

type Ed25519PublicKeyHex = Tagged<HexString, "Ed25519PublicKeyHex">;
namespace Ed25519PublicKeyHex {
  export function fromEd25519PublicKey(pub: Ed25519PublicKey): Ed25519PublicKeyHex {
    return HexString.fromUint8Array(pub) as Ed25519PublicKeyHex;
  }
  export function fromEd25519VerificationKey(vKey: Ed25519VerificationKey): Ed25519PublicKeyHex {
    return fromEd25519PublicKey(vKey.key);
  }
}

// Mock WalletBackend for testing
class MockWalletBackend implements WalletBackendBase {
  private balances = new Map<Ed25519PublicKeyHex, Lovelace>();
  private txCounter = 0;
  public readonly networkMagicNumber = NetworkMagicNumber.fromPositiveBigInt(PositiveBigInt.fromDigits(6, 6, 6));

  setBalance(addr: Ed25519VerificationKey, balance: Lovelace): void {
    this.balances.set(Ed25519PublicKeyHex.fromEd25519VerificationKey(addr), balance);
  }

  async getBalance(vKey: Ed25519VerificationKey): Promise<Result<Lovelace, JsonError>> {
    return ok(this.balances.get(Ed25519PublicKeyHex.fromEd25519VerificationKey(vKey)) || 0n as Lovelace);
  }

  async submit(_tx: Transaction): Promise<Result<TxHash, JsonError>> {
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
    const dummyTx = { type: 'dummy-tx', sign: () => ok(dummyTx) } as unknown as Transaction;
    const context = { purpose: 'test-payment', amount: 500000n };

    // Submit transaction with context
    const signedTx1 = expectOk(await wallet.sign(dummyTx, context));
    const txHash1 = expectOk(await wallet.submit(signedTx1, context));

    // Submit transaction without context
    const signedTx2 = expectOk(await wallet.sign(dummyTx));
    const txHash2 = expectOk(await wallet.submit(signedTx2));

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
