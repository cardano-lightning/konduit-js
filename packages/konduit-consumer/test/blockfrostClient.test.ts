import * as testEnv from "./env";
import { describe, it, expect } from "vitest";
import { mkBlockfrostClient } from "../src/blockfrostClient";
import { AddressBech32, TransactionUnspentOutput } from "../src/cardano";
import { expectOk } from "./assertions";
import { stringify } from "@konduit/codec/json";

describe("Blockfrost client", () => {
  const projectIdOpt = import.meta.env
    .VITE_TEST_BLOCKFROST_PROJECT_ID as string | undefined;

  // FIXME: Automatically support both networks mainnet and preprod
  const mkClient = () => {
    if (!projectIdOpt) {
      return null;
    }
    const clientResult = mkBlockfrostClient(projectIdOpt);
    return expectOk(clientResult);
  };

  it("gets address info for a known address", async (t) => {
    const client = mkClient();
    if (!client) t.skip();

    const address = AddressBech32.fromAddress(testEnv.readOrSkipKeys(t).address);
    const infoResult = await client!.getAddressInfo(address);
    const info = expectOk(infoResult);
    expect(info.address.toString()).toBe(address.toString());
  });

  it("queries UTXOs at a known address", async (t) => {
    const client = mkClient();
    if (!client) t.skip();

    const address = testEnv.readOrSkipKeys(t).address;
    const utxosResult = await client!.utxosAt(AddressBech32.fromAddress(address));
    const utxos = expectOk(utxosResult);
    console.log(stringify(utxos.map((out) => TransactionUnspentOutput.jsonCodec.serialise(out))));

    expect(Array.isArray(utxos)).toBe(true);
    if (utxos.length > 0) {
      const first = utxos[0]!;
      expect(first.output).toBeDefined();
      expect(first.input).toBeDefined();
    }
  });
});
