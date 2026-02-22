import type { Tagged } from "type-fest";
import * as hexString from "@konduit/codec/hexString";
import type { Result } from "neverthrow";
import { ok, err } from "neverthrow";
import { bigInt2LovelaceCodec, cbor2Ed25519SignatureCodec, json2Ed25519SignatureCodec, Lovelace } from "../cardano";
import { bigInt2NonNegativeBigIntCodec, NonNegativeBigInt } from "@konduit/codec/integers/big";
import * as cbor from "@konduit/codec/cbor/codecs/sync";
import * as codec from "@konduit/codec";
import { bigInt2POSIXMillisecondsCodec, POSIXMilliseconds, ValidDate } from "../time/absolute";
import { json2BigIntCodec } from "@konduit/codec/json/codecs";
import type { JsonCodec, JsonError } from "@konduit/codec/json/codecs";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import type { Ed25519Signature, Ed25519SigningKey, Ed25519VerificationKey } from "@konduit/cardano-keys";
import { ChannelTag } from "./core";
import * as uint8Array from "@konduit/codec/uint8Array";
import type { ConsumerEd25519VerificationKey } from "./l1Channel";
import { altCborCodecs, uint8Array2CborCodec, type CborCodec } from "@konduit/codec/cbor/codecs/sync";
import type { Cbor } from "@konduit/codec/cbor/core";
import { cbor2HtlcLockCodec, HtlcLock, HtlcSecret, json2HtlcSecretCodec } from "../bitcoin/bolt11";

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

// Extra invariants:
// * `amount` is positive
type ChequeBodyComponents = {
  readonly index: Index;
  readonly amount: Lovelace;
  readonly timeout: ValidDate;
  readonly lock: HtlcLock;
};

export type ChequeBody = Tagged<ChequeBodyComponents, "ChequeBody">;

export namespace ChequeBody {
  export const load = (
    amount: Lovelace,
    index: Index,
    lock: HtlcLock,
    timeout: ValidDate,
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

  export const fromSecret = (
    amount: Lovelace,
    index: Index,
    secret: HtlcSecret,
    timeout: ValidDate,
  ): Result<ChequeBody, string> => {
    const lock = HtlcLock.fromSecret(secret);
    return load(amount, index, lock, timeout);
  }

  export const fromLocking = (
    amount: Lovelace,
    index: Index,
    timeout: ValidDate,
  ): Result<{ chequeBody: ChequeBody, secret: HtlcSecret }, string> => {
    const secret = HtlcSecret.fromRandomBytes();
    const lockResult = ChequeBody.fromSecret(amount, index, secret, timeout);
    return lockResult.map((chequeBody) => ({
      chequeBody,
      secret,
    }));
  }

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
    cbor2IndexCodec,
    codec.pipe(cbor.cbor2IntCodec, bigInt2LovelaceCodec),
    codec.pipe(cbor.cbor2IntCodec, bigInt2POSIXMillisecondsCodec),
    cbor2HtlcLockCodec,
  ), {
    deserialise: ([
      index,
      amount,
      timeout,
      lock,
    ]: [Index, Lovelace, POSIXMilliseconds, HtlcLock ]): Result<ChequeBody, string> => {
      const timeoutDate = ValidDate.fromPOSIXMilliseconds(timeout);
      return ChequeBody.load(amount, index, lock, timeoutDate);
    },
    serialise: (chequeBody: ChequeBody): [Index, Lovelace, POSIXMilliseconds, HtlcLock] => {
      return [
        chequeBody.index,
        chequeBody.amount,
        POSIXMilliseconds.fromValidDate(chequeBody.timeout),
        chequeBody.lock,
      ];
    },
  },
);

const mkSigningPayload = (tag: ChannelTag, bodyCbor: Cbor) => {
  const bodyBytes = cbor.serialiseCbor(bodyCbor);
  return new Uint8Array([...tag, ...bodyBytes]) as Uint8Array;
}

