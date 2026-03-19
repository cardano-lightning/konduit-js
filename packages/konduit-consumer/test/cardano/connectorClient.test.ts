import { describe, expect, it } from "vitest";
import * as testEnv from "../env";
import { Address, TransactionUnspentOutput } from "../../src/cardano";
import { stringify } from "@konduit/codec/json";
import { expectOk } from "../assertions";

describe("Native TS connector client", (_test) => {
  it("queries a balance of the testing wallet", async (test) => {
    const connectorClient = await testEnv.readOrSkipConnectorClient(test);
    const keys = testEnv.readOrSkipKeys(test);
    const balanceResult = await connectorClient.balance(keys.address);
    expectOk(balanceResult, "Failed to query balance via connector client in integration test");
  });
  it("queries the network magic number", async (test) => {
    const connectorClient = await testEnv.readOrSkipConnectorClient(test);
    const networkResult = await connectorClient.network();
    expectOk(networkResult, "Failed to query network magic number via connector client in integration test");
  });
  it("queries the health endpoint", async (test) => {
    const connectorClient = await testEnv.readOrSkipConnectorClient(test);
    const healthResult = await connectorClient.health();
    expectOk(healthResult, "Failed to query health endpoint via connector client in integration test");
  });
  it("queries the utxos at the testing wallet address", async (test) => {
    const connectorClient = await testEnv.readOrSkipConnectorClient(test);
    const publicNetwork = testEnv.readOrSkipPublicNetwork(test);
    const address = (() => {
      if(publicNetwork === "Mainnet")
        return expectOk(Address.jsonCodec.deserialise("addr1qy6ahym4teua2cpqaxpyxhw9fs2q2rrnxsmjf2j6hcsqhywm9q79dwv8xy0vv4e0ydzgu34fkzz6xa7nq6mtjreh2n9sp7sglx"))
      return testEnv.readOrSkipKeys(test).address;
    })();
    const utxosResult = await connectorClient.utxosAt(address);
    const utxos = expectOk(utxosResult, "Failed to query utxos at address via connector client in integration test");
    console.log(stringify(utxos.map(({ out }) => TransactionUnspentOutput.jsonCodec.serialise(out))));
  });
  it("queries the transaction details for a transaction involving the testing wallet", async (test) => {
    const connectorClient = await testEnv.readOrSkipConnectorClient(test);
    const keys = testEnv.readOrSkipKeys(test);
    const utxosResult = await connectorClient.utxosAt(keys.address);
    const utxos = expectOk(utxosResult, "Failed to query utxos at address via connector client in integration test");
    expect(utxos.length).toBeGreaterThan(0);
    const firstUtxo = utxos[0]!;
    const transactionId = firstUtxo.out.input[0];
    const transactionResult = await connectorClient.transaction(transactionId);
    expectOk(transactionResult, "Failed to query transaction details via connector client in integration test");
  });
});

