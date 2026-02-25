import type { Tagged } from "type-fest";
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
import { mkOrdForScalar } from "@konduit/codec/tagged";

export type Index = Tagged<NonNegativeBigInt, "Index">;
export namespace Index {
  export const zero = 0n as Index;
  export const successor = (index: Index): Index => (index + 1n) as Index;
  export const fromBigInt = (value: bigint): Result<Index, JsonError> => bigInt2IndexCodec.deserialise(value);
  export const ord = mkOrdForScalar<Index>();
}

export const bigInt2IndexCodec: codec.Codec<bigint, Index, JsonError> = codec.rmap(
  bigInt2NonNegativeBigIntCodec,
  (nonNegative: NonNegativeBigInt) => nonNegative as Index,
  (index: Index): NonNegativeBigInt => index as NonNegativeBigInt,
);
export const json2IndexCodec: JsonCodec<Index> = codec.pipe(json2BigIntCodec, bigInt2IndexCodec);
export const cbor2IndexCodec: CborCodec<Index> = codec.pipe(cbor.cbor2IntCodec, bigInt2IndexCodec);

export type LockedChequeBody = {
  readonly amount: Lovelace;
  readonly index: Index;
  readonly lock: HtlcLock;
  readonly timeout: ValidDate;
};

export namespace LockedChequeBody {
  export const fromUnlockedBody = (unlockedBody: UnlockedChequeBody): LockedChequeBody => {
    const { amount, index, secret, timeout } = unlockedBody;
    const lock = HtlcLock.fromSecret(secret);
    return { amount, index, lock, timeout };
  }

  export const fromLocking = (
    amount: Lovelace,
    index: Index,
    timeout: ValidDate,
  ): { chequeBody: LockedChequeBody, secret: HtlcSecret } => {
    const secret = HtlcSecret.fromRandomBytes();
    const unlockedChequeBody = { amount, index, secret, timeout, };
    const chequeBody = LockedChequeBody.fromUnlockedBody(unlockedChequeBody);
    return {
      chequeBody,
      secret,
    };
  }

  export const areEqual = (a: LockedChequeBody, b: LockedChequeBody): boolean => (
    a.amount === b.amount &&
    a.index === b.index &&
    uint8Array.equal(a.lock, b.lock) &&
    ValidDate.ord.equal(a.timeout, b.timeout)
  );

  export const unlock = (secret: HtlcSecret, chequeBody: LockedChequeBody): Result<UnlockedChequeBody, string> => {
    const lock = HtlcLock.fromSecret(secret);
    if (!uint8Array.equal(lock, chequeBody.lock)) {
      return err("Invalid secret for the cheque body");
    }
    return ok({
      amount: chequeBody.amount,
      index: chequeBody.index,
      secret,
      timeout: chequeBody.timeout,
    } as UnlockedChequeBody);
  }

  export const areMatching = (unlocked: UnlockedChequeBody, locked: LockedChequeBody): boolean => {
    const derivedLocked = LockedChequeBody.fromUnlockedBody(unlocked);
    return LockedChequeBody.areEqual(derivedLocked, locked);
  }
}

export const cbor2LockedChequeBodyCodec = codec.rmap(
  cbor.tupleOf(
    cbor.indefiniteLength,
    cbor2IndexCodec,
    codec.pipe(cbor.cbor2IntCodec, bigInt2LovelaceCodec),
    codec.pipe(cbor.cbor2IntCodec, bigInt2POSIXMillisecondsCodec),
    cbor2HtlcLockCodec,
  ),
  ([ index, amount, timeoutMs, lock, ]: [Index, Lovelace, POSIXMilliseconds, HtlcLock ]): LockedChequeBody => {
    const timeout = ValidDate.fromPOSIXMilliseconds(timeoutMs);
    return { amount, index, lock, timeout }
  },
  (chequeBody: LockedChequeBody): [Index, Lovelace, POSIXMilliseconds, HtlcLock] => {
    return [
      chequeBody.index,
      chequeBody.amount,
      POSIXMilliseconds.fromValidDate(chequeBody.timeout),
      chequeBody.lock,
    ];
  },
);

