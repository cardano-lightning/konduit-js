import type { Tagged } from "type-fest";
import type { Result } from "neverthrow";
import { ok, err } from "neverthrow";
import { bigInt2LovelaceCodec, cbor2SignatureCodec, Lovelace } from "../cardano";
import { bigInt2NonNegativeBigIntCodec, NonNegativeBigInt } from "@konduit/codec/integers/big";
import * as cbor from "@konduit/codec/cbor/codecs/sync";
import * as codec from "@konduit/codec";
import { bigInt2POSIXMillisecondsCodec, POSIXMilliseconds } from "../time/absolute";
import { json2BigIntCodec, JsonError } from "@konduit/codec/json/codecs";
import type { Signature, SKey, VKey } from "@konduit/cardano-keys";
import { ChannelTag } from "./core";
import * as uint8Array from "@konduit/codec/uint8Array";

export type Index = Tagged<NonNegativeBigInt, "Index">;
export namespace Index {
  export const zero = 0n as Index;
  export const successor = (index: Index): Index => (index + 1n) as Index;
  export const fromBigInt = (value: bigint): Result<Index, JsonError> => bigInt2IndexCodec.deserialise(value);
}

export const bigInt2IndexCodec: codec.Codec<bigint, Index, JsonError> = codec.rmap(
  bigInt2NonNegativeBigIntCodec,
  (nonNegative) => nonNegative as Index,
  (index: Index): bigint => index as NonNegativeBigInt,
);
export const json2IndexCodec = codec.pipe(json2BigIntCodec, bigInt2IndexCodec);
export const cbor2IndexCodec = codec.pipe(cbor.cbor2IntCodec, bigInt2IndexCodec);

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

export const json2HtlcLockCodec = uint8Array.mkTaggedJsonCodec("HtlcLock", validateLength);
export const cbor2HtlcLockCodec = uint8Array.mkTaggedCborCodec("HtlcLock", validateLength);

// Extra invariants:
// * `amount` is positive
type ChequeBodyComponents = {
  readonly index: Index;
  readonly amount: Lovelace;
  readonly timeout: POSIXMilliseconds;
  readonly lock: HtlcLock;
};

export type ChequeBody = Tagged<ChequeBodyComponents, "Cheque">;

export namespace ChequeBody {
  export const create = (
    index: Index,
    amount: Lovelace,
    timeout: POSIXMilliseconds,
    lock: HtlcLock,
  ): Result<ChequeBody, string> => {
    if (amount < 0n) {
      return err("Amount must be non-negative");
    }
    return ok({
      index,
      amount,
      timeout,
      lock,
    } as ChequeBody);
  };

  export const areEqual = (a: ChequeBody, b: ChequeBody): boolean =>
    a.index === b.index &&
    a.amount === b.amount &&
    a.timeout === b.timeout &&
    a.lock.length === b.lock.length &&
    a.lock.every((value, i) => value === b.lock[i]);
}

export const cbor2ChequeBodyCodec = codec.pipe(
  cbor.tupleOf(
    cbor.indefiniteLength,
    cbor2IndexCodec,
    codec.pipe(cbor.cbor2IntCodec, bigInt2LovelaceCodec),
    codec.pipe(cbor.cbor2IntCodec, bigInt2POSIXMillisecondsCodec),
  ),
  {
    deserialise: ([
      index,
      amount,
      timeout,
      lock,
    ]: [Index, Lovelace, POSIXMilliseconds, HtlcLock]): Result<ChequeBody, string> => {
      return ChequeBody.create(index, amount, timeout, lock);
    },
    serialise: (chequeBody: ChequeBody) => {
      return [
        chequeBody.index,
        chequeBody.amount,
        chequeBody.timeout,
        chequeBody.lock,
      ];
    },
  },
);

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
    index: 0n as Index,
    amount: Lovelace.zero,
    excluded: [] as Index[],
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

  export const squashCheque = (prev: SquashBody, cheque: ChequeBody): Result<SquashBody, string> => {
    const excludePos = prev.excluded.indexOf(cheque.index);
    if (excludePos !== -1) {
      const newExcluded = [
        ...prev.excluded.slice(0, excludePos),
        ...prev.excluded.slice(excludePos + 1),
      ];
      return ok({
        ...prev,
        amount: Lovelace.add(prev.amount, cheque.amount),
        excluded: newExcluded,
      });
    }

    if (prev.index < cheque.index) {
      const newExcluded: Index[] = [];

      let idx = Index.successor(prev.index);
      while (idx < cheque.index) {
        newExcluded.push(idx);
        idx = Index.successor(idx);
      }
      return ok({
        ...prev,
        amount: Lovelace.add(prev.amount, cheque.amount),
        excluded: [...prev.excluded, ...newExcluded],
        index: cheque.index,
      } as SquashBody);
    }
    return err(`DuplicateIndex: Index ${cheque.index} is already squashed (excluded: ${prev.excluded.includes(cheque.index)})`);
  }
}

export const cbor2SquashBodyCodec = codec.pipe(
  cbor.tupleOf(
    cbor.indefiniteLength,
    cbor2IndexCodec,
    codec.pipe(cbor.cbor2IntCodec, bigInt2LovelaceCodec),
    cbor.arrayOf(cbor.indefiniteLength, cbor2IndexCodec)
  ), {
    deserialise: ([index, amount, excluded]: [Index, Lovelace, Index[]]): Result<SquashBody, string> => {
      return SquashBody.create(index, amount, excluded);
    },
    serialise: (squashBody: SquashBody): [bigint, bigint, bigint[]] => {
      return [squashBody.index, squashBody.amount, squashBody.excluded];
    }
  }
);

export type SquashComponents = {
  readonly body: SquashBody;
  readonly signature: Signature;
};

export type Squash = Tagged<SquashComponents, "Squash">;
export type SquashSigningData = Tagged<Uint8Array, "SquashSigningData">;

export namespace Squash {
  export const create = (body: SquashBody, signature: Signature): Squash => ({
    body,
    signature,
  } as Squash);

  export const fromBodySigning = (sKey: SKey, tag: ChannelTag, body: SquashBody): Squash => {
    const signingData = Squash.signingData(tag, body);
    const signature = sKey.sign(signingData);
    return Squash.create(body, signature);
  }

  export const signingData = (tag: ChannelTag, body: SquashBody): SquashSigningData => {
    const bodyCbor = cbor2SquashBodyCodec.serialise(body);
    const bodyBytes = cbor.serialiseCbor(bodyCbor);
    return new Uint8Array([...tag, ...bodyBytes]) as SquashSigningData;
  }

  export const verify = (tag: ChannelTag, squash: Squash, vKey: VKey): boolean => {
    const signingData = Squash.signingData(tag, squash.body);
    return vKey.verify(signingData, squash.signature);
  }
}

export const cbor2SquashCodec = codec.rmap(
  cbor.tupleOf(
    cbor.indefiniteLength,
    cbor2SquashBodyCodec,
    cbor2SignatureCodec,
  ),
  ([body, signature]: [SquashBody, Signature]) => Squash.create(body, signature),
  (squash: Squash): [SquashBody, Signature] => [squash.body, squash.signature],
);
