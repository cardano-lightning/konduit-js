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
import { PositiveBigInt } from "@konduit/codec/integers/big";
import type { Iso } from "@konduit/codec";

// Credential hash length
const HASH_LEN = 28;

export type ScriptHash = Tagged<Uint8Array, "ScriptHash">;
export namespace ScriptHash {
  export const fromBytes = (hash: Uint8Array) =>
    hash.length !== HASH_LEN ? err(`Invalid ScriptHash length: expected 28, got ${hash.length}`):ok(hash as ScriptHash);
  export const fromJson = (json: Json) => json2ScriptHashCodec.deserialise(json);
}
export const hexString2ScriptHashCodec: codec.Codec<HexString, ScriptHash, JsonError> = mkHexString2HashCodec<ScriptHash>("ScriptHash", HASH_LEN);
export const json2ScriptHashCodec = codec.pipe(
  hexString.jsonCodec,
  hexString2ScriptHashCodec
);

export type PubKeyHash = Tagged<Uint8Array, "PubKeyHash">;
export namespace PubKeyHash {
  export const fromPubKey = (pubKey: Ed25519PublicKey): PubKeyHash => {
    return blake2b(pubKey, { dkLen: HASH_LEN }) as PubKeyHash;
  }
  export const fromBytes = (hash: Uint8Array) =>
    hash.length !== HASH_LEN?err(`Invalid PubKeyHash length: expected 28, got ${hash.length}`):ok(hash as PubKeyHash);
  export const fromJson = (json: Json) => json2PubKeyHashCodec.deserialise(json);
}
export const hexString2PubKeyHashCodec = mkHexString2HashCodec<PubKeyHash>("PubKeyHash", HASH_LEN);
export const json2PubKeyHashCodec = codec.pipe(
  hexString.jsonCodec,
  hexString2PubKeyHashCodec
);

export type Credential =
  | { type: "ScriptHash"; hash: ScriptHash }
  | { type: "PubKeyHash"; hash: PubKeyHash };

export type NetworkMagicNumber = Tagged<PositiveBigInt, "NetworkMagicNumber">;
export namespace NetworkMagicNumber {
  export const fromPositiveBigInt = (v: PositiveBigInt): NetworkMagicNumber => v as NetworkMagicNumber;
  export const MAINNET = 764824073n as NetworkMagicNumber;
  export const PREPROD = 1n as NetworkMagicNumber;
  export const PREVIEW = 2n as NetworkMagicNumber;
}

export type Network = Tagged<"mainnet" | "testnet", "Network">;
export namespace Network {
  export const fromNetworkMagicNumber = (networkMagicNumber: NetworkMagicNumber): Network => {
    if(networkMagicNumber !== NetworkMagicNumber.MAINNET) return TESTNET;
    return MAINNET;
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
  export const fromString = (addressStr: string) => string32ToAddressCodec.deserialise(addressStr);
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
}

// Address header is 1 byte
const HEADER_LEN = 1;
// hrp_len = max(len("addr_test", "addr")) = 9
// 9 (hrp_len) + 1 (separator "1") + ~92 (8 bit char representing 5 bit word (ceil(8/5 * (2 * 28 + 1)) = 92)) + 6 (checksum) = ~108 chars
const MAX_BECH32_LEN = 108;

// Arbitrary string to Address codec
export const string32ToAddressCodec: codec.Codec<string, Address, JsonError> = {
  deserialise: (value: string): Result<Address, JsonError> => {
    const result = bech32.decodeUnsafe(value, MAX_BECH32_LEN);
    // The library types the return value wrongly: `void | ...` and the
    // only way which I found working to narrow `void` result is this:
    if(!result) return err("Invalid bech32 address. Decoding failed.");
    const { prefix, words } = result;
    if(words.length === 0) return err("Invalid bech32 address. No data words found.");
    const data = new Uint8Array(bech32.fromWords(words));
    // header byte: t | t | t | t | n | n | n | n
    const headerByte = data[0]!;
    return Result.combine([
      (() => {
        const networkNibble = headerByte & 0x0f;
        const network: Network = (networkNibble === 0x00 ? Network.TESTNET : Network.MAINNET);
        const expectedPrefix = (network === Network.MAINNET ? "addr" : "addr_test");
        if((prefix !== expectedPrefix)) {
          return err(`Invalid address prefix for network ${network}: expected ${expectedPrefix}, got ${prefix}`);
        }
        return ok(network);
      })(),
      ((): Result<[Credential, Credential | null ], string> => {
        const addressTypeNibble = (headerByte & 0xf0) >> 4;
        const paymentHash = data.slice(HEADER_LEN, HEADER_LEN + HASH_LEN);
        const stakingHash = data.slice(HEADER_LEN + HASH_LEN);
        if (addressTypeNibble >= 0x00 && addressTypeNibble <= 0x03) {
          const expectedLen = HEADER_LEN + 2 * HASH_LEN;
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
          const expectedLen = HEADER_LEN + HASH_LEN;
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
      })()
    ]).andThen(([network, [paymentCredential, stakingCredential]]) => {
        return ok({
          network,
          paymentCredential,
          stakingCredential: stakingCredential === null ? undefined : stakingCredential
        } as Address);
    });
  },
  serialise: (value: Address): string => AddressBech32.fromAddress(value) as string,
};
export const json2AddressCodec: JsonCodec<Address> = codec.pipe(
  json2StringCodec,
  string32ToAddressCodec,
);

// String which is a checked bech32 encoded address
export type AddressBech32 = Tagged<string, "AddressBech32">;
export namespace AddressBech32 {
  export const fromString = (addressStr: string): Result<AddressBech32, JsonError> => string32ToAddressCodec.deserialise(addressStr).map((addr) => fromAddress(addr));
  export const fromAddress = (address: Address): AddressBech32 => {
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
    // bech32 encoding:
    const humanReadablePart = address.network === Network.MAINNET ? "addr" : "addr_test";
    const dataPart = (() => {
      const paymentHash = address.paymentCredential.hash;
      const stakingHash = address.stakingCredential? address.stakingCredential.hash : new Uint8Array();
      return uint8Array.concat([new Uint8Array([headerByte]), paymentHash, stakingHash]);
    })();
    // 5 bit words (padded at the end)
    const dataPartWords = bech32.toWords(dataPart);
    return bech32.encode(humanReadablePart, dataPartWords, MAX_BECH32_LEN) as AddressBech32;
  }
}

export const address2AddressBech32Iso: Iso<Address, AddressBech32> = {
  into: (address: Address): AddressBech32 => AddressBech32.fromAddress(address),
  from: (bech32Str: AddressBech32): Address => {
    const result = string32ToAddressCodec.deserialise(bech32Str as string);
    return result.match(
      (addrBech32) =>  addrBech32,
      (error) => {
        // This should never happen as `AddressBech32` is only constructed from a valid Address.
        throw new Error(`Panic: unable to convert AddressBech32 to Address: ${stringify(error)}, addressStr: ${bech32Str}`);
      }
    );
  }
}