// We serialise cheque as cbor hex string
export const json2ChequeBodyCodec: JsonCodec<ChequeBody> = codec.pipe(
  codec.pipe(uint8Array.jsonCodec, uint8Array2CborCodec),
  cbor2ChequeBodyCodec
)

export type Cheque = Tagged<{ body: ChequeBody, signature: Ed25519Signature }, "Cheque">;
export namespace Cheque {
  export type ChequeSigningData = Tagged<Uint8Array, "ChequeSigningData">;

  export const fromLockingAndSigning = (
    tag: ChannelTag,
    sKey: Ed25519SigningKey,
    amount: Lovelace,
    index: Index,
    timeout: ValidDate,
  ): Result<{ cheque: Cheque, secret: HtlcSecret }, string> => {
    const possibleChequeBodyWithSecret = ChequeBody.fromLocking(amount, index, timeout);
    return possibleChequeBodyWithSecret.map(({ chequeBody, secret }) => {
      const cheque = fromSigning(tag, sKey, chequeBody);
      return {
        cheque,
        secret,
      };
    });
  }

  export const signingData = (tag: ChannelTag, body: ChequeBody): ChequeSigningData => {
    const bodyCbor = cbor2ChequeBodyCodec.serialise(body);
    return mkSigningPayload(tag, bodyCbor) as ChequeSigningData;
  }

  export const fromSigning = (tag: ChannelTag, sKey: Ed25519SigningKey, body: ChequeBody): Cheque => {
    const bytes = signingData(tag, body);
    console.log(bytes);
    const signature = sKey.sign(bytes);
    return {
      body,
      signature,
    } as Cheque;
  }

  export const verifySignature = (tag: ChannelTag, vKey: ConsumerEd25519VerificationKey, cheque: Cheque): boolean => {
    const bytes = Cheque.signingData(tag, cheque.body);
    return vKey.verify(bytes, cheque.signature);
  }

  export const verifySecret = (secret: HtlcSecret, cheque: Cheque): boolean => {
    const lock = HtlcLock.fromSecret(secret);
    return uint8Array.equal(lock, cheque.body.lock);
  }

  export const verify = (tag: ChannelTag, vKey: ConsumerEd25519VerificationKey, secret: HtlcSecret, cheque: Cheque): boolean => {
    return Cheque.verifySignature(tag, vKey, cheque) && Cheque.verifySecret(secret, cheque);
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
    codec.pipe(cbor.cbor2IntCodec, bigInt2LovelaceCodec),
    cbor2IndexCodec,
    // Empty array is encoded as definite length that is why we use this alt.
    altCborCodecs(
      [cbor.arrayOf(cbor.indefiniteLength, cbor2IndexCodec), cbor.arrayOf(cbor.definiteLength, cbor2IndexCodec)],
      (serIndefinite, serDefinite) => (arr: Index[]) => {
        if (arr.length === 0) {
          return serDefinite(arr);
        }
        return serIndefinite(arr);
      }
    ),
  ), {
    deserialise: ([amount, index, excluded]: [Lovelace, Index, Index[]]): Result<SquashBody, string> => {
      return SquashBody.create(index, amount, excluded);
    },
    serialise: (squashBody: SquashBody): [Lovelace, Index, Index[]] => {
      return [squashBody.amount, squashBody.index, squashBody.excluded];
    }
  }
);

// Used on the API level
export const json2SquashBodyCodec: JsonCodec<SquashBody> = codec.pipe(
  codec.pipe(uint8Array.jsonCodec, uint8Array2CborCodec),
  cbor2SquashBodyCodec,
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

  export const fromBodySigning = (tag: ChannelTag, sKey: Ed25519SigningKey, body: SquashBody): Squash => {
    const signingData = Squash.signingData(tag, body);
    const signature = sKey.sign(signingData);
    return Squash.create(body, signature);
  }

  export const signingData = (tag: ChannelTag, body: SquashBody): SquashSigningData => {
    const bodyCbor = cbor2SquashBodyCodec.serialise(body);
    return mkSigningPayload(tag, bodyCbor) as SquashSigningData;
  }

  export const verify = (tag: ChannelTag, vKey: Ed25519VerificationKey, squash: Squash): boolean => {
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
    body: json2SquashBodyCodec,
    signature: json2Ed25519SignatureCodec,
  }),
  (obj) => obj as Squash,
  (squash) => squash
);

