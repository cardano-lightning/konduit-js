import type { Tagged } from "type-fest";
import type { Result } from "neverthrow";
import { ok, err } from "neverthrow";
import { bigInt2LovelaceCodec, cbor2Ed25519SignatureCodec, json2Ed25519SignatureCodec, json2LovelaceCodec, Lovelace } from "../cardano";
import { bigInt2NonNegativeBigIntCodec, NonNegativeBigInt } from "@konduit/codec/integers/big";
import * as cbor from "@konduit/codec/cbor/codecs/sync";
import * as codec from "@konduit/codec";
import { bigInt2POSIXMillisecondsCodec, json2POSIXMillisecondsCodec, POSIXMilliseconds } from "../time/absolute";
import { json2BigIntCodec } from "@konduit/codec/json/codecs";
import type { JsonCodec, JsonError } from "@konduit/codec/json/codecs";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import type { Ed25519Signature, Ed25519SigningKey, Ed25519VerificationKey } from "@konduit/cardano-keys";
import { ChannelTag } from "./core";
import * as uint8Array from "@konduit/codec/uint8Array";
import type { ConsumerEd25519VerificationKey } from "./l1Channel";
import type { CborCodec } from "@konduit/codec/cbor/codecs/sync";

export type Index = Tagged<NonNegativeBigInt, "Index">;
export namespace Index {
  export const zero = 0n as Index;
  export const successor = (index: Index): Index => (index + 1n) as Index;
  export const fromBigInt = (value: bigint): Result<Index, JsonError> => bigInt2IndexCodec.deserialise(value);
}

export const bigInt2IndexCodec: codec.Codec<bigint, Index, JsonError> = codec.rmap(
  bigInt2NonNegativeBigIntCodec,
  (nonNegative: NonNegativeBigInt) => nonNegative as Index,
  (index: Index): NonNegativeBigInt => index as NonNegativeBigInt,
);
export const json2IndexCodec: JsonCodec<Index> = codec.pipe(json2BigIntCodec, bigInt2IndexCodec);
export const cbor2IndexCodec: CborCodec<Index> = codec.pipe(cbor.cbor2IntCodec, bigInt2IndexCodec);

export const HTLC_LOCK_LEN = 32;
export type HtlcLock = Tagged<Uint8Array, "HtlcLock">;
export namespace HtlcLock {
  export const fromBytes = (bytes: Uint8Array) => {
    if (bytes.length !== HTLC_LOCK_LEN) {
      return err(`HtlcLock must be ${HTLC_LOCK_LEN} bytes, got ${bytes.length} bytes`);
    }
    return ok(bytes as HtlcLock);
  }
}
const validateLength = (arr: Uint8Array): boolean => arr.length === HTLC_LOCK_LEN;

export const json2HtlcLockCodec: JsonCodec<HtlcLock> = uint8Array.mkTaggedJsonCodec("HtlcLock", validateLength);
export const cbor2HtlcLockCodec: CborCodec<HtlcLock> = uint8Array.mkTaggedCborCodec("HtlcLock", validateLength);

// Extra invariants:
// * `amount` is positive
type ChequeBodyComponents = {
  readonly index: Index;
  readonly amount: Lovelace;
  readonly timeout: POSIXMilliseconds;
  readonly lock: HtlcLock;
};

export type ChequeBody = Tagged<ChequeBodyComponents, "ChequeBody">;

export namespace ChequeBody {
  export const create = (
    amount: Lovelace,
    index: Index,
    lock: HtlcLock,
    timeout: POSIXMilliseconds,
  ): Result<ChequeBody, string> => {
    if (amount < 0n) {
      return err("Amount must be non-negative");
    }
    return ok({
      amount,
      index,
      lock,
      timeout,
    } as ChequeBody);
  };

  export const areEqual = (a: ChequeBody, b: ChequeBody): boolean =>
    a.amount === b.amount &&
    a.index === b.index &&
    a.lock.length === b.lock.length &&
    a.timeout === b.timeout &&
    a.lock.every((value, i) => value === b.lock[i]);
}

