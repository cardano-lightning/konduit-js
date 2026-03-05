import type * as typeFest from "type-fest";
import { sha256 } from "@noble/hashes/sha2.js";
export * from "./addressses";
import { err, ok } from "neverthrow";
import * as codec from "@konduit/codec";
import { mkHexString2HashCodec } from "./keys";
import type { HexString } from "@konduit/codec/hexString";
import * as hexString from "@konduit/codec/hexString";
import type { Json } from "@konduit/codec/json";
import { TransactionReadyForSigning } from "../../wasm/konduit_wasm";
import type { Tagged } from "type-fest";
import { Result } from "neverthrow";
import * as uint8Array from "@konduit/codec/uint8Array";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import * as cborCodecs from "@konduit/codec/cbor/codecs/sync";
import type { JsonError, JsonCodec } from "@konduit/codec/json/codecs";
import { NonNegativeInt } from "@konduit/codec/integers/smallish";
import { altCborCodecs, cbor2EmbededCborCodec, json2CborCodec, mkTaggedBytesCborCodec, type CborCodec } from "@konduit/codec/cbor/codecs/sync";
import { Address } from "./addressses";
import type { Cbor } from "@konduit/codec/cbor/core";
import { Value } from "./assets";
import { mkOrdForUint8Array } from "@konduit/codec/tagged";

// We do not provide validation for TxCborBytes and TxBodyCborBytes here. Please use it when you can trust the source of the CBOR.
export type TxCborBytes = typeFest.Tagged<Uint8Array, "TxCborBytes">;
export namespace TxCborBytes {
  export const fromTxReadyForSigning = (txReadyForSigning: TransactionReadyForSigning) => txReadyForSigning.toCbor() as TxCborBytes;
}
export const unsafeTxCborBytes = (cbor: Uint8Array): TxCborBytes => cbor as TxCborBytes;

export type TxBodyCborBytes = typeFest.Tagged<Uint8Array, "TxBodyCborBytes">;
export const unsafeTxBodyCborBytes = (cbor: Uint8Array): TxBodyCborBytes => cbor as TxBodyCborBytes;


export type DatumHash = Tagged<Uint8Array, "DatumHash">;
export namespace DatumHash {
  export const LENGTH = 32;
  export const fromBytes = (bytes: Uint8Array): Result<DatumHash, JsonError> => {
    if (bytes.length !== LENGTH) {
      return err(`DatumHash must be ${LENGTH} bytes, got ${bytes.length} bytes`);
    }
    return ok(bytes as DatumHash);
  }
  export const fromJson = (json: Json): Result<DatumHash, JsonError> => jsonCodec.deserialise(json);
  export const fromCbor = (data: Cbor): Result<DatumHash, JsonError> => cborCodec.deserialise(data);

  export const hexStringCodec: codec.Codec<HexString, DatumHash, JsonError> = uint8Array.mkTaggedHexStringCodec<DatumHash>(
    "DatumHash",
    (arr) => arr.length === DatumHash.LENGTH,
  );
  export const jsonCodec: JsonCodec<DatumHash> = codec.pipe(
    hexString.jsonCodec,
    codec.rmap(hexStringCodec, (datumHash) => datumHash as DatumHash, (datumHash) => datumHash)
  );
  export const cborCodec: CborCodec<DatumHash> = mkTaggedBytesCborCodec<DatumHash>(
    "DatumHash",
    (arr) => arr.length === DatumHash.LENGTH,
  );
}

// ```cddl
// alonzo_transaction_output = [address, amount : value, ? datum_hash : hash32]
// ```
export type AlonzoTxOut = {
  address: Address;
  value: Value;
  datumHash: DatumHash | null;
};
export namespace AlonzoTxOut {
  export const fromJson = (json: Json): Result<AlonzoTxOut, JsonError> => jsonCodec.deserialise(json);

  export const jsonCodec: JsonCodec<AlonzoTxOut> = jsonCodecs.objectOf({
    address: Address.jsonCodec,
    value: Value.jsonCodec,
    datumHash: jsonCodecs.nullable(DatumHash.jsonCodec)
  });

