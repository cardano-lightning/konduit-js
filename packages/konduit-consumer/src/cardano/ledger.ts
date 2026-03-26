import { json2StringCodec, type JsonCodec } from "@konduit/codec/json/codecs";
import * as hexString from "@konduit/codec/hexString";
import { err, ok, Result } from "neverthrow";
import type { Tagged } from "type-fest";
import { json2PositiveIntCodec, NonNegativeInt, PositiveInt } from "@konduit/codec/integers/smallish";
import * as codec from "@konduit/codec";
import { mkOrdForScalar, mkOrdForUint8Array } from "@konduit/codec/tagged";
import { Milliseconds, Seconds } from "../time/duration";
import { POSIXMilliseconds } from "../time/absolute";
import { PositiveBigInt } from "@konduit/codec/integers/big";
import type { Codec } from "@konduit/codec";
import type { HexString } from "@konduit/codec/hexString";
import { mkHexString2HashCodec } from "./keys";
import { mkTaggedBytesCborCodec } from "@konduit/codec/cbor/codecs/sync";

export type BlockNo = Tagged<NonNegativeInt, "BlockNo">;
export const json2BlockNoCodec = codec.rmap(
  NonNegativeInt.jsonCodec,
  (nonNegative) => nonNegative as BlockNo,
  (blockNo: BlockNo): NonNegativeInt => blockNo as NonNegativeInt
)
// 5c571f83fe6c784d3fbc223792627ccf0eea96773100f9aedecf8b1eda4544d7
export type BlockHash = Tagged<Uint8Array, "BlockHash">;
export namespace BlockHash {
  export const LENGTH = 32;
  export const fromHexString = (hexString: HexString) => BlockHash.hexStringCodec.deserialise(hexString);
  export const fromBytes = (bytes: Uint8Array) => {
    if (bytes.length !== LENGTH) {
      return err(`BlockHash must be ${LENGTH} bytes, got ${bytes.length} bytes`);
    }
    return ok(bytes as BlockHash);
  }
  export const hexStringCodec = mkHexString2HashCodec<BlockHash>("BlockHash", LENGTH);
  export const jsonCodec = codec.pipe(hexString.jsonCodec, hexStringCodec);
  export const cborCodec = mkTaggedBytesCborCodec<BlockHash>(
    "BlockHash",
    (arr) => arr.length === LENGTH,
  );
  export const ord = mkOrdForUint8Array<BlockHash>();
}

export type SlotConfigComponents = {
  slotLength: Milliseconds,
  zeroSlot: SlotNo,
  zeroTime: POSIXMilliseconds,
}
export type SlotConfig = Tagged<SlotConfigComponents, "SlotConfig">;
export namespace SlotConfig {
  export const BYRON_ERA_SLOT_LENGTH = Milliseconds.fromSeconds(Seconds.fromDigits(2, 0));
  export const fromComponents = (components: SlotConfigComponents): Result<SlotConfig, string> => {
    if(components.slotLength == 0) {
      return err("slotLength must be greater than 0");
    }
    return ok(components as SlotConfig);
  }

  export const MAINNET: SlotConfig = {
    slotLength: 1000 as Milliseconds,
    zeroSlot: 4492800 as SlotNo,
    zeroTime: 1506203091000 as POSIXMilliseconds, // 2017-09-23T21:44:51Z
  } as SlotConfig;

  export const PREPROD: SlotConfig = {
    slotLength: 1000 as Milliseconds,
    zeroSlot: 0 as SlotNo,
    zeroTime: 1654041600000 as POSIXMilliseconds, // 2022-06-01T00:00:00Z
  } as SlotConfig;

  export const PREVIEW: SlotConfig = {
    slotLength: 1000 as Milliseconds,
    zeroSlot: 0 as SlotNo,
    zeroTime: 1666656000000 as POSIXMilliseconds, // 2022-10-25T00:00:00Z
  } as SlotConfig;

}

export type SlotNo = Tagged<NonNegativeInt, "SlotNo">;
export namespace SlotNo {
  export const fromNonNegativeInt = (nonNegative: NonNegativeInt): SlotNo => nonNegative as SlotNo;
  export const distance = (slotNo1: SlotNo, slotNo2: SlotNo): NonNegativeInt => {
    return NonNegativeInt.distance(slotNo1, slotNo2) as NonNegativeInt;
  }
  export const jsonCodec = codec.rmap(
    NonNegativeInt.jsonCodec,
    (nonNegative) => nonNegative as SlotNo,
    (blockNo: SlotNo): NonNegativeInt => blockNo as NonNegativeInt
  )
  export const toPOSIXMilliseconds = (slotNo: SlotNo, slotConfig: SlotConfig): Result<POSIXMilliseconds, string> => {
    const shelleyDistanceInSlots = NonNegativeInt.distance(slotNo, slotConfig.zeroSlot);
    return Milliseconds.scale(slotConfig.slotLength, shelleyDistanceInSlots)
      .andThen((shellyDistanceInMs) => Milliseconds.scale(SlotConfig.BYRON_ERA_SLOT_LENGTH, slotConfig.zeroSlot)
        .andThen((byronEraDurationInMs) => Milliseconds.add(shellyDistanceInMs, byronEraDurationInMs)))
      .andThen((totalDistanceInMs) => POSIXMilliseconds.addMilliseconds(
        slotConfig.zeroTime,
        totalDistanceInMs,
      ));
  }
}
export type BlockDepth = Tagged<NonNegativeInt, "BlockDepth">;
export namespace BlockDepth {
  export const fromNonNegativeInt = (n: NonNegativeInt): BlockDepth => n as BlockDepth;
  export const distance = (blockNo1: BlockNo, blockNo2: BlockNo): BlockDepth => {
    return NonNegativeInt.distance(blockNo1, blockNo2) as BlockDepth;
  }
  export const ord = mkOrdForScalar<BlockDepth>();
  export const jsonCodec = codec.rmap(
    NonNegativeInt.jsonCodec,
    (nonNegative) => nonNegative as BlockDepth,
    (blockDepth: BlockDepth): NonNegativeInt => blockDepth,
  )
}

