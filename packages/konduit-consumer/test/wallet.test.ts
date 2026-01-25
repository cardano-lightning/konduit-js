import { describe, it, expect, beforeEach } from 'vitest';
import { Wallet, type ChainConnector } from '../src/wallets/embedded';
import { Lovelace, type TxHash, type AddressBech32 } from '../src/cardano';
import { generateMnemonic } from '@konduit/cardano-keys';
import type { TransactionReadyForSigning } from '../wasm/konduit_wasm';
import { Milliseconds, Seconds } from '../src/time/duration';

// Mock ChainConnector for testing
class MockChainConnector implements ChainConnector {
  private balances = new Map<AddressBech32, Lovelace>();
  private txCounter = 0;

  setBalance(addr: AddressBech32, balance: Lovelace): void {
    this.balances.set(addr, balance);
  }

  async getBalance(addr: AddressBech32): Promise<Lovelace> {
    return this.balances.get(addr) ?? (0n as Lovelace);
  }

  async signAndSubmit(_tx: TransactionReadyForSigning, _sKey: any): Promise<TxHash> {
    this.txCounter++;
    return  (new Uint8Array(32).fill(0x00)) as TxHash;
  }
}

describe('Wallet Events', () => {
  let mockConnector: MockChainConnector;
  let wallet: Wallet;

  beforeEach(async () => {
    mockConnector = new MockChainConnector();
    const mnemonic = generateMnemonic("24-words");
    wallet = await Wallet.restore(mockConnector, mnemonic);
  });

  it('should emit balance-changed event when balance updates via polling', async () => {
    const balanceChanges: Array<{ oldBalance?: Lovelace; newBalance: Lovelace }> = [];

    const unsubscribe = wallet.subscribe('balance-changed', (payload) => {
      balanceChanges.push(payload);
    });

    // Set initial balance
    mockConnector.setBalance(wallet.addressBech32, 1000000n as Lovelace);

    let pollingInterval = Seconds.fromSmallNumber(1);

    // Start polling with short interval
    await wallet.startPolling(pollingInterval);

    // Wait for first poll
    let pollingCheckDelay = Milliseconds.fromSeconds(pollingInterval) + 100;
    await new Promise(resolve => setTimeout(resolve, pollingCheckDelay));

    // Change balance
    mockConnector.setBalance(wallet.addressBech32, 2000000n as Lovelace);

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
    const txHash1 = await wallet.signAndSubmit(dummyTx, context);

    // Submit transaction without context
    const txHash2 = await wallet.signAndSubmit(dummyTx);

    unsubscribe();

    // Verify events were emitted
    expect(txSubmissions.length).toBe(2);

    // First submission with context
    expect(txSubmissions[0].txHash).toBe(txHash1);
    expect(txSubmissions[0].context).toEqual(context);

    // Second submission without context
    expect(txSubmissions[1].txHash).toBe(txHash2);
    expect(txSubmissions[1].context).toBeUndefined();
  });
});
