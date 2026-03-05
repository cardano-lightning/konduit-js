import { json2NonNegativeBigIntCodec, NonNegativeBigInt } from "@konduit/codec/integers/big";
import type { JsonCodec } from "@konduit/codec/json/codecs";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import type { Tagged } from "type-fest";
import { TxHash } from "./tx";
import { NonNegativeInt, type ZeroToNine } from "@konduit/codec/integers/smallish";
import * as codec from "@konduit/codec";
import { mkOrdForScalar } from "@konduit/codec/tagged";

export type BlockNo = Tagged<NonNegativeBigInt, "BlockNo">;
export const json2BlockNoCodec = codec.rmap(
  json2NonNegativeBigIntCodec,
  (nonNegative) => nonNegative as BlockNo,
  (blockNo: BlockNo): NonNegativeBigInt => blockNo as NonNegativeBigInt,
)

export type TxIx = Tagged<NonNegativeInt, "TxIx">;
export namespace TxIx {
  export const fromNonNegativeInt = (nonNegative: NonNegativeInt): TxIx => nonNegative as TxIx;
  export const fromDigits = (n0: ZeroToNine, n1?: ZeroToNine, n2?: ZeroToNine, n3?: ZeroToNine): TxIx => {
    return NonNegativeInt.fromDigits(n0, n1, n2, n3) as TxIx;
  }
  export const jsonCodec = codec.rmap(
    NonNegativeInt.jsonCodec,
    (nonNegative) => nonNegative as TxIx,
    (txIx: TxIx): NonNegativeInt => txIx as NonNegativeInt,
  )
}

export type TxOutRef = { txId: TxHash, txIx: TxIx };
export const json2TxOutRefCodec: JsonCodec<TxOutRef> = jsonCodecs.objectOf({
  txId: TxHash.jsonCodec,
  txIx: TxIx.jsonCodec,
});

export type BlockDepth = Tagged<NonNegativeBigInt, "BlockDepth">;
export namespace BlockDepth {
  export const fromDigits = (n0: ZeroToNine, n1?: ZeroToNine, n2?: ZeroToNine, n3?: ZeroToNine): BlockDepth => {
    return NonNegativeBigInt.fromDigits(n0, n1, n2, n3) as BlockDepth;
  }
  export const fromNonNegativeBigInt = (n: NonNegativeBigInt): BlockDepth => n as BlockDepth;
  export const distance = (blockNo1: BlockNo, blockNo2: BlockNo): BlockDepth => {
    return NonNegativeBigInt.distance(blockNo1, blockNo2) as BlockDepth;
  }
  export const ord = mkOrdForScalar<BlockDepth>();
}

