import type { Network } from "@konduit/bln/network";
import type { Tagged } from "type-fest";
import { Result, err, ok } from "neverthrow";
import { type JsonCodec, type JsonError } from "@konduit/codec/json/codecs";
import type { Millisatoshi } from "./asset";
import { bigInt2MillisatoshiCodec } from "./asset";
import { POSIXSeconds } from "../time/absolute";
import { Seconds } from "../time/duration";
import { NonNegativeInt } from "@konduit/codec/integers/smallish";
import * as codec from "@konduit/codec";
import { mkTaggedUint8ArrayCodec } from "@konduit/codec/uint8Array";
import * as uint8Array from "@konduit/codec/uint8Array";
import { uint8Array2Secp256k1CompressedPublicKeyCodec, uint8Array2Secp256k1SignatureCodec, type AnySecp256k1PublicKey, type Secp256k1CompressedPublicKey, type Secp256k1Signature } from "../crypto/secp256k1";
import type { DecodedInvoice } from "@konduit/bln/invoice";
import type { Codec } from "@konduit/codec";
import { sha256, type Sha256Hash } from "../crypto/hashes";
import type { CborCodec } from "@konduit/codec/cbor/codecs/sync";
import { randomBytes } from "@noble/hashes/utils.js";

export type InvoiceTimestamp = Tagged<POSIXSeconds, "InvoiceTimestamp">;
export type InvoiceExpiry = Tagged<Seconds, "InvoiceExpiry">;
export type Blocks = Tagged<NonNegativeInt, "Blocks">;
export type MinFinalCltvExpiry = Tagged<Blocks, "MinFinalCltvExpiry">;

export type PaymentSecret = Tagged<Uint8Array, "PaymentSecret">;
export const uint8Array2PaymentSecretCodec: Codec<Uint8Array, PaymentSecret, JsonError> = mkTaggedUint8ArrayCodec<PaymentSecret>("PaymentSecret", (arr: Uint8Array) => arr.length === 32);

export type InvoiceSignature = Tagged<Secp256k1Signature, "InvoiceSignature">;
export const uint8Array2InvoiceSignatureCodec = codec.rmap(uint8Array2Secp256k1SignatureCodec, (sig) => sig as InvoiceSignature, (sig) => sig as Secp256k1Signature);

export type PayeePubKey = Tagged<AnySecp256k1PublicKey, "PayeePubKey">;
export const uint8Array2PayeePubKeyCodec = codec.rmap(uint8Array2Secp256k1CompressedPublicKeyCodec, (pk) => pk as PayeePubKey, (pk) => pk as Secp256k1CompressedPublicKey);
export const json2PayeePubKeyCodec: JsonCodec<PayeePubKey> = codec.pipe(
  uint8Array.jsonCodec,
  uint8Array2PayeePubKeyCodec,
);

export type InvoiceString = Tagged<string, "InvoiceString">;

export type HtlcSecret = Tagged<Uint8Array, "HtlcSecret">;
export namespace HtlcSecret {
  export const LENGTH = 32;
  export const fromBytes = (bytes: Uint8Array) => {
    if (bytes.length !== LENGTH) {
      return err(`HtlcSecret must be ${LENGTH} bytes, got ${bytes.length} bytes`);
    }
    return ok(bytes as HtlcSecret);
  }
  export const fromRandomBytes = async () => {
    const bytes = randomBytes(LENGTH);
    return bytes as HtlcSecret;
  }
}

export const uint8Array2HtlcSecretCodec: Codec<Uint8Array, HtlcSecret, JsonError> = mkTaggedUint8ArrayCodec<HtlcSecret>("HtlcSecret", (arr: Uint8Array) => arr.length === HtlcSecret.LENGTH);
export const json2HtlcSecretCodec: JsonCodec<HtlcSecret> = uint8Array.mkTaggedJsonCodec("HtlcSecret", (arr) => arr.length === HtlcSecret.LENGTH);
export const cbor2HtlcSecretCodec: CborCodec<HtlcSecret> = uint8Array.mkTaggedCborCodec("HtlcSecret", (arr) => arr.length === HtlcSecret.LENGTH);

