import { describe, it } from "vitest";
import * as fs from "fs";
import { json2KonduitConsumerAsyncCodec, KonduitConsumer } from "../src";
import { AdaptorFullInfo } from "../src/adaptorClient";
import { Days, Milliseconds, Seconds } from "../src/time/duration";
import { Address, AddressBech32, Lovelace, Network, PubKeyHash } from "../src/cardano";
import { Ada } from "../src/cardano/assets";
import { parse, stringify } from "@konduit/codec/json";
import { expectNotNull, expectOk } from "./assertions";
import { HexString } from "@konduit/codec/hexString";
import { Ed25519PrivateKey } from "@konduit/cardano-keys";
import * as hexString from "@konduit/codec/hexString";
import * as wasm from "../wasm/konduit_wasm.js";
import { Connector } from "../src/cardano/connector";
import { BlockfrostWallet, type AnyWallet } from "../src/wallets/embedded";
import { Ed25519Secret } from "@konduit/cardano-keys/rfc8032";
import { hoistToResultAsync, resultAsyncToPromise } from "../src/neverthrow";
import { json2ChannelCodec, KeyTag } from "../src/channel";
import { mkLndClient, type LndClient } from "../src/bitcoin/lndClient";
import { Millisatoshi } from "../src/bitcoin/asset";
import type { Invoice, InvoiceString } from "../src/bitcoin/bolt11";


