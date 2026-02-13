import { describe, it } from "vitest";
import * as fs from "fs";
import { json2KonduitConsumerAsyncCodec, KonduitConsumer } from "../src";
import { AdaptorFullInfo, mkBlockfrostClient } from "../src/adaptorClient";
import { Days, Milliseconds, Seconds } from "../src/time/duration";
import { Address, AddressBech32, Lovelace, Network, PubKeyHash } from "../src/cardano";
import { Ada } from "../src/cardano/assets";
import { Json, parse, stringify } from "@konduit/codec/json";
import { expectNotNull, expectOk } from "./assertions";
import { HexString } from "@konduit/codec/hexString";
import { KeyIndex, KeyRole, Ed25519RootPrivateKey, WalletIndex, Ed25519PrivateKey } from "@konduit/cardano-keys";
import * as hexString from "@konduit/codec/hexString";
import * as wasm from "../wasm/konduit_wasm.js";
import { deserialiseCbor } from "@konduit/codec/cbor/codecs/sync";
import { Connector, Transaction } from "../src/cardano/connector";
import * as adaptorClient from "../src/adaptorClient";
import { BlockfrostWallet, Wallet } from "../src/wallets/embedded";
import { ok, err, Result } from "neverthrow";
import { Ed25519Secret } from "@konduit/cardano-keys/rfc8032";
import { JsonError } from "@konduit/codec/json/codecs";
import { hoistToResultAsync, resultAsyncToPromise } from "../src/neverthrow";


const integrationTestEnv = (() => {
  const adaptorUrlOpt = import.meta.env.VITE_TEST_ADAPTOR_URL;
  const backendUrlOpt = import.meta.env.VITE_TEST_CONNECTOR_URL;
  const signingKeySecretOpt = import.meta.env.VITE_TEST_SIGNING_KEY_SECRET;
  const blockfrostProjectIdOpt = import.meta.env.VITE_TEST_BLOCKFROST_PROJECT_ID;
  const konduitConsumerStateFile = import.meta.env.VITE_TEST_KONDUIT_CONSUMER_STATE_FILE;

  const mkKonduitConsumer = async (t: any): Promise<KonduitConsumer> => {
    if(!konduitConsumerStateFile) {
      t.skip();
    }
    if(fs.existsSync(konduitConsumerStateFile)) {
      const fileContent: string = fs.readFileSync(konduitConsumerStateFile, "utf-8");
      return expectOk(await resultAsyncToPromise(hoistToResultAsync(Promise.resolve(parse(fileContent))).andThen((json) => {
        return hoistToResultAsync(json2KonduitConsumerAsyncCodec.deserialise(json));
      })));
    } else {
      const connector = await mkConnector(t);
      const blockfrostWallet = await mkBlockfrostWallet(t);
      return new KonduitConsumer(connector, blockfrostWallet);
    }
  }

  const saveKonduitConsumerState = (consumer: KonduitConsumer) => {
    if(!konduitConsumerStateFile) {
      throw new Error("Konduit consumer state file path not set in environment variable VITE_TEST_KONDUIT_CONSUMER_STATE_FILE");
    }
    const serialised = json2KonduitConsumerAsyncCodec.serialise(consumer);
    const jsonString = stringify(serialised);
    fs.writeFileSync(konduitConsumerStateFile, jsonString, "utf-8");
  }

  // In this testing, and small context we allow *some* vague typing.
  const mkKeys = (t: any) => {
    if(!signingKeySecretOpt) {
      t.skip();
    }
    const signingSecretStr = expectNotNull(signingKeySecretOpt);
    const signingSecretHex = expectOk(HexString.fromString(signingSecretStr));
    const signingSecretBytes = hexString.toUint8Array(signingSecretHex);
    const signingSecret = expectOk(Ed25519Secret.fromBytes(signingSecretBytes));
    const privateKey = new Ed25519PrivateKey(signingSecret);
    const sKey = privateKey.toSigningKey();
    const vKey = sKey.toVerificationKey();
    const address = {
      network: Network.TESTNET,
      paymentCredential: {
        type: "PubKeyHash",
        hash: PubKeyHash.fromPubKey(vKey.key)
      },
    } as Address;
    const addressBech32 = AddressBech32.fromAddress(address);
    return { addressBech32, privateKey, sKey, vKey };
  }

  const mkBlockfrostWallet = async (t: any) => {
    if(!backendUrlOpt) {
      t.skip();
    }
    // export async function fromPrivateKey(
    //   projectId: string,
    //   rootPrivateKey: Ed25519RootPrivateKey,
    //   balanceInfo?: BalanceInfo
    const blockfrostProjectId = expectNotNull(blockfrostProjectIdOpt);
    const { privateKey } = mkKeys(t);
    const walletBackend = expectOk(await BlockfrostWallet.fromPrivateKey(blockfrostProjectId, privateKey));
    return walletBackend;
  }

  const mkConnector = async (t: any) => {
    if(!backendUrlOpt) {
      t.skip();
    }
    const backendUrlStr = expectNotNull(backendUrlOpt);
    const connector = expectOk(await Connector.new(backendUrlStr));
    return connector;
  }

  const mkAdaptorFullInfo = async (t: any) => {
    if(!adaptorUrlOpt) {
      t.skip();
    }
    const adaptorUrlStr = expectNotNull(adaptorUrlOpt);
    const adaptorFullInfo = expectOk(await AdaptorFullInfo.fromString(adaptorUrlStr));
    return adaptorFullInfo;
  }

  return {
    mkAdaptorFullInfo,
    mkKeys,
    mkKonduitConsumer,
    mkBlockfrostWallet,
    mkConnector,
    saveKonduitConsumerState,
  };
})();

