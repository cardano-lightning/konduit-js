import type { Tagged } from "type-fest";
import { bech32 } from "@scure/base";
import { Result, err, ok } from "neverthrow";
import type { Ed25519PublicKey, Ed25519VerificationKey } from "@konduit/cardano-keys";
import * as uint8Array from "@konduit/cardano-keys/uint8Array";
import * as hexString from "@konduit/codec/hexString";
import * as codec from "@konduit/codec";
import { mkHexString2HashCodec } from "./keys";
import type { HexString } from "@konduit/codec/hexString";
import { json2StringCodec, type JsonError, type JsonCodec } from "@konduit/codec/json/codecs";
import { blake2b } from "@noble/hashes/blake2.js";
import { stringify, type Json } from "@konduit/codec/json";
import type { Iso } from "@konduit/codec";
import { mkOrdForUint8Array } from "@konduit/codec/tagged";
import { cbor2ByteStringCodec, mkTaggedBytesCborCodec, type CborCodec } from "@konduit/codec/cbor/codecs/sync";
import { NetworkMagicNumber, PublicNetwork } from "./ledger";

export type ScriptHash = Tagged<Uint8Array, "ScriptHash">;
export namespace ScriptHash {
  export const LENGTH = 28;
  export const fromBytes = (hash: Uint8Array): Result<ScriptHash, string> =>
    hash.length !== LENGTH ? err(`Invalid ScriptHash length: expected 28, got ${hash.length}`):ok(hash as ScriptHash);
  export const fromJson = (json: Json) => jsonCodec.deserialise(json);
  export const ord = mkOrdForUint8Array<ScriptHash>();
  export const hexStringCodec: codec.Codec<HexString, ScriptHash, JsonError> = mkHexString2HashCodec<ScriptHash>("ScriptHash", ScriptHash.LENGTH);
  export const jsonCodec: JsonCodec<ScriptHash> = codec.pipe(hexString.jsonCodec, hexStringCodec);
  export const cborCodec: CborCodec<ScriptHash> = mkTaggedBytesCborCodec<ScriptHash>(
    "ScriptHash",
    (arr) => arr.length === ScriptHash.LENGTH
  );
}
export type PubKeyHash = Tagged<Uint8Array, "PubKeyHash">;
export namespace PubKeyHash {
  export const fromPubKey = (pubKey: Ed25519PublicKey): PubKeyHash => {
    return blake2b(pubKey, { dkLen: ScriptHash.LENGTH }) as PubKeyHash;
  }
  export const fromBytes = (hash: Uint8Array) =>
    hash.length !== ScriptHash.LENGTH?err(`Invalid PubKeyHash length: expected 28, got ${hash.length}`):ok(hash as PubKeyHash);
  export const fromJson = (json: Json) => json2PubKeyHashCodec.deserialise(json);
}
export const hexString2PubKeyHashCodec = mkHexString2HashCodec<PubKeyHash>("PubKeyHash", ScriptHash.LENGTH);
export const json2PubKeyHashCodec = codec.pipe(
  hexString.jsonCodec,
  hexString2PubKeyHashCodec
);

export type Credential =
  | { type: "ScriptHash"; hash: ScriptHash }
  | { type: "PubKeyHash"; hash: PubKeyHash };

export type Network = Tagged<"mainnet" | "testnet", "Network">;
export namespace Network {
  export const fromNetworkMagicNumber = (networkMagicNumber: NetworkMagicNumber): Network => {
    if(networkMagicNumber !== NetworkMagicNumber.MAINNET) return TESTNET;
    return MAINNET;
  }
  export const fromPublicNetwork = (publicNetwork: PublicNetwork): Network => {
    switch(publicNetwork) {
      case "Mainnet":
        return MAINNET;
      case "Preprod":
      case "Preview":
        return TESTNET;
    }
  }
  export const MAINNET: Network = "mainnet" as Network;
  export const TESTNET: Network = "testnet" as Network;
}