const integrationTestEnv = (() => {
  const adaptorUrlOpt = import.meta.env.VITE_TEST_ADAPTOR_URL;
  const backendUrlOpt = import.meta.env.VITE_TEST_CONNECTOR_URL;
  const signingKeySecretOpt = import.meta.env.VITE_TEST_SIGNING_KEY_SECRET;
  const blockfrostProjectIdOpt = import.meta.env.VITE_TEST_BLOCKFROST_PROJECT_ID;
  const konduitConsumerStateFile = import.meta.env.VITE_TEST_KONDUIT_CONSUMER_STATE_FILE;
  const lndMacaroonOpt = import.meta.env.VITE_TEST_LND_MACAROON;
  const lndBaseUrlOpt = import.meta.env.VITE_TEST_LND_BASE_URL;

  const mkKonduitConsumer = async (t: any): Promise<KonduitConsumer<AnyWallet>> => {
    if(!konduitConsumerStateFile) {
      t.skip();
    }
    if(fs.existsSync(konduitConsumerStateFile)) {
      const fileContent: string = fs.readFileSync(konduitConsumerStateFile, "utf-8");
      return expectOk(await resultAsyncToPromise(hoistToResultAsync(Promise.resolve(parse(fileContent))).andThen((json) => {
        const result = (async () => {
          const result = await json2KonduitConsumerAsyncCodec.deserialise(json);
          result.mapErr((e) => console.error(stringify(e)));
          return result;
        })();
        return hoistToResultAsync(result);
      })));
    } else {
      const connector = await mkConnector(t);
      const blockfrostWallet = await mkBlockfrostWallet(t);
      const keys = mkKeys(t);
      return new KonduitConsumer(keys.privateKey, connector, blockfrostWallet);
    }
  }

  const saveKonduitConsumerState = (consumer: KonduitConsumer<AnyWallet>) => {
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

  const mkLnd = (t: any): LndClient => {
    if (!lndBaseUrlOpt || !lndMacaroonOpt) {
      t.skip();
    }
    const baseUrl = expectNotNull(lndBaseUrlOpt);
    const macaroon = expectNotNull(lndMacaroonOpt);
    return mkLndClient({ baseUrl, macaroon });
  }

  return {
    mkAdaptorFullInfo,
    mkKeys,
    mkKonduitConsumer,
    mkBlockfrostWallet,
    mkConnector,
    saveKonduitConsumerState,
    mkLnd,
  };
})();

describe("End-to-end integration: open channel and poll adaptor squash", () => {
  it(
    "opens a channel and polls adaptor squash endpoint until it is indexed",
    async (test) => {
      // test.skip();

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

      console.debug("Loading consumer");
      const consumer = await integrationTestEnv.mkKonduitConsumer(test);

      const keys = integrationTestEnv.mkKeys(test);
      console.log("Consumer address Bech32:", keys.addressBech32);

      console.debug("Consumer loaded");
      // Grab possibly the last channel
      let channel = consumer.channels.length > 0 ? consumer.channels[consumer.channels.length - 1] : null;
      if(!channel) {
        const adaptorFullInfo = await integrationTestEnv.mkAdaptorFullInfo(test);
        // Parameters for opening the channel
        // 10 ADA ~ $3 USD
        const amount = Lovelace.fromAda(Ada.fromSmallNumber(10)); // 5 ADA
        const closePeriod = Milliseconds.fromAnyPreciseDuration({ type: "days", value: Days.fromSmallNumber(3) });

        console.debug("Opening channel in integration test with parameters:", { amount: amount.toString(), closePeriod: closePeriod.toString() });
        const channel = expectOk(await consumer.openChannel(adaptorFullInfo, amount, closePeriod), "Failed to open channel in integration test");

        console.debug("Channel opened in integration test, now starting to poll adaptor for squash...");
      } else {
        console.debug("Found existing channel in consumer state, skipping channel opening and going straight to polling adaptor for squash...");
      }
      if(!channel) {
        throw new Error("Panic: Channel is null after attempting to open channel in integration test");
      }

      integrationTestEnv.saveKonduitConsumerState(consumer);
      let squashed = false;
      if(channel.isFullySquashed) {
        console.debug(`Channel with tag ${channel.channelTag} is already fully squashed!`);
        squashed = true;
      } else {
        consumer.subscribe("channel-squashed", ({ channel: squashedChannel }) => { 
          if(squashedChannel.channelTag === channel.channelTag) {
            console.debug(`Channel with tag ${channel.channelTag} was squashed!`);
            squashed = true;
          } else {
            console.debug(`Received squash event for channel with tag ${squashedChannel.channelTag}, but we are waiting for channel with tag ${channel.channelTag}`);
          }
        });
        await consumer.startPolling(Seconds.fromSmallNumber(1));
        // await till squashed
        const maxAttempts = 40;
        const delayMs = 3000;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          if(squashed) {
            break;
          }
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else {
            console.log(`Reached maximum attempts (${maxAttempts}) without channel being squashed.`);
            throw new Error("Channel was not squashed within the expected time frame in integration test");
          }
        }
      }

      const lnd = integrationTestEnv.mkLnd(test);

      // 100,000 millisatoshis = 100 satoshis ≈ $0.06 – $0.07 USD
      const msat = Millisatoshi.fromDigits(1, 0, 0, 0, 0, 0);
      const memo = `An invoice from integration test at ${new Date().toISOString()}`;

      const addInvoiceResult = await lnd.addLndInvoice(msat, memo);
      const addInvoiceResponse = expectOk(addInvoiceResult, "Failed to add invoice via LND in integration test");
      const invoice: Invoice = addInvoiceResponse.invoice;
      const quoteResult = await channel.adaptorClient.chQuote(invoice.raw);
      const quote = expectOk(quoteResult);
      console.debug("Received quote from adaptor for LND invoice:", quote);

      // const channel = consumer.channels[0];
      // export const fromKeyAndTag = (key: Ed25519VerificationKey, tag: ChannelTag): KeyTag => {

      // const invoiceString = "LNTB200N1P5ESD7WPP5EHV3J3A7HY0TJJQT82WK24S4NRR2RSZ352449YWTDZE44AZNNL8SDQQCQZZSXQRRSSSP5SD3UEUE8W8DK888Y2Z5DDNS3V6Q76Y85YXXSH77PRKCR4QRGK7YQ9QXPQYSGQRWQP4H0AW6NER76AZPHF5XPQRCLTMUFENP6QV2K8V9QM8ASQ599Y06F9X230Z2MNF4H9EG53PPA933FHPJMYKM6UXRWGYAAT728N9MQQNVSLE9" as InvoiceString;
      // const quoteResult2 = await channel.adaptorClient.chQuote(invoiceString);


    },
    600000
  );
});

describe("LND client basic integration", () => {
  it(
    "creates an invoice via LND addInvoice endpoint",
    async (test) => {
      test.skip();

      const lnd = integrationTestEnv.mkLnd(test);
      const msat = Millisatoshi.fromDigits(1, 0, 0, 0, 0);
      const memo = "integration-test-invoice";

      const result = await lnd.addLndInvoice(msat, memo);

      const response = expectOk(result);
      console.debug("Received invoice from LND:", response);
    },
    60000
  );
});
