import { describe, expect, it } from "vitest";
import * as fs from "fs";
import { json2KonduitConsumerAsyncCodec, KonduitConsumer } from "../src";
import { AdaptorFullInfo } from "../src/adaptorClient";
import { Days, Milliseconds, Seconds } from "../src/time/duration";
import { Address, AddressBech32, Network, PubKeyHash } from "../src/cardano";
import { Ada } from "../src/cardano/assets";
import { parse, stringify, type Json } from "@konduit/codec/json";
import { expectNotNull, expectOk } from "./assertions";
import { HexString } from "@konduit/codec/hexString";
import { Ed25519PrivateKey } from "@konduit/cardano-keys";
import * as hexString from "@konduit/codec/hexString";
import * as wasm from "../wasm/konduit_wasm.js";
import { Connector } from "../src/cardano/connector";
import { BlockfrostWallet, type AnyWallet } from "../src/wallets/embedded";
import { Ed25519Secret } from "@konduit/cardano-keys/rfc8032";
import { hoistToResultAsync, promiseToResultAsync, resultAsyncToPromise } from "../src/neverthrow";
import { mkLndClient, type LndClient } from "../src/bitcoin/lndClient";
import { Millisatoshi } from "../src/bitcoin/asset";
import { Lovelace } from "../src/cardano";
import { ValidDate } from "../src/time/absolute";
import { AnyPayment } from "../src/channel";
import * as connectorClient from "../src/cardano/connectorClient";