  export const cborCodec: CborCodec<AlonzoTxOut> = codec.rmap(
    cborCodecs.altCborCodecs(
      [ cborCodecs.tupleOf(cborCodecs.definiteLength, Address.cborCodec, Value.cborCodec),
        cborCodecs.tupleOf(cborCodecs.definiteLength, Address.cborCodec, Value.cborCodec, DatumHash.cborCodec)
      ],
      (serTuple, serTriple) => (val: [Address, Value] | [Address, Value, DatumHash]) => {
        if (val.length === 2) serTuple(val);
        return serTriple(val as [Address, Value, DatumHash]);
      }
    ),
    (val) => ({
      address: val[0],
      value: val[1],
      datumHash: val.length === 3 ? val[2] : null
    }),
    (txOut: AlonzoTxOut) => {
      if (txOut.datumHash) {
        return [txOut.address, txOut.value, txOut.datumHash] as [Address, Value, DatumHash];
      }
      return [txOut.address, txOut.value] as [Address, Value];
    }
  );
}

// FIXME: Bytes of the reference script:
//
// ```cddl
// script_ref = #6.24(bytes .cbor script)
// ```
export type ReferenceScript = Tagged<Cbor, "ReferenceScript">;
export namespace ReferenceScript {
  export const fromJson = (json: Json): Result<ReferenceScript, JsonError> => jsonCodec.deserialise(json);
  export const fromCbor = (data: Cbor): Result<ReferenceScript, JsonError> => cborCodec.deserialise(data);
  export const jsonCodec: JsonCodec<ReferenceScript> = codec.rmap(
    json2CborCodec,
    (cbor: Cbor) => cbor as ReferenceScript,
    (referenceScript: ReferenceScript) => referenceScript as Cbor
  );
  export const cborCodec: CborCodec<ReferenceScript> = codec.rmap(
    cbor2EmbededCborCodec,
    (cbor: Cbor) => cbor as ReferenceScript,
    (referenceScript: ReferenceScript) => referenceScript as Cbor
  );
}

// ```cddl
// data = #6.24(bytes .cbor plutus_data)
// ```
export type PlutusData = Tagged<Cbor, "PlutusData">;
export namespace PlutusData {
  export const fromJson = (json: Json): Result<PlutusData, JsonError> => jsonCodec.deserialise(json);
  export const fromCbor = (data: Cbor): Result<PlutusData, JsonError> => cborCodec.deserialise(data);
  export const jsonCodec: JsonCodec<PlutusData> = codec.rmap(
    json2CborCodec,
    (cbor) => cbor as PlutusData,
    (plutusData) => plutusData as Cbor
  );
  export const cborCodec: CborCodec<PlutusData> = codec.rmap(
    cbor2EmbededCborCodec,
    (cbor: Cbor) => cbor as PlutusData,
    (plutusData: PlutusData) => plutusData as Cbor
  );
}

// We introduce a tag around PlutusData to distinguish it easily
// at runtime from the DatumHash in the DatumOption below.
export type InlineDatum = { plutusData: PlutusData };

export namespace InlineDatum {
  export const fromJson = (json: Json): Result<InlineDatum, JsonError> => jsonCodec.deserialise(json);
  export const fromCbor = (data: Cbor): Result<InlineDatum, JsonError> => cborCodec.deserialise(data);

  export const jsonCodec: JsonCodec<InlineDatum> = codec.rmap(
    jsonCodecs.objectOf({
      plutusData: PlutusData.jsonCodec
    }),
    (obj) => ({ plutusData: obj.plutusData } as InlineDatum),
    (datum: InlineDatum) => ({ plutusData: datum.plutusData })
  );
  // export const cbor2EmbededCborCodec: CborCodec<Cbor> = {
  export const cborCodec: CborCodec<InlineDatum> = codec.rmap(
    PlutusData.cborCodec,
    (cbor: PlutusData) => ({ plutusData: cbor }) as InlineDatum,
    (datum: InlineDatum) => datum.plutusData
  );
}

export type DatumOption = InlineDatum | DatumHash;
export namespace DatumOption {
  export const fromJson = (json: Json): Result<DatumOption, JsonError> => jsonCodec.deserialise(json);
  export const fromCbor = (data: Cbor): Result<DatumOption, JsonError> => cborCodec.deserialise(data);