export const cbor2ChequeBodyCodec = codec.pipe(
  cbor.tupleOf(
    cbor.indefiniteLength,
    codec.pipe(cbor.cbor2IntCodec, bigInt2LovelaceCodec),
    cbor2IndexCodec,
    cbor2HtlcLockCodec,
    codec.pipe(cbor.cbor2IntCodec, bigInt2POSIXMillisecondsCodec),
  ), {
    deserialise: ([
      amount,
      index,
      lock,
      timeout,
    ]: [Lovelace, Index, HtlcLock, POSIXMilliseconds]): Result<ChequeBody, string> => {
      return ChequeBody.create(amount, index, lock, timeout);
    },
    serialise: (chequeBody: ChequeBody): [Lovelace, Index, HtlcLock, POSIXMilliseconds] => {
      return [
        chequeBody.amount,
        chequeBody.index,
        chequeBody.lock,
        chequeBody.timeout,
      ];
    },
  },
);

export const json2ChequeBodyCodec: JsonCodec<ChequeBody> = codec.rmap(
  jsonCodecs.objectOf({
    amount: json2LovelaceCodec,
    index: json2IndexCodec,
    lock: json2HtlcLockCodec,
    timeout: json2POSIXMillisecondsCodec,
  }),
  (obj) => obj as ChequeBody,
  (chBody) => chBody
)

export type Cheque = Tagged<{ body: ChequeBody, signature: Ed25519Signature }, "Cheque">;
export namespace Cheque {
  export const fromSigning = (sKey: Ed25519SigningKey, body: ChequeBody): Cheque => {
    const bodyBytes = cbor.serialiseCbor(cbor2ChequeBodyCodec.serialise(body));
    const signature = sKey.sign(bodyBytes);
    return {
      body,
      signature,
    } as Cheque;
  }

  export const verify = (vKey: ConsumerEd25519VerificationKey, cheque: Cheque): boolean => {
    const bodyBytes = cbor.serialiseCbor(cbor2ChequeBodyCodec.serialise(cheque.body));
    return vKey.verify(bodyBytes, cheque.signature);
  }
}
export const json2ChequeCodec = codec.rmap(
  jsonCodecs.objectOf({
    "body": json2ChequeBodyCodec,
    "signature": json2Ed25519SignatureCodec,
  }),
  (obj) => obj as Cheque,
  (cheque) => cheque
)

type SquashBodyComponents = {
  readonly index: Index;
  readonly amount: Lovelace;
  readonly excluded: Index[];
};

// Extra invariants:
// * All `excluded` are smaller than the `index`
// * All `excluded` are in strictly increasing order
// * `amount` is positive
export type SquashBody = Tagged<SquashBodyComponents, "Squash">;
export namespace SquashBody {
  export const empty = {
    amount: Lovelace.zero,
    excluded: [] as Index[],
    index: 0n as Index,
  } as SquashBody;

  export const create = (index: Index, amount: Lovelace, excluded: Index[]): Result<SquashBody, string> => {
    if (amount < 0n) {
      return err("Amount must be non-negative");
    }
    let prevIdx = -1n;
    for (const excludedIndex of excluded) {
      if (excludedIndex <= prevIdx) return err("Excluded indices must be in strictly increasing order");
      prevIdx = excludedIndex;
    }
    if (prevIdx >= index) return err(`Excluded indices must be smaller than the index: last excluded index ${prevIdx} is not smaller than index ${index}`);
    return ok({ index, amount, excluded } as SquashBody);
  }

  export const areEqual = (a: SquashBody, b: SquashBody): boolean => (
    a.index === b.index
    && a.amount === b.amount
    && a.excluded.length === b.excluded.length
    && a.excluded.every((value, index) => value === b.excluded[index])
  );