export type PublicNetwork = "Mainnet" | "Preprod" | "Preview";
export namespace PublicNetwork {
  export const MAINNET: PublicNetwork = "Mainnet";
  export const PREPROD: PublicNetwork = "Preprod";
  export const PREVIEW: PublicNetwork = "Preview";
}
export type NetworkMagicNumber = Tagged<PositiveBigInt, "NetworkMagicNumber">;
export namespace NetworkMagicNumber {
  export const fromPositiveBigInt = (v: PositiveBigInt): NetworkMagicNumber => v as NetworkMagicNumber;
  export const MAINNET = 764824073n as NetworkMagicNumber;
  export const PREPROD = 1n as NetworkMagicNumber;
  export const PREVIEW = 2n as NetworkMagicNumber;

  export const fromPublicNetwork = (network: PublicNetwork): NetworkMagicNumber => {
    switch (network) {
      case "Mainnet":
        return NetworkMagicNumber.MAINNET;
      case "Preprod":
        return NetworkMagicNumber.PREPROD;
      case "Preview":
        return NetworkMagicNumber.PREVIEW;
    }
  }
  export const jsonCodec: JsonCodec<NetworkMagicNumber> = codec.rmap(
    PositiveBigInt.jsonCodec,
    (positiveBigInt) => positiveBigInt as NetworkMagicNumber,
    (networkMagicNumber: NetworkMagicNumber): PositiveBigInt => networkMagicNumber as PositiveBigInt,
  )
}
export namespace PublicNetwork {
  export const fromNetworkMagicNumber = (networkMagicNumber: NetworkMagicNumber): Result<PublicNetwork, string> => {
    switch (networkMagicNumber) {
      case NetworkMagicNumber.MAINNET:
        return ok("Mainnet");
      case NetworkMagicNumber.PREPROD:
        return ok("Preprod");
      case NetworkMagicNumber.PREVIEW:
        return ok("Preview");
      default:
        return err(`Unknown network magic number: ${networkMagicNumber}`);
    }
  }
  export const fromString = (s: string): Result<PublicNetwork, string> => {
    switch (s) {
      case "Mainnet":
        return ok("Mainnet");
      case "Preprod":
        return ok("Preprod");
      case "Preview":
        return ok("Preview");
      default:
        return err(`Unknown network: ${s}, expected "Mainnet", "Preprod" or "Preview"`);
    }
  }
  export const jsonCodec: JsonCodec<PublicNetwork> = codec.pipe(
    json2StringCodec, {
      deserialise: (s) => fromString(s),
      serialise: (network) => network,
    }
  )
}
// To help the compiler do exhaustiveness checks
// we expose also the naked enum type.
export type PlutusVersionEnum = "V1" | "V2" | "V3";
export type PlutusVersion = Tagged<PlutusVersionEnum, "PlutusVersion">;
export namespace PlutusVersion {
  export const V1: PlutusVersion = "V1" as PlutusVersion;
  export const V2: PlutusVersion = "V2" as PlutusVersion;
  export const V3: PlutusVersion = "V3" as PlutusVersion;
  export const positiveIntCodec: Codec<PositiveInt, PlutusVersion, string> = {
    deserialise: (positiveInt: PositiveInt) => {
      switch (positiveInt) {
        case 1:
          return ok("V1" as PlutusVersion);
        case 2:
          return ok("V2" as PlutusVersion);
        case 3:
          return ok("V3" as PlutusVersion);
      }
      return err(`Invalid reference script version: ${positiveInt}, expected 1, 2 or 3`);
    },
    serialise: (plutusVersion: PlutusVersion) => {
      switch (plutusVersion as PlutusVersionEnum) {
        case "V1":
          return PositiveInt.fromDigits(1);
        case "V2":
          return PositiveInt.fromDigits(2);
        case "V3":
          return PositiveInt.fromDigits(3);
      }
    }
  }
  export const jsonCodec: JsonCodec<PlutusVersion> = codec.pipe(
    json2PositiveIntCodec,
    positiveIntCodec,
  )
}