const mkSigningPayload = (tag: ChannelTag, bodyCbor: Cbor) => {
  const bodyBytes = cbor.serialiseCbor(bodyCbor);
  return new Uint8Array([...tag, ...bodyBytes]) as Uint8Array;
}

// We serialise cheque as cbor hex string in the API so we stick to that
// convention. We could use a separate codec for state storage but
// let's keep it simple for now.
export const json2LockedChequeBodyCodec: JsonCodec<LockedChequeBody> = codec.pipe(
  codec.pipe(uint8Array.jsonCodec, uint8Array2CborCodec),
  cbor2LockedChequeBodyCodec
)

export type LockedCheque = Tagged<{ body: LockedChequeBody, signature: Ed25519Signature }, "LockedCheque">;
export namespace LockedCheque {
  export type ChequeSigningData = Tagged<Uint8Array, "ChequeSigningData">;

  export const fromLockingAndSigning = (
    tag: ChannelTag,
    sKey: Ed25519SigningKey,
    amount: Lovelace,
    index: Index,
    timeout: ValidDate,
  ): { cheque: LockedCheque, secret: HtlcSecret } => {
    const { chequeBody, secret } = LockedChequeBody.fromLocking(amount, index, timeout);
    const cheque = fromSigning(tag, sKey, chequeBody);
    return { cheque, secret, };
  }

  export const signingData = (tag: ChannelTag, body: LockedChequeBody): ChequeSigningData => {
    const bodyCbor = cbor2LockedChequeBodyCodec.serialise(body);
    return mkSigningPayload(tag, bodyCbor) as ChequeSigningData;
  }

  export const fromSigning = (tag: ChannelTag, sKey: Ed25519SigningKey, body: LockedChequeBody): LockedCheque => {
    const bytes = signingData(tag, body);
    console.log(bytes);
    const signature = sKey.sign(bytes);
    return {
      body,
      signature,
    } as LockedCheque;
  }

  export const verifySignature = (tag: ChannelTag, vKey: ConsumerEd25519VerificationKey, cheque: LockedCheque): boolean => {
    const bytes = LockedCheque.signingData(tag, cheque.body);
    return vKey.verify(bytes, cheque.signature);
  }

  export const verifySecret = (secret: HtlcSecret, cheque: LockedCheque): boolean => {
    const lock = HtlcLock.fromSecret(secret);
    return uint8Array.equal(lock, cheque.body.lock);
  }

  export const verify = (tag: ChannelTag, vKey: ConsumerEd25519VerificationKey, secret: HtlcSecret, cheque: LockedCheque): boolean => {
    return LockedCheque.verifySignature(tag, vKey, cheque) && LockedCheque.verifySecret(secret, cheque);
  }
}

