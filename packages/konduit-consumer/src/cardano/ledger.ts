import { json2NonNegativeBigIntCodec, NonNegativeBigInt } from "@konduit/codec/integers/big";
import { JsonCodec } from "@konduit/codec/json/codecs";
import { Tagged } from "type-fest";

export type BlockNo = Tagged<NonNegativeBigInt, "BlockNo">;
export const json2BlockNoCodec = json2NonNegativeBigIntCodec as JsonCodec<BlockNo>;