describe("End-to-end integration: open channel and poll adaptor squash", () => {
  it(
    "opens a channel and polls adaptor squash endpoint until it is indexed",
    async (test) => {
      // Enable WASM logging for debugging, same as connector test
      if (wasm && typeof wasm.enableLogs === "function") {
        wasm.enableLogs(wasm.LogLevel.Debug);
      }

      // const keys = integrationTestEnv.mkKeys(test);
      // console.debug("Keys initialised for integration test, now creating wallet backend and connector...");
      // console.log("Address Bech32:", keys.addressBech32);
      // const blockfrostWallet = await integrationTestEnv.mkBlockfrostWallet(test);

      // blockfrostWallet.startPolling(Seconds.fromDigits(1));
      // console.debug("Created wallet backend for integration test, now creating connector...");
      // // sleep 2 sec
      // await new Promise((resolve) => setTimeout(resolve, 2000));
      // console.log("Wallet balance:", blockfrostWallet.balance);

      // const connector = await integrationTestEnv.mkConnector(test);
      // console.debug("Created connector and wallet backend for integration test, now creating consumer...");

      const consumer = await integrationTestEnv.mkKonduitConsumer(test);

      const adaptorFullInfo = await integrationTestEnv.mkAdaptorFullInfo(test);
      // Parameters for opening the channel
      const amount = Lovelace.fromAda(Ada.fromSmallNumber(5)); // 5 ADA
      const closePeriod = Milliseconds.fromAnyPreciseDuration({ type: "days", value: Days.fromSmallNumber(3) });

      // Open the channel
      const channel = expectOk(await consumer.openChannel(adaptorFullInfo, amount, closePeriod));
      integrationTestEnv.saveKonduitConsumerState(consumer);

      // console.debug("Ed25519VerificationKey bytes derived from signing key:", HexString.fromUint8Array(keys.sKey.toVerificationKey().key));
      // const signedTransaction = expectOk(transaction.sign(keys.privateKey));
      // const submitResult = await blockfrostWallet.signAndSubmit(transaction);

      // const channelTag = channel.l1.channelTag;

      // console.log("Opened channel with tag:", HexString.fromUint8Array(channelTag));
      // console.log("Consumer vKey:", HexString.fromUint8Array(consumer.vKey.key));

      // // Build adaptor channel client
      // const adaptorChannelClient = mkAdaptorChannelClient(
      //   adaptorUrl,
      //   consumer.vKey,
      //   channelTag
      // );
      // console.log("Adaptor keyTag hex:", HexString.fromUint8Array(adaptorChannelClient.keyTag));

      // const maxAttempts = 20;
      // const delayMs = 3000;

      // const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      // const squashBody = SquashBody.empty; // Assuming empty body for squash, adjust if needed
      // const squash = Squash.fromBodySigning(
      //   sKey,
      //   channelTag,
      //   squashBody,
      // );

      // for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      //   console.log(`Squash attempt #${attempt}`);
      //   const squashResult = await adaptorChannelClient.chSquash(squash);
      //   squashResult.match(
      //     (res) => {
      //       // Successful HTTP status (as per mkPostEndpoint semantics)
      //       console.log("Squash success raw result:", res);
      //       try {
      //         const jsonEncoded = stringify(res as any);
      //         console.log("Squash success JSON-encoded:", jsonEncoded);
      //       } catch (e) {
      //         console.log("Failed to JSON-encode squash success result:", e);
      //       }
      //     },
      //     (err) => {
      //       // HttpEndpointError or deserialisation/network error
      //       console.log("Squash error type:", err.type);

      //       if (err.type === "HttpError") {
      //         console.log("HTTP status:", err.status, err.statusText);
      //         console.log("Decoded error body:", err.body);

      //         // 404 is expected until adaptor indexes the channel
      //         if (err.status === 404) {
      //           console.log("Channel not yet indexed by adaptor (404), will retry...");
      //         } else if (err.status === 200 || err.status === 204) {
      //           console.log("Unexpected success status treated as error path:", err.status);
      //         }
      //       } else {
      //         console.log("Non-HTTP error:", (err as any).message);
      //       }

      //       try {
      //         const jsonEncoded = stringify(err as any);
      //         console.log("Squash error JSON-encoded:", jsonEncoded);
      //       } catch {
      //         // Ignore if error cannot be encoded as JSON
      //       }
      //     }
      //   );

      //   // Break condition: if we ever get a 200/204 from the adaptor, we can stop early.
      //   if (squashResult.isOk()) {
      //     console.log("Squash call succeeded; stopping polling loop.");
      //     break;
      //   } else if (
      //     squashResult.isErr() &&
      //     squashResult.error.type === "HttpError" &&
      //     (squashResult.error.status === 200 || squashResult.error.status === 204)
      //   ) {
      //     console.log("Received 200/204 in error path; stopping polling loop.");
      //     break;
      //   }

      //   if (attempt < maxAttempts) {
      //     await sleep(delayMs);
      //   } else {
      //     console.log(`Reached maximum squash attempts (${maxAttempts}); stopping.`);
      //   }
      // }
    },
    200000
  );
});