export const integrationTestEnv = (() => {
  const adaptorUrlOpt = import.meta.env.VITE_TEST_ADAPTOR_URL;
  const backendUrlOpt = import.meta.env.VITE_TEST_CONNECTOR_URL;
  const signingKeySecretOpt = import.meta.env.VITE_TEST_SIGNING_KEY_SECRET;
  const blockfrostProjectIdOpt = import.meta.env.VITE_TEST_BLOCKFROST_PROJECT_ID;
  const konduitConsumerStateFile = import.meta.env.VITE_TEST_KONDUIT_CONSUMER_STATE_FILE;
  const lndMacaroonOpt = import.meta.env.VITE_TEST_LND_INVOICING_MACAROON;
  const lndBaseUrlOpt = import.meta.env.VITE_TEST_LND_INVOICING_BASE_URL;

  const mkKonduitConsumer = async (t: any): Promise<KonduitConsumer<AnyWallet>> => {
    if(!konduitConsumerStateFile) {
      t.skip();
    }
    if(fs.existsSync(konduitConsumerStateFile)) {
      const fileContent: string = fs.readFileSync(konduitConsumerStateFile, "utf-8");
      return expectOk(await resultAsyncToPromise(hoistToResultAsync(parse(fileContent)).andThen((json) => {
        const result = (async () => {
          const result = await json2KonduitConsumerAsyncCodec.deserialise(json);
          result.mapErr((e) => console.error(stringify(e)));
          return result;
        })();
        return promiseToResultAsync(result);
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
    return { address, addressBech32, privateKey, sKey, vKey };
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

  const mkConnectorClient = async (t: any) => {
    if(!backendUrlOpt) {
      t.skip();
    }
    const backendUrlStr = expectNotNull(backendUrlOpt);
    return connectorClient.mkConnectorClient(backendUrlStr);
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
    mkConnectorClient,
    saveKonduitConsumerState,
    mkLnd,
  };
})();

describe("End-to-end integration: open channel and poll adaptor squash", () => {
  it(
    "opens a channel and polls adaptor squash endpoint until it is indexed",
    async (test) => {
      test.skip();

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
        channel = expectOk(await consumer.openChannel(adaptorFullInfo, amount, closePeriod), "Failed to open channel in integration test");

        console.debug("Channel opened in integration test, now starting to poll adaptor for squash...");
      } else {
        console.debug("Found existing channel in consumer state, skipping channel opening and going straight to polling adaptor for squash...");
      }

      integrationTestEnv.saveKonduitConsumerState(consumer);
      let squashed = false;
      if(channel.isOperational && channel.isFullySubmitted) {
        console.debug(`Channel with tag ${channel.channelTag} is already fully squashed!`);
        squashed = true;
      } else {
        const unsubscribeFromChannelSquashed = consumer.subscribe("channel-squashed", ({ channel: squashedChannel }) => { 
          if(squashedChannel.channelTag === channel.channelTag) {
            console.debug(`Channel with tag ${channel.channelTag} was squashed!`);
            squashed = true;
          } else {
            console.debug(`Received squash event for channel with tag ${squashedChannel.channelTag}, but we are waiting for channel with tag ${channel.channelTag}`);
          }
        });
        const unsubscribeFromChannelSquashFailed = consumer.subscribe("channel-squashing-failed", ({ channel: failedChannel, error }) => {
          if(failedChannel.channelTag === channel.channelTag) {
            console.error(`Squash failed for channel with tag ${channel.channelTag}. The error details: ${stringify(error as Json)}`);
          } else {
            console.debug(`Received squash failure event for channel with tag ${failedChannel.channelTag}, but we are waiting for channel with tag ${channel.channelTag}`);
          }
        });
        await consumer.startPolling(Seconds.fromSmallNumber(1));
        // await till squashed
        const maxAttempts = 40;
        const delayMs = 3000;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          if(squashed) {
            console.debug(`Channel with tag ${channel.channelTag} is squashed after ${attempt} attempts!`);
            console.debug(`Leaving the loop that polls for channel squash, and proceeding with the rest of the integration test...`);
            break;
          }
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else {
            console.log(`Reached maximum attempts (${maxAttempts}) without channel being squashed.`);
            throw new Error("Channel was not squashed within the expected time frame in integration test");
          }
        }
        consumer.stopPolling();
        unsubscribeFromChannelSquashed();
        unsubscribeFromChannelSquashFailed();
      }
      integrationTestEnv.saveKonduitConsumerState(consumer);

      console.debug("Channel is squashed, now creating invoice via LND and paying via adaptor...");
      const lnd = integrationTestEnv.mkLnd(test);


      squashed = false;
      const unsubscribeFromChannelSquashed = consumer.subscribe("channel-squashed", ({ channel: squashedChannel }) => { 
        if(squashedChannel.channelTag === channel.channelTag) {
          console.debug(`Channel with tag ${channel.channelTag} is squashed after payment!`);
          squashed = true;
        } else {
          console.debug(`Received squash event for channel with tag ${squashedChannel.channelTag}, but we are waiting for channel with tag ${channel.channelTag}`);
        }
      });

      const unsubscribeFromChannelSquashFailed = consumer.subscribe("channel-squashing-failed", ({ channel: failedChannel, error }) => {
        if(failedChannel.channelTag === channel.channelTag) {
          console.error(`Squash failed for channel with tag ${channel.channelTag} after payment. The error details: ${stringify(error as Json)}`);
        } else {
          console.debug(`Received squash failure event for channel with tag ${failedChannel.channelTag}, but we are waiting for channel with tag ${channel.channelTag}`);
        }
      });
      await consumer.startPolling(Seconds.fromSmallNumber(1));

      const maxAttempts = 40;
      const delayMs = 3000;

      // 100,000 millisatoshis = 100 satoshis ≈ $0.06 – $0.07 USD
      const msat = Millisatoshi.fromDigits(1, 0, 0, 0, 0, 0);
      const memo = `An invoice from konduit-js integration test at ${new Date().toISOString()}`;
      const { invoice } = expectOk(await lnd.addLndInvoice(msat, memo), "Failed to add invoice via LND in integration test");
      const quoteResult = await channel.adaptorClient.chQuote(invoice.raw);
      const quote = expectOk(quoteResult);
      console.debug("Received quote from adaptor for LND invoice:", quote);
      const timeout = expectOk(ValidDate.addMilliseconds(ValidDate.now(), quote.relativeTimeout));
      const payResult = await channel.doPay(quote.amount, timeout, invoice, keys.sKey);

      integrationTestEnv.saveKonduitConsumerState(consumer);
      console.log("Received pay response from channel.pay:", payResult);
      payResult.match(
        (payment) => {
          if(AnyPayment.isPending(payment)) {
            console.debug(`Payment failed - the cheque was issued but there was a processing error:`);
            console.debug(stringify(payment as any as Json));
          } else {
            console.log("Payment succeeded, cheque was issued and processed successfully!");
          }
        },
        (error) => {
          console.log("Payment failed completely - the cheque was not even issued:");
          console.error(stringify(error as Json));
        }
      );

      // await till squashed
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if(squashed) {
          console.debug(`Channel with tag ${channel.channelTag} is squashed after payment, and after ${attempt} attempts!`);
          console.debug(`Leaving the loop that polls for channel squash, and proceeding with the rest of the integration test...`);
          break;
        }
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          console.log(`Reached maximum attempts (${maxAttempts}) without channel being squashed after payment.`);
          throw new Error("Channel was not squashed within the expected time frame after payment in integration test");
        }
      }
      integrationTestEnv.saveKonduitConsumerState(consumer);
      consumer.stopPolling();
      unsubscribeFromChannelSquashed();
      unsubscribeFromChannelSquashFailed();

      expect(channel.isFullySquashed).toBe(true);
      expect(squashed).toBe(true);
    },
    600000
  );
  /*
  it("opens a channels and confirms its presence on the chain", async (test) => {
    // "channel-tx-confirmed": { channel: Channel; txId: TxId };

    let txId = null;
    let channelTag: ChannelTag | null = null;
    // Subscribe to the confirmation event and then open the channel.
    const consumer = await integrationTestEnv.mkKonduitConsumer(test);
    // We have to subscribe first before the channel is actually opened to not miss the event.
    const unsubscribeFromChannelTxConfirmed = consumer.subscribe("channel-tx-confirmed", ({ channel: confirmedChannel, txId: confirmedTxId }) => {
      if(confirmedChannel.channelTag === channelTag) {
        console.debug(`Channel with tag ${channelTag} has a confirmed transaction with txId ${confirmedTxId}!`);
        txId = confirmedTxId;
      } else {
        console.debug(`Received transaction confirmation event for channel with tag ${confirmedChannel.channelTag}, but we are waiting for channel with tag ${channel.channelTag}`);
      }
    });

  //   const adaptorFullInfo = await integrationTestEnv.mkAdaptorFullInfo(test);
  //   const amount = Lovelace.fromAda(Ada.fromSmallNumber(3));
  //   const closePeriod = Milliseconds.fromAnyPreciseDuration({ type: "days", value: Days.fromSmallNumber(3) });
  //   const channel = expectOk(await consumer.openChannel(adaptorFullInfo, amount, closePeriod), "Failed to open channel in integration test");
  //   channelTag = channel.channelTag;

  //   const maxAttempts = 40;
  //   const delayMs = 3000;
  //   for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  //     if(txId) {
  //       console.debug(`Channel with tag ${channel.channelTag} has a confirmed transaction with txId ${txId} after ${attempt} attempts!`);
  //       console.debug(`Leaving the loop that polls for transaction confirmation, and proceeding with the rest of the integration test...`);
  //       break;
  //     }
  //     if (attempt < maxAttempts) {
  //       await new Promise((resolve) => setTimeout(resolve, delayMs));
  //     } else {
  //       console.log(`Reached maximum attempts (${maxAttempts}) without channel transaction being confirmed.`);
  //       throw new Error("Channel transaction was not confirmed within the expected time frame in integration test");
  //     }
  //   }
  //   expect(txId).not.toBeNull();
  //   console.log(`Channel transaction with txId ${txId} is confirmed on chain!`);
  //   unsubscribeFromChannelTxConfirmed();
  }, 300000);
  */
});

describe("Native TS connector client", (_test) => {
  it("queries a balance of the testing wallet", async (test) => {
    const connectorClient = await integrationTestEnv.mkConnectorClient(test);
    const keys = integrationTestEnv.mkKeys(test);
    const balanceResult = await connectorClient.balance(keys.address);
    expectOk(balanceResult, "Failed to query balance via connector client in integration test");
  });
  it("queries the network magic number", async (test) => {
    const connectorClient = await integrationTestEnv.mkConnectorClient(test);
    const networkResult = await connectorClient.network();
    expectOk(networkResult, "Failed to query network magic number via connector client in integration test");
  });
  it("queries the health endpoint", async (test) => {
    const connectorClient = await integrationTestEnv.mkConnectorClient(test);
    const healthResult = await connectorClient.health();
    expectOk(healthResult, "Failed to query health endpoint via connector client in integration test");
  });
  it("queries the utxos at the testing wallet address", async (test) => {
    const connectorClient = await integrationTestEnv.mkConnectorClient(test);
    const keys = integrationTestEnv.mkKeys(test);
    const utxosResult = await connectorClient.utxosAt(keys.address);
    expectOk(utxosResult, "Failed to query utxos at address via connector client in integration test");
  });
  it("queries the transaction details for a transaction involving the testing wallet", async (test) => {
    const connectorClient = await integrationTestEnv.mkConnectorClient(test);
    const keys = integrationTestEnv.mkKeys(test);
    const utxosResult = await connectorClient.utxosAt(keys.address);
    const utxos = expectOk(utxosResult, "Failed to query utxos at address via connector client in integration test");
    expect(utxos.length).toBeGreaterThan(0);
    const firstUtxo = utxos[0]!;
    const transactionId = firstUtxo.transaction_id;
    const transactionResult = await connectorClient.transaction(transactionId);
    expectOk(transactionResult, "Failed to query transaction details via connector client in integration test");
  });
});