export type Unlocked = {
  body: ChequeBody;
  signature: Ed25519Signature;
  secret: HtlcSecret;
};

export const json2UnlockedCodec: JsonCodec<Unlocked> = jsonCodecs.objectOf({
  body: json2ChequeBodyCodec,
  signature: json2Ed25519SignatureCodec,
  secret: json2HtlcSecretCodec,
});


export type VerifiedUnlockedComponents = {
  readonly unlocked: Unlocked;
  readonly vKey: ConsumerEd25519VerificationKey;
};
export type VerifiedUnlocked = Tagged<VerifiedUnlockedComponents, "VerifiedUnlocked">;
export namespace VerifiedUnlocked {
  export const fromVerification = (tag: ChannelTag, vKey: ConsumerEd25519VerificationKey, unlocked: Unlocked): Result<VerifiedUnlocked, string> => {
    const cheque: Cheque = {
      body: unlocked.body,
      signature: unlocked.signature,
    } as Cheque;
    const isChequeValid = Cheque.verifySignature(tag, vKey, cheque);
    if (!isChequeValid) {
      return err("Invalid signature for the cheque");
    }
    const isSecretValid = Cheque.verifySecret(unlocked.secret, cheque);
    if (!isSecretValid) {
      return err("Invalid secret for the cheque");
    }
    return ok({
      unlocked,
      vKey,
    } as VerifiedUnlocked);
  }
}

export const mkJson2VerifiedUnlockedCodec = (tag: ChannelTag, vKey: ConsumerEd25519VerificationKey): JsonCodec<VerifiedUnlocked> => {
  return codec.pipe(
    json2UnlockedCodec, {
      deserialise: (unlocked) => VerifiedUnlocked.fromVerification(tag, vKey, unlocked),
      serialise: (verifiedUnlocked) => verifiedUnlocked.unlocked,
    }
  );
}

export type VerifiedChequeComponents = {
  readonly cheque: Cheque;
  readonly vKey: ConsumerEd25519VerificationKey;
};
export type VerifiedCheque = Tagged<VerifiedChequeComponents, "VerifiedCheque">;
export namespace VerifiedCheque {
  export const fromVerification = (tag: ChannelTag, vKey: ConsumerEd25519VerificationKey, cheque: Cheque): Result<VerifiedCheque, string> => {
    if (!Cheque.verifySignature(tag, vKey, cheque)) {
      return err("Invalid signature for the cheque");
    }
    return ok({
      cheque,
      vKey,
    } as VerifiedCheque);
  }

  export const fromSigning = (tag: ChannelTag, sKey: Ed25519SigningKey, body: ChequeBody): VerifiedCheque => {
    const cheque = Cheque.fromSigning(tag, sKey, body);
    return {
      cheque,
      vKey: sKey.toVerificationKey(),
    } as VerifiedCheque;
  }
}

export type VerifiedSquashComponents = {
  readonly squash: Squash;
  readonly vKey: Ed25519VerificationKey;
};
export type VerifiedSquash = Tagged<VerifiedSquashComponents, "VerifiedSquash">;
export namespace VerifiedSquash {
  export const fromVerification = (tag: ChannelTag, vKey: Ed25519VerificationKey, squash: Squash): Result<VerifiedSquash, string> => {
    if (!Squash.verify(tag, vKey, squash)) {
      return err("Invalid signature for the squash");
    }
    return ok({
      squash,
      vKey,
    } as VerifiedSquash);
  }

  export const fromBodySigning = (tag: ChannelTag, sKey: Ed25519SigningKey, body: SquashBody): VerifiedSquash => {
    const squash = Squash.fromBodySigning(tag, sKey, body);
    return {
      squash,
      vKey: sKey.toVerificationKey(),
    } as VerifiedSquash;
  }
}