export const json2LockedChequeCodec = codec.rmap(
  jsonCodecs.objectOf({
    "body": json2LockedChequeBodyCodec,
    "signature": json2Ed25519SignatureCodec,
  }),
  (obj) => obj as LockedCheque,
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

  export const load = (index: Index, amount: Lovelace, excluded: Index[]): Result<SquashBody, string> => {
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

  export const squashCheque = (prev: SquashBody, cheque: LockedChequeBody): Result<SquashBody, JsonError> => {
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
      return SquashBody.load(index, amount, excluded);
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

export type UnlockedChequeBody = {
  readonly amount: Lovelace;
  readonly index: Index;
  readonly secret: HtlcSecret;
  readonly timeout: ValidDate;
};

export namespace UnlockedChequeBody {
  export const areEqual = (a: UnlockedChequeBody, b: UnlockedChequeBody): boolean => (
    a.amount === b.amount &&
    a.index === b.index &&
    uint8Array.equal(a.secret, b.secret) &&
    ValidDate.ord.equal(a.timeout, b.timeout)
  );
}

export type UnlockedCheque = {
  body: UnlockedChequeBody;
  signature: Ed25519Signature;
};

export namespace UnlockedCheque {
  export const verifySignature = (tag: ChannelTag, vKey: ConsumerEd25519VerificationKey, unlocked: UnlockedCheque): boolean => {
    const cheque: LockedCheque = {
      body: LockedChequeBody.fromUnlockedBody(unlocked.body),
      signature: unlocked.signature,
    } as LockedCheque;
    return LockedCheque.verifySignature(tag, vKey, cheque);
  }
}

export const json2UnlockedChequeCodec: JsonCodec<UnlockedCheque> = codec.pipe(
  jsonCodecs.objectOf({
    body: json2LockedChequeBodyCodec,
    secret: json2HtlcSecretCodec,
    signature: json2Ed25519SignatureCodec,
  }), {
    deserialise: (obj) => {
      const unlockedBody = {
          amount: obj.body.amount,
          index: obj.body.index,
          timeout: obj.body.timeout,
          secret: obj.secret,
      }
      if(!LockedChequeBody.areMatching(unlockedBody, obj.body)) {
        return err("Invalid secret for the cheque body");
      }
      return ok({
        body: {
          amount: obj.body.amount,
          index: obj.body.index,
          timeout: obj.body.timeout,
          secret: obj.secret,
        },
        signature: obj.signature,
      });
    },
    serialise: (unlocked) => ({
      body: LockedChequeBody.fromUnlockedBody(unlocked.body),
      secret: unlocked.body.secret,
      signature: unlocked.signature,
    })
  }
)

export type AnyCheque = LockedCheque | UnlockedCheque;
export namespace AnyCheque {
  export const isUnlocked = (cheque: AnyCheque): cheque is UnlockedCheque => "secret" in cheque.body;
  export const isLocked = (cheque: AnyCheque): cheque is LockedCheque => !isUnlocked(cheque);
}

export const json2AnyChequeCodec: JsonCodec<AnyCheque> = jsonCodecs.altJsonCodecs(
  [json2LockedChequeCodec, json2UnlockedChequeCodec],
  (serLocked, serUnlocked) => (cheque: AnyCheque) => {
    if (AnyCheque.isUnlocked(cheque)) {
      return serUnlocked(cheque);
    }
    return serLocked(cheque);
  }
);

export type VerifiedUnlockedChequeComponents = {
  readonly unlocked: UnlockedCheque;
  readonly vKey: ConsumerEd25519VerificationKey;
};
export type VerifiedUnlockedCheque = Tagged<VerifiedUnlockedChequeComponents, "VerifiedUnlockedCheque">;
export namespace VerifiedUnlockedCheque {
  export const fromVerification = (tag: ChannelTag, vKey: ConsumerEd25519VerificationKey, unlocked: UnlockedCheque): Result<VerifiedUnlockedCheque, string> => {
    const isChequeValid = UnlockedCheque.verifySignature(tag, vKey, unlocked);
    if (!isChequeValid) {
      return err("Invalid signature for the cheque");
    }
    return ok({
      unlocked,
      vKey,
    } as VerifiedUnlockedCheque);
  }
}

export const mkJson2VerifiedUnlockedCodec = (tag: ChannelTag, vKey: ConsumerEd25519VerificationKey): JsonCodec<VerifiedUnlockedCheque> => {
  return codec.pipe(
    json2UnlockedChequeCodec, {
      deserialise: (unlocked) => VerifiedUnlockedCheque.fromVerification(tag, vKey, unlocked),
      serialise: (verifiedUnlockedCheque) => verifiedUnlockedCheque.unlocked,
    }
  );
}

export type VerifiedLockedChequeComponents = {
  readonly cheque: LockedCheque;
  readonly vKey: ConsumerEd25519VerificationKey;
};
export type VerifiedLockedCheque = Tagged<VerifiedLockedChequeComponents, "VerifiedLockedCheque">;
export namespace VerifiedLockedCheque {
  export const fromVerification = (tag: ChannelTag, vKey: ConsumerEd25519VerificationKey, cheque: LockedCheque): Result<VerifiedLockedCheque, string> => {
    if (!LockedCheque.verifySignature(tag, vKey, cheque)) {
      return err("Invalid signature for the cheque");
    }
    return ok({
      cheque,
      vKey,
    } as VerifiedLockedCheque);
  }

  export const fromSigning = (tag: ChannelTag, sKey: Ed25519SigningKey, body: LockedChequeBody): VerifiedLockedCheque => {
    const cheque = LockedCheque.fromSigning(tag, sKey, body);
    return {
      cheque,
      vKey: sKey.toVerificationKey(),
    } as VerifiedLockedCheque;
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