export type HtlcLock = Tagged<Sha256Hash, "HtlcLock">;
export namespace HtlcLock {
  export const LENGTH = 32;
  export const fromBytes = (bytes: Uint8Array) => {
    if (bytes.length !== LENGTH) {
      return err(`HtlcLock must be ${LENGTH} bytes, got ${bytes.length} bytes`);
    }
    return ok(bytes as HtlcLock);
  }
  export const fromSecret = async (secret: HtlcSecret): Promise<HtlcLock> => {
    const res = await sha256(secret);
    return res as HtlcLock;
  }
}

export const uint8Array2HtlcLockCodec: Codec<Uint8Array, HtlcLock, JsonError> = mkTaggedUint8ArrayCodec<HtlcLock>("HtlcLock", (arr: Uint8Array) => arr.length === HtlcLock.LENGTH);
export const json2HtlcLockCodec: JsonCodec<HtlcLock> = uint8Array.mkTaggedJsonCodec("HtlcLock", (arr) => arr.length === HtlcLock.LENGTH);
export const cbor2HtlcLockCodec: CborCodec<HtlcLock> = uint8Array.mkTaggedCborCodec("HtlcLock", (arr) => arr.length === HtlcLock.LENGTH);


export type Invoice = {
  // readonly descriptionHash: DescriptionHash | null;
  // readonly features: FeatureBits | null;
  // readonly routeHint: RouteHint[] | null;
  // readonly fallbackAddress: FallbackAddress | null;

  readonly amount: Millisatoshi;
  readonly description: string | null;
  readonly expiry: InvoiceExpiry | null;
  readonly minFinalCltvExpiry: MinFinalCltvExpiry | null;
  readonly network: Network;
  readonly payee: PayeePubKey;
  readonly paymentHash: HtlcLock;
  readonly paymentSecret: PaymentSecret | null;
  readonly raw: InvoiceString;
  readonly signature: InvoiceSignature;
  readonly timestamp: InvoiceTimestamp;
};

export const nullable = <I, O>(codec: Codec<I, O, JsonError>): Codec<I | undefined | null, O | null, JsonError> => {
  return {
    deserialise: (input: I | undefined | null): Result<O | null, JsonError> => {
      if (input === undefined || input === null) {
        return ok(null);
      }
      return codec.deserialise(input as I).map(value => value as O | null);
    },
    serialise: (output: O | null): I | undefined | null => {
      if (output === null) return null;
      return codec.serialise(output);
    }
  };
}

export const decodedInvoice2InvoiceDeserialiser = (decoded: DecodedInvoice): Result<Invoice, JsonError> => {
  return Result.combine([
    bigInt2MillisatoshiCodec.deserialise(decoded.amount ?? 0n),
    ok(decoded.description ?? null),
    NonNegativeInt.fromNumber(decoded.expiry ?? 3600).map(Seconds.fromNonNegativeInt),
    NonNegativeInt.fromNumber(decoded.minFinalCltvExpiry ?? 0).map(value => value as MinFinalCltvExpiry),
    ok(decoded.network),
    uint8Array2PayeePubKeyCodec.deserialise(decoded.payee),
    uint8Array2HtlcLockCodec.deserialise(decoded.paymentHash),
    nullable(uint8Array2PaymentSecretCodec).deserialise(decoded.paymentSecret),
    ok(decoded.raw),
    uint8Array2InvoiceSignatureCodec.deserialise(decoded.signature),
    NonNegativeInt.fromNumber(decoded.timestamp).andThen(value => POSIXSeconds.fromNonNegativeInt(value)).map(value => value as InvoiceTimestamp),
  ]).match(
      ([amount, description, expiry, minFinalCltvExpiry, network, payee, paymentHash, paymentSecret, raw, signature, timestamp]) => {
      let secret: PaymentSecret | null = paymentSecret !== undefined ? paymentSecret : null;
      let invoice = {
        amount,
        description,
        expiry,
        minFinalCltvExpiry,
        network,
        payee,
        paymentHash,
        paymentSecret: secret,
        raw: raw as InvoiceString, // We just validated this string here
        signature,
        timestamp
      } as Invoice;
      return ok(invoice);
    },
    (errors) => {
      return err(errors as JsonError);
    }
  );
}