  export const jsonCodec: JsonCodec<DatumOption> = jsonCodecs.altJsonCodecs(
    [InlineDatum.jsonCodec, DatumHash.jsonCodec],
    (serInlineDatum, serDatumHash) => (val: DatumOption) => {
      if ("plutusData" in val) {
        return serInlineDatum(val);
      }
      return serDatumHash(val);
    }
  );
  // ```cddl
  // datum_option = [0, hash32 // 1, data]
  // ```
  export const cborCodec: CborCodec<DatumOption> = (() => {
    const baseTupleCodec = altCborCodecs(
      [
        cborCodecs.tupleOf(
          cborCodecs.definiteLength,
          cborCodecs.mkCbor2ConstBigIntCodec<0n>(0n),
          DatumHash.cborCodec
        ),
        cborCodecs.tupleOf(
          cborCodecs.definiteLength,
          cborCodecs.mkCbor2ConstBigIntCodec<1n>(1n),
          PlutusData.cborCodec
        )
      ],
      (serHash, serData) => (val) => {
        if (val[0] == 1n) {
          return serData(val);
        }
        return serHash(val);
      }
    );
    return codec.rmap(
      baseTupleCodec,
      (val) => {
        if (val[0] === 1n) {
          return { plutusData: val[1] } as DatumOption;
        }
        return val[1] as DatumHash;
      },
      (datumOption: DatumOption) => {
        if ("plutusData" in datumOption) {
          return [1n, datumOption.plutusData] as ([0n, DatumHash ] | [1n, PlutusData]);
        }
        return [0n, datumOption] as ([0n, DatumHash ] | [1n, PlutusData]);
      }
    );
  })();
}


// babbage_transaction_output =
// ```cddl
//   {   0 : address
//   ,   1 : value
//   , ? 2 : datum_option ; new
//   , ? 3 : script_ref   ; new
//   }
// ```
export type BabbageTxOut = {
  address: Address;
  value: Value;
  datumOption: DatumOption | null;
  scriptRef: ReferenceScript | null;
}
export namespace BabbageTxOut {
  export const fromJson = (json: Json): Result<BabbageTxOut, JsonError> => jsonCodec.deserialise(json);

  export const jsonCodec: JsonCodec<BabbageTxOut> = jsonCodecs.objectOf({
    address: Address.jsonCodec,
    value: Value.jsonCodec,
    datumOption: jsonCodecs.nullable(DatumOption.jsonCodec),
    scriptRef: jsonCodecs.nullable(ReferenceScript.jsonCodec)
  });

  export const cborCodec: CborCodec<BabbageTxOut> = (() => {
    type TxOutTuple = [[0n, Address], [1n, Value], [2n, DatumOption] | null, [3n, ReferenceScript] | null]
    const mapCodec: CborCodec<TxOutTuple> = cborCodecs.heterogeneousMapOf(
      cborCodecs.definiteLength,
      [cborCodecs.mkCbor2ConstBigIntCodec<0n>(0n), Address.cborCodec],
      [cborCodecs.mkCbor2ConstBigIntCodec<1n>(1n), Value.cborCodec],
      cborCodecs.mkOptionalEntry(cborCodecs.mkCbor2ConstBigIntCodec<2n>(2n), DatumHash.cborCodec),
      cborCodecs.mkOptionalEntry(cborCodecs.mkCbor2ConstBigIntCodec<3n>(3n), ReferenceScript.cborCodec)
    );
    return codec.rmap(mapCodec,
      (val: TxOutTuple) => {
          const [addressEntry, valueEntry, datumOptionEntry, scriptRefEntry] = val;
          return {
            address: addressEntry[1],
            value: valueEntry[1],
            datumOption: datumOptionEntry ? datumOptionEntry[1] : null,
            scriptRef: scriptRefEntry ? scriptRefEntry[1] : null
          } as BabbageTxOut;
      },
      (txOut: BabbageTxOut): TxOutTuple => {
        return [
          [0n, txOut.address],
          [1n, txOut.value],
          txOut.datumOption?[2n, txOut.datumOption] : null,
          txOut.scriptRef?[3n, txOut.scriptRef] : null
        ];
      }
    );
  })();
}

