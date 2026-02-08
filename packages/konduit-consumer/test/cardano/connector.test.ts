import { describe, it, test } from "vitest";
import { Connector } from "../../src/cardano/connector";
import { expectErr, expectNotNull, expectOk } from "../assertions";
import { Milliseconds } from "../../src/time/duration";
import { KeyIndex, KeyRole, RootPrivateKey, WalletIndex } from "@konduit/cardano-keys";
import { ChannelTag } from "../../src/channel/core";
import { ConsumerVKey } from "../../src/channel/l1Channel";
import { AdaptorVKey } from "../../src/adaptorClient/adaptorInfo";
import { Lovelace } from "../../src/cardano/assets";
import { HexString } from "@konduit/codec/hexString";
import * as hexString from "@konduit/codec/hexString";
import * as wasm from "../../wasm/konduit_wasm.js";

describe("Connector integration tests", () => {
  it("should reject when connecting to an invalid server URL", async () => {
    expectErr(await Connector.new("https://invalid-server-that-does-not-exist.example.com"));
  });

  it("should reject (and not panic) when URL is malformed", async () => {
    expectErr(await Connector.new("ht!tp://in valid-url"));
  });

  it("should reject when server is responding with invalid response", async () => {
    expectErr(await Connector.new("https://example.com"));
  });

  // We shorten the test timeout to avoid waiting too long
  it("should reject when the server is not responding", async () => {
    let httpTimeout = Milliseconds.fromDigits(5, 0, 0);
    const result = await Connector.new("https://blackhole.webpagetest.org/", httpTimeout);
    expectErr(result);
  }, 1000);

  const backendUrlOpt = import.meta.env.VITE_TEST_CONNECTOR_URL;
  const rootKeyOpt = import.meta.env.VITE_ROOT_PRIVATE_KEY;

  test("should build an open transaction with valid parameters", async (test) => {
    if(!backendUrlOpt || !rootKeyOpt) {
      test.skip();
    }
    const rootKeyStr = expectNotNull(rootKeyOpt);
    const rootKeyHex = expectOk(HexString.fromString(rootKeyStr));
    const rootKeyBytes = hexString.toUint8Array(rootKeyHex);
    const rootKey = expectOk(RootPrivateKey.fromBytes(rootKeyBytes));

    const backendUrlStr = expectNotNull(backendUrlOpt);
    const connector = expectOk(await Connector.new(backendUrlStr));

    // Derive keys from root private key
    const consumerSKey = rootKey.deriveSKey(WalletIndex.fromSmallInt(0), KeyRole.External, KeyIndex.fromSmallInt(0));
    const consumerVKey = consumerSKey.toVKey() as ConsumerVKey;

    const adaptorSKey = rootKey.deriveSKey(WalletIndex.fromSmallInt(0), KeyRole.External, KeyIndex.fromSmallInt(1));
    const adaptorVKey = adaptorSKey.toVKey() as AdaptorVKey;
 
    // Create test parameters with sensible defaults
    const tag = await ChannelTag.fromRandomBytes(); // Random tag for testing
    const closePeriod = Milliseconds.fromDigits(3, 6, 0, 0, 0, 0, 0); // 1 hour
    const amount = Lovelace.fromDigits(5, 0, 0, 0, 0, 0, 0); // 5 ADA

    wasm.enableLogs(wasm.LogLevel.Debug);

    const tx = expectOk(await connector.buildOpenTx(tag, consumerVKey, adaptorVKey, closePeriod, amount));
    console.log(HexString.fromUint8Array(tx.toCbor()));
  }, 20000);
});
