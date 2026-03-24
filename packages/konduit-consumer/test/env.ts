import * as fs from "fs";
import { json2KonduitConsumerCodec, KonduitConsumer } from "../src";
import { AdaptorFullInfo } from "../src/adaptorClient";
import { Address, AddressBech32, Network, NetworkMagicNumber, PubKeyHash, PublicNetwork } from "../src/cardano";
import { parse, stringify } from "@konduit/codec/json";
import { expectNotNull, expectOk } from "./assertions";
import { HexString } from "@konduit/codec/hexString";
import { Ed25519PrivateKey } from "@konduit/cardano-keys";
import * as hexString from "@konduit/codec/hexString";
// import { Connector } from "../src/cardano/connector";
import { BlockfrostWallet, CardanoConnectorWallet, type AnyWallet } from "../src/wallets/embedded";
import { Ed25519Secret } from "@konduit/cardano-keys/rfc8032";
import { hoistToResultAsync, promiseToResultAsync, resultAsyncToPromise } from "../src/neverthrow";
import { mkLndClient, type LndClient } from "../src/bitcoin/lndClient";
import * as connectorClient from "../src/cardano/connectorClient";
import { json2PositiveBigIntThroughStringCodec } from "@konduit/codec/integers/big";

export const adaptorUrlOpt = import.meta.env.VITE_TEST_ADAPTOR_URL;
export const backendUrlOpt = import.meta.env.VITE_TEST_CONNECTOR_URL;
export const networkMagicOpt = import.meta.env.VITE_TEST_NETWORK_MAGIC;
export const networkPublicNameOpt = import.meta.env.VITE_TEST_PUBLIC_NETWORK;
export const signingKeySecretOpt = import.meta.env.VITE_TEST_SIGNING_KEY_SECRET;
export const blockfrostProjectIdOpt = import.meta.env.VITE_TEST_BLOCKFROST_PROJECT_ID;
export const konduitConsumerStateFile = import.meta.env.VITE_TEST_KONDUIT_CONSUMER_STATE_FILE;
export const lndMacaroonOpt = import.meta.env.VITE_TEST_LND_INVOICING_MACAROON;
export const lndBaseUrlOpt = import.meta.env.VITE_TEST_LND_INVOICING_BASE_URL;

export type WalletBackendType = "blockfrost" | "cardano-connector";

export const readOrSkipKonduitConsumer = async (t: any, walletBackend: WalletBackendType): Promise<KonduitConsumer<AnyWallet>> => {
  if(!konduitConsumerStateFile) {
    t.skip();
  }
  if(fs.existsSync(konduitConsumerStateFile)) {
    const fileContent: string = fs.readFileSync(konduitConsumerStateFile, "utf-8");
    return expectOk(await resultAsyncToPromise(hoistToResultAsync(parse(fileContent)).andThen((json) => {
      const result = (async () => {
        const result = json2KonduitConsumerCodec.deserialise(json);
        result.mapErr((e) => console.error(stringify(e)));
        return result;
      })();
      return promiseToResultAsync(result);
    })));
  } else {
    if(walletBackend === "blockfrost") {
      const blockfrostWallet = await readOrSkipBlockfrostWallet(t);
      const keys = readOrSkipKeys(t);
      const connector = readOrSkipConnectorClient(t);
      const publicNetwork = readOrSkipPublicNetwork(t);
      return new KonduitConsumer(keys.privateKey, connector.baseUrl, publicNetwork, blockfrostWallet);
    } else {
      const connectorWallet = await readOrSkipCardanoConnectorWallet(t);
      const keys = readOrSkipKeys(t);
      const connector = readOrSkipConnectorClient(t);
      const publicNetwork = readOrSkipPublicNetwork(t);
      return new KonduitConsumer(keys.privateKey, connector.baseUrl, publicNetwork, connectorWallet);
    }
  }
}

export const saveKonduitConsumerState = (consumer: KonduitConsumer<AnyWallet>) => {
  if(!konduitConsumerStateFile) {
    throw new Error("Konduit consumer state file path not set in environment variable VITE_TEST_KONDUIT_CONSUMER_STATE_FILE");
  }
  const serialised = json2KonduitConsumerCodec.serialise(consumer);
  const jsonString = stringify(serialised);
  fs.writeFileSync(konduitConsumerStateFile, jsonString, "utf-8");
}

// In this testing, and small context we allow *some* vague typing.
export const readOrSkipKeys = (t: any) => {
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

export const readOrSkipBlockfrostWallet = async (t: any) => {
  if(!blockfrostProjectIdOpt) {
    t.skip();
  }
  const blockfrostProjectId = expectNotNull(blockfrostProjectIdOpt);
  const { privateKey } = readOrSkipKeys(t);
  const walletBackend = expectOk(await BlockfrostWallet.fromPrivateKey(blockfrostProjectId, privateKey));
  return walletBackend;
}

export const readOrSkipCardanoConnectorWallet = async (t: any) => {
  const { privateKey } = readOrSkipKeys(t);
  const connector = readOrSkipConnectorClient(t);
  const publicNetwork = readOrSkipPublicNetwork(t);
  const networkMagic = NetworkMagicNumber.fromPublicNetwork(publicNetwork);
  const walletBackend = CardanoConnectorWallet.fromPrivateKey(connector, networkMagic, privateKey);
  return walletBackend;
}


export const readOrSkipPublicNetwork = (t: any): PublicNetwork => {
  if(!networkPublicNameOpt) {
    t.skip();
  }
  const networkPublicName = expectNotNull(networkPublicNameOpt);
  const publicNetworkResult = PublicNetwork.fromString(networkPublicName);
  return expectOk(publicNetworkResult);
}

export const readOrSkipCardanoNetworkMagic = (t: any): NetworkMagicNumber => {
  if(!networkMagicOpt) {
    t.skip();
  }
  const networkMagicStr = expectNotNull(networkMagicOpt);
  return expectOk(
    json2PositiveBigIntThroughStringCodec
      .deserialise(networkMagicStr)
      .map(NetworkMagicNumber.fromPositiveBigInt)
  );
};

export const readOrSkipConnectorClient = (t: any): connectorClient.ConnectorClient => {
  if(!backendUrlOpt) {
    t.skip();
  }
  const backendUrlStr: string = expectNotNull(backendUrlOpt);
  console.log(typeof backendUrlStr, backendUrlStr);
  return connectorClient.mkConnectorClient(backendUrlStr);
}

export const readOrSkipAdaptorFullInfo = async (t: any) => {
  if(!adaptorUrlOpt) {
    t.skip();
  }
  const adaptorUrlStr = expectNotNull(adaptorUrlOpt);
  const adaptorFullInfo = expectOk(await AdaptorFullInfo.fromString(adaptorUrlStr));
  return adaptorFullInfo;
}

export const readOrSkipLnd = (t: any): LndClient => {
  if (!lndBaseUrlOpt || !lndMacaroonOpt) {
    t.skip();
  }
  const baseUrl = expectNotNull(lndBaseUrlOpt);
  const macaroon = expectNotNull(lndMacaroonOpt);
  return mkLndClient({ baseUrl, macaroon });
}