// transaction_output = alonzo_transaction_output/ babbage_transaction_output
export type TxOut = AlonzoTxOut | BabbageTxOut;
export namespace TxOut {
  export const fromJson = (json: Json): Result<TxOut, JsonError> => jsonCodec.deserialise(json);
  export const fromCbor = (data: Cbor): Result<TxOut, JsonError> => cborCodec.deserialise(data);
  export const jsonCodec: JsonCodec<TxOut> = jsonCodecs.altJsonCodecs(
    [AlonzoTxOut.jsonCodec, BabbageTxOut.jsonCodec],
    (serAlonzo, serBabbage) => (val: TxOut) => {
      if ("datumOption" in val)
        return serBabbage(val);
      return serAlonzo(val);
    }
  );
  export const cborCodec: CborCodec<TxOut> = (() => {
    return altCborCodecs(
      [AlonzoTxOut.cborCodec, BabbageTxOut.cborCodec],
      (serAlonzo, serBabbage) => (val: TxOut) => {
        if ("datumOption" in val)
          return serBabbage(val);
        return serAlonzo(val);
      }
    );
  })();
}

export type TxHash = Tagged<Uint8Array, "TxHash">;
export type TxId = TxHash;

export namespace TxHash {
  export const LENGTH = 32;
  export const fromHexString = (hexString: HexString) => TxHash.hexStringCodec.deserialise(hexString);
  export const fromBytes = (bytes: Uint8Array) => {
    if (bytes.length !== LENGTH) {
      return err(`TxHash must be ${LENGTH} bytes, got ${bytes.length} bytes`);
    }
    return ok(bytes as TxHash);
  }
  export const fromTxBodyCborBytes = (txBodyCbor: TxBodyCborBytes) => sha256(txBodyCbor) as TxHash;
  export const fromJson = (json: Json) => TxHash.jsonCodec.deserialise(json);

  export const hexStringCodec = mkHexString2HashCodec<TxHash>("TxHash", LENGTH);
  export const jsonCodec = codec.pipe(hexString.jsonCodec, hexStringCodec);
  export const cborCodec = mkTaggedBytesCborCodec<TxHash>(
    "TxHash",
    (arr) => arr.length === LENGTH,
  );
  export const ord = mkOrdForUint8Array<TxHash>();
}

// TODO: Redundant - we have TxOutRef in the ledger module.
export type TxInput = Tagged<[TxId, NonNegativeInt], "TxInput">;
export namespace TxInput {
  export const fromJson = (json: Json): Result<TxInput, JsonError> => jsonCodec.deserialise(json);

  export const jsonCodec: JsonCodec<TxInput> = codec.rmap(
    jsonCodecs.tupleOf(
      TxHash.jsonCodec,
      NonNegativeInt.jsonCodec
    ),
    (val) => val as TxInput,
    (txInput) => txInput
  );

  // ```cddl
  // transaction_input = [transaction_id : transaction_id, index : uint .size 2]
  // transaction_id = hash32
  // ```
  export const cborCodec: CborCodec<TxInput> = codec.rmap(
    cborCodecs.tupleOf(
      cborCodecs.definiteLength,
      TxHash.cborCodec,
      NonNegativeInt.cborCodec,
    ),
    (val) => val as TxInput,
    (txInput) => txInput
  );
}

// CIP-30, unspent output encoding:
// ```cddl
// transaction_unspent_output = [
//   input: transaction_input,
//   output: transaction_output,
// ]
// ```
export type TransactionUnspentOutput = {
  input: TxInput;
  output: TxOut;
}
export namespace TransactionUnspentOutput {
  export const fromJson = (json: Json): Result<TransactionUnspentOutput, JsonError> => jsonCodec.deserialise(json);
  export const fromCbor = (data: Cbor): Result<TransactionUnspentOutput, JsonError> => cborCodec.deserialise(data);
  export const jsonCodec: JsonCodec<TransactionUnspentOutput> = jsonCodecs.objectOf({
    input: TxInput.jsonCodec,
    output: TxOut.jsonCodec
  });
  export const cborCodec: CborCodec<TransactionUnspentOutput> = codec.rmap(
    cborCodecs.tupleOf(
      cborCodecs.definiteLength,
      TxInput.cborCodec,
      TxOut.cborCodec
    ),
    (val) => ({
      input: val[0],
      output: val[1]
    }),
    (txUnspentOutput: TransactionUnspentOutput) =>
      [txUnspentOutput.input, txUnspentOutput.output] as [TxInput, TxOut]
  );
}


