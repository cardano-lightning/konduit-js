import { json2NonNegativeBigIntCodec, NonNegativeBigInt } from "@konduit/codec/integers/big";
import type { JsonCodec } from "@konduit/codec/json/codecs";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import type { Tagged } from "type-fest";
import { json2TxHashCodec, TxHash } from "./tx";
import { json2NonNegativeIntCodec, NonNegativeInt } from "@konduit/codec/integers/smallish";
import * as codec from "@konduit/codec";

export type BlockNo = Tagged<NonNegativeBigInt, "BlockNo">;
export const json2BlockNoCodec = codec.rmap(
  json2NonNegativeBigIntCodec,
  (nonNegative) => nonNegative as BlockNo,
  (blockNo: BlockNo): NonNegativeBigInt => blockNo as NonNegativeBigInt,
)

export type TxIx = Tagged<NonNegativeInt, "TxIx">;
export const json2TxIxCodec = codec.rmap(
  json2NonNegativeIntCodec,
  (nonNegative) => nonNegative as TxIx,
  (txIx: TxIx): NonNegativeInt => txIx as NonNegativeInt,
)

export type TxOutRef = { txId: TxHash, txIx: TxIx };
export const json2TxOutRefCodec: JsonCodec<TxOutRef> = jsonCodecs.objectOf({
  txId: json2TxHashCodec,
  txIx: json2TxIxCodec,
});