export type Address = {
  network: Network;
  paymentCredential: Credential;
  stakingCredential?: Credential;
}
export namespace Address {
  export const fromString = (addressStr: string) => Address.stringCodec.deserialise(addressStr);
  export const fromEd25519VerificationKeys = (
    network: Network,
    paymentEd25519VerificationKey: Ed25519VerificationKey,
    stakingEd25519VerificationKey?: Ed25519VerificationKey,
  ): Address => {
    const paymentPubKeyHash = PubKeyHash.fromPubKey(paymentEd25519VerificationKey.key);
    const paymentCredential: Credential = { type: "PubKeyHash", hash: paymentPubKeyHash };
    let stakingCredential: Credential | undefined = (() => {
      if (stakingEd25519VerificationKey) {
        const stakingPubKeyHash = PubKeyHash.fromPubKey(stakingEd25519VerificationKey.key);
        return { type: "PubKeyHash", hash: stakingPubKeyHash };
      } else {
        return undefined;
      }
    })();
    return {
      network,
      paymentCredential,
      stakingCredential
    };
  }

  // Address header is 1 byte
  export const HEADER_LEN = 1;
  // hrp_len = max(len("addr_test", "addr")) = 9
  // 9 (hrp_len) + 1 (separator "1") + ~92 (8 bit char representing 5 bit word (ceil(8/5 * (2 * 28 + 1)) = 92)) + 6 (checksum) = ~108 chars
  export const MAX_BECH32_LEN = 108;

  export const uint8ArrayCodec = {
    deserialise: (data: Uint8Array): Result<Address, string> => {
      // header byte: t | t | t | t | n | n | n | n
      const headerByte = data[0]!;

      const possibleCredentials = (() => {
        const addressTypeNibble = (headerByte & 0xf0) >> 4;
        const paymentHash = data.slice(HEADER_LEN, HEADER_LEN + ScriptHash.LENGTH);
        const stakingHash = data.slice(HEADER_LEN + ScriptHash.LENGTH);
        if (addressTypeNibble >= 0x00 && addressTypeNibble <= 0x03) {
          const expectedLen = HEADER_LEN + 2 * ScriptHash.LENGTH;
          if(data.length !== expectedLen) return err(`Invalid address length for type 0x00-0x03: expected ${expectedLen}, got ${data.length}`);
          if (addressTypeNibble === 0x00) {
            return ok([
              { type: "PubKeyHash", hash: paymentHash as PubKeyHash },
              { type: "PubKeyHash", hash: stakingHash as PubKeyHash }
            ]);
          } else if (addressTypeNibble === 0x01) {
            return ok ([
              { type: "ScriptHash", hash: paymentHash as ScriptHash },
              { type: "PubKeyHash", hash: stakingHash as PubKeyHash }
            ]);
          } else if (addressTypeNibble === 0x02) {
            return ok ([
              { type: "PubKeyHash", hash: paymentHash as PubKeyHash },
              { type: "ScriptHash", hash: stakingHash as ScriptHash }
            ]);
          } else /* (addressTypeNibble === 0x03) */ {
            return ok ([
              { type: "ScriptHash", hash: paymentHash as ScriptHash },
              { type: "ScriptHash", hash: stakingHash as ScriptHash }
            ]);
          }
        } else if(addressTypeNibble === 0x06 || addressTypeNibble === 0x07) {
          if(stakingHash.length !== 0) {
            return err(`Invalid staking credential length for type 0x06/0x07: expected 0, got ${stakingHash.length}`);
          }
          const expectedLen = HEADER_LEN + ScriptHash.LENGTH;
          if(data.length !== expectedLen) return err(`Invalid address length for type 0x06/0x07: expected ${expectedLen}, got ${data.length}`);
          if (addressTypeNibble === 0x06) {
            return ok ([
              { type: "PubKeyHash", hash: paymentHash as PubKeyHash },
              null
            ]);
          } else /* (addressTypeNibble === 0x07) */ {
            return ok ([
              { type: "ScriptHash", hash: paymentHash as ScriptHash },
              null
            ]);
          }
        }
        return err(`Pointer addresses (type nibble 0x04 and 0x05) are not supported.`);
      })();
      const networkNibble = headerByte & 0x0f;
      const possibleNetwork = (() => {
        if (networkNibble === 0x00) return ok(Network.TESTNET);
        if (networkNibble === 0x01) return ok(Network.MAINNET);
        return err(`Invalid network nibble in address header: expected 0x00 or 0x01, got ${networkNibble}`);
      })();
      return Result.combine([possibleNetwork, possibleCredentials]).andThen(([network, [paymentCredential, stakingCredential]]) => {
        return ok({
          network,
          paymentCredential,
          stakingCredential: stakingCredential === null ? undefined : stakingCredential
        } as Address);
      });
    },
    serialise: (address: Address): Uint8Array => {
      // The second nibble of the header byte
      const networkNibble = address.network === Network.MAINNET ? 0x01 : 0x00;
      // cip-19
      // (0) 0000.... PaymentKeyHash  StakeKeyHash
      // (1) 0001.... ScriptHash      StakeKeyHash
      // (2) 0010.... PaymentKeyHash  ScriptHash
      // (3) 0011.... ScriptHash      ScriptHash
      //
      // # We do not support those two:
      // (4) 0100.... PaymentKeyHash  Pointer
      // (5) 0101.... ScriptHash      Pointer
      //
      // (6) 0110.... PaymentKeyHash  ø
      // (7) 0111.... ScriptHash      ø
      const addressTypeNibble = ((): number => {
        const paymentType = address.paymentCredential.type;
        const stakingType = address.stakingCredential? address.stakingCredential.type : null;
        if (paymentType === "PubKeyHash" && stakingType === "PubKeyHash") return 0x00;
        if (paymentType === "ScriptHash" && stakingType === "PubKeyHash") return 0x01;
        if (paymentType === "PubKeyHash" && stakingType === "ScriptHash") return 0x02;
        if (paymentType === "ScriptHash" && stakingType === "ScriptHash") return 0x03;
        if (paymentType === "PubKeyHash" && stakingType === null) return 0x06;
        else // (paymentType === "ScriptHash" && stakingType === null)
          return 0x07;
      })();
      // header byte: t | t | t | t | n | n | n | n
      const headerByte = (addressTypeNibble << 4) | networkNibble;
      const paymentHash = address.paymentCredential.hash;
      const stakingHash = address.stakingCredential? address.stakingCredential.hash : new Uint8Array();
      return uint8Array.concat([new Uint8Array([headerByte]), paymentHash, stakingHash]);
    }
  }

