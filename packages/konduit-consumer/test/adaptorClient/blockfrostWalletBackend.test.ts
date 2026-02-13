import { describe, expect, test } from "vitest";
import { mkBlockfrostClient } from "../../src/adaptorClient";
import { expectNotNull, expectOk } from "../assertions";
import { NetworkMagicNumber } from "../../src/cardano/addressses";
import { Ed25519RootPrivateKey, WalletIndex, KeyRole, KeyIndex } from "@konduit/cardano-keys";
import { HexString } from "@konduit/codec/hexString";
import * as hexString from "@konduit/codec/hexString";

describe("mkBlockfrostClient", () => {
  const backendUrlOpt = import.meta.env.VITE_TEST_CONNECTOR_URL;
  const rootKeyOpt = import.meta.env.VITE_ROOT_PRIVATE_KEY;
  const blockfrostProjectIdOpt = import.meta.env.VITE_BLOCKFROST_PROJECT_ID;

  // In this testing, and small context we allow *some* vague typing.
  const mkKeys = (t: any) => {
    if(!rootKeyOpt) {
      t.skip();
    }
    const rootKeyStr = expectNotNull(rootKeyOpt);
    const rootKeyHex = expectOk(HexString.fromString(rootKeyStr));
    const rootKeyBytes = hexString.toUint8Array(rootKeyHex);
    const rootKey = expectOk(Ed25519RootPrivateKey.fromBytes(rootKeyBytes));
    const sKey = rootKey.deriveSigningKey(WalletIndex.fromSmallInt(0), KeyRole.External, KeyIndex.fromSmallInt(0));
    const vKey = sKey.toVerificationKey();
    return { rootKey, sKey, vKey };
  }

  const mkWalletBackend = (t: any) => {
    if(!backendUrlOpt) {
      t.skip();
    }
    const walletBackend = expectOk(mkBlockfrostClient(expectNotNull(blockfrostProjectIdOpt)));
    return walletBackend;
  }

  // const _mkConnector = async (t: any) => {
  //   if(!backendUrlOpt) {
  //     t.skip();
  //   }
  //   const backendUrlStr = expectNotNull(backendUrlOpt);
  //   const connector = expectOk(await Connector.new(backendUrlStr));
  //   return connector;
  // }

  test("infers network magic and base URL from project ID", async (t) => {
    const { vKey } = mkKeys(t);
    const walletBackend = mkWalletBackend(t);
    expect(walletBackend.networkMagicNumber).toBe(NetworkMagicNumber.PREPROD);
    const balanceResult = expectOk(await walletBackend.getBalance(vKey));
    expect(balanceResult.lovelace).toBeGreaterThanOrEqual(0n);
  }, 20000);

  // test("submits open transaction through blockfrost", async (t) => {
  //   const connector = await mkConnector(t);
  //   const walletBackend = mkWalletBackend(t);
  //   const { vKey } = mkKeys(t);
  // });

  //   const backendResult = mkBlockWalletBackend("test-preprod-project-id");
  //   if (backendResult.isErr()) {
  //     throw new Error("Backend creation failed");
  //   }
  //   const backend = backendResult.value;

  //   const mnemonic = "test test test test test test test test test test test ball";

  //   const balanceResult = await backend.getBalance(vkey);
  //   expect(balanceResult.isOk()).toBe(true);
  //   balanceResult.map((lovelace) => {
  //     expect(lovelace.toBigInt()).toBe(1000n);
  //   });
  // });

  // it("getAddressInfo returns structured BlockfrostAddressInfo", async () => {
  //   const backendResult = mkBlockWalletBackend("test-preprod-project-id");
  //   if (backendResult.isErr()) {
  //     throw new Error("Backend creation failed");
  //   }
  //   const backend = backendResult.value;

  //   const dummyAddr = "addr_test1qpxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
  //   const infoResult = await backend.getAddressInfo(dummyAddr as any);
  //   expect(infoResult.isOk()).toBe(true);

  //   infoResult.map((info: BlockfrostAddressInfo) => {
  //     expect(info.received.lovelace.toBigInt()).toBe(1000n);
  //     expect(info.sent.lovelace.toBigInt()).toBe(200n);
  //     expect(info.txCount).toBe(3);
  //   });
  // });

  // it("submitTx converts hex string to bytes and returns tx hash", async () => {
  //   const backendResult = mkBlockWalletBackend("test-preprod-project-id");
  //   if (backendResult.isErr()) {
  //     throw new Error("Backend creation failed");
  //   }
  //   const backend = backendResult.value;

  //   const cborBytes = new Uint8Array([1, 2, 3, 4]);
  //   const cborHex = HexString.fromUint8Array(cborBytes);
  //   const txCborJson = JSON.stringify(cborHex);

  //   const result = await backend.submitTx(txCborJson as any);
  //   expect(result.isOk()).toBe(true);
  //   result.map((txHash) => {
  //     expect(txHash).toBe("deadbeef");
  //   });
  // });
});