  export const squashCheque = (prev: SquashBody, cheque: ChequeBody): Result<SquashBody, JsonError> => {
    const excludePos = prev.excluded.indexOf(cheque.index);
    if (excludePos !== -1) {
      const newExcluded = [
        ...prev.excluded.slice(0, excludePos),
        ...prev.excluded.slice(excludePos + 1),
      ];
      return Lovelace.add(prev.amount, cheque.amount).map((newAmount) => ({
        ...prev,
        amount: newAmount,
        excluded: newExcluded,
      }));
    }

    if (prev.index < cheque.index) {
      const newExcluded: Index[] = [];

      let idx = Index.successor(prev.index);
      while (idx < cheque.index) {
        newExcluded.push(idx);
        idx = Index.successor(idx);
      }
      return Lovelace.add(prev.amount, cheque.amount).map((newAmount) => ({
        ...prev,
        amount: newAmount,
        excluded: [...prev.excluded, ...newExcluded],
        index: cheque.index,
      }));
    }
    return err(`DuplicateIndex: Index ${cheque.index} is already squashed (excluded: ${prev.excluded.includes(cheque.index)})`);
  }
}

export const cbor2SquashBodyCodec = codec.pipe(
  cbor.tupleOf(
    cbor.indefiniteLength,
    cbor2IndexCodec,
    codec.pipe(cbor.cbor2IntCodec, bigInt2LovelaceCodec),
    cbor.arrayOf(cbor.definiteLength, cbor2IndexCodec)
  ), {
    deserialise: ([index, amount, excluded]: [Index, Lovelace, Index[]]): Result<SquashBody, string> => {
      return SquashBody.create(index, amount, excluded);
    },
    serialise: (squashBody: SquashBody): [Index, Lovelace, Index[]] => {
      return [squashBody.index, squashBody.amount, squashBody.excluded];
    }
  }
);

export const json2SquashBodyCodec: JsonCodec<SquashBody> = codec.rmap(
  jsonCodecs.objectOf({
    "amount": json2LovelaceCodec,
    "index": json2IndexCodec,
    "excluded": jsonCodecs.arrayOf(json2IndexCodec),
  }),
  (obj) => obj as SquashBody,
  (squashBody) => squashBody
);

export type SquashComponents = {
  readonly body: SquashBody;
  readonly signature: Ed25519Signature;
};

export type Squash = Tagged<SquashComponents, "Squash">;
export namespace Squash {
  export type SquashSigningData = Tagged<Uint8Array, "SquashSigningData">;

  export const create = (body: SquashBody, signature: Ed25519Signature): Squash => ({
    body,
    signature,
  } as Squash);

  export const fromBodySigning = (sKey: Ed25519SigningKey, tag: ChannelTag, body: SquashBody): Squash => {
    const signingData = Squash.signingData(tag, body);
    const signature = sKey.sign(signingData);
    return Squash.create(body, signature);
  }

  export const signingData = (tag: ChannelTag, body: SquashBody): SquashSigningData => {
    const bodyCbor = cbor2SquashBodyCodec.serialise(body);
    const bodyBytes = cbor.serialiseCbor(bodyCbor);
    return new Uint8Array([...tag, ...bodyBytes]) as SquashSigningData;
  }

  export const verify = (tag: ChannelTag, squash: Squash, vKey: Ed25519VerificationKey): boolean => {
    const signingData = Squash.signingData(tag, squash.body);
    return vKey.verify(signingData, squash.signature);
  }
}

export const cbor2SquashCodec = codec.rmap(
  cbor.tupleOf(
    cbor.indefiniteLength,
    cbor2SquashBodyCodec,
    cbor2Ed25519SignatureCodec,
  ),
  ([body, signature]: [SquashBody, Ed25519Signature]) => Squash.create(body, signature),
  (squash: Squash): [SquashBody, Ed25519Signature] => [squash.body, squash.signature],
);

export const json2SquashCodec: JsonCodec<Squash> = codec.rmap(
  jsonCodecs.objectOf({
    "body": json2SquashBodyCodec,
    "signature": json2Ed25519SignatureCodec,
  }),
  (obj) => obj as Squash,
  (squash) => squash
);