  // Arbitrary string to Address codec
  export const stringCodec: codec.Codec<string, Address, JsonError> = {
    deserialise: (value: string): Result<Address, JsonError> => {
      const result = bech32.decodeUnsafe(value, MAX_BECH32_LEN);
      // The library types the return value wrongly: `void | ...` and the
      // only way which I found working to narrow `void` result is this:
      if(!result) return err("Invalid bech32 address. Decoding failed.");
      const { prefix: bech32Prefix, words } = result;
      if(words.length === 0) return err("Invalid bech32 address. No data words found.");
      const bytes = new Uint8Array(bech32.fromWords(words));
      return uint8ArrayCodec.deserialise(bytes).andThen((address) => {
        const addressPrefix = (address.network === Network.MAINNET ? "addr" : "addr_test");
        if((bech32Prefix !== addressPrefix)) {
          return err(`Invalid address prefix for network.network}. Received bech32Prefix ${bech32Prefix} but address bytes encoded network ${address.network} which should have prefix ${addressPrefix}`);
        }
        return ok(address);
      });
    },
    serialise: (address: Address): string => AddressBech32.fromAddress(address) as string
  }
  export const jsonCodec: JsonCodec<Address> = codec.pipe(
    json2StringCodec,
    stringCodec,
  );
  export const cborCodec: CborCodec<Address> = codec.pipe(
    cbor2ByteStringCodec,
    uint8ArrayCodec,
  );
};

// String which is a checked bech32 encoded address
export type AddressBech32 = Tagged<string, "AddressBech32">;
export namespace AddressBech32 {
  export const fromString = (addressStr: string): Result<AddressBech32, JsonError> => Address.stringCodec.deserialise(addressStr).map((addr) => fromAddress(addr));
  export const fromAddress = (address: Address): AddressBech32 => {
    const dataPart = Address.uint8ArrayCodec.serialise(address);
    // 5 bit words (padded at the end)
    const dataPartWords = bech32.toWords(dataPart);
    // bech32 encoding:
    const humanReadablePart = address.network === Network.MAINNET ? "addr" : "addr_test";
    return bech32.encode(humanReadablePart, dataPartWords, Address.MAX_BECH32_LEN) as AddressBech32;
  }
}

export const address2AddressBech32Iso: Iso<Address, AddressBech32> = {
  into: (address: Address): AddressBech32 => AddressBech32.fromAddress(address),
  from: (bech32Str: AddressBech32): Address => {
    const result = Address.stringCodec.deserialise(bech32Str as string);
    return result.match(
      (addrBech32) =>  addrBech32,
      (error) => {
        // This should never happen as `AddressBech32` is only constructed from a valid Address.
        throw new Error(`Panic: unable to convert AddressBech32 to Address: ${stringify(error)}, addressStr: ${bech32Str}`);
      }
    );
  }
}

