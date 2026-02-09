import { err, ok, Result } from "neverthrow";
import type { Tagged } from "type-fest";
import type { Cbor } from "../core";
import {
  Indefinite,
  isCborNull,
  isCborUndefined,
  isIndefiniteArray,
  isIndefiniteMap,
} from "../core";
import { CborTag, CborSimpleValue, cborUndefined, cborNull } from "../core";
import { CborReader, CborReaderState } from "../CborReader";
import { CborWriter } from "../CborWriter";
import type { Codec, Deserialiser, Serialiser } from "../../codec";
import type { JsonError } from "../../json/codecs";

export type CborCodec<O> = Codec<Cbor, O, JsonError>;

export type CborSerialiser<O> = Serialiser<O, Cbor>;

export type CborDeserialiser<O> = Deserialiser<Cbor, O, JsonError>;

export type CborMatcher<T> = {
  onInteger: (value: bigint) => T;
  onByteString: (value: Uint8Array) => T;
  onTextString: (value: string) => T;

  // Definite-length array: fully materialised list of children
  onArray: (value: Cbor[]) => T;
  // Indefinite-length array: children plus flag that it was indefinite
  onIndefiniteArray: (value: Cbor[]) => T;

  // Definite-length map
  onMap: (value: Map<Cbor, Cbor>) => T;
  // Indefinite-length map
  onIndefiniteMap: (value: Map<Cbor, Cbor>) => T;

  onTag: (tag: CborTag, value: Cbor) => T;
  onFloat16: (value: number) => T;
  onFloat32: (value: number) => T;
  onFloat64: (value: number) => T;
  onNull: () => T;
  onUndefined: () => T;
  onBoolean: (value: boolean) => T;
};

export const matchCbor = <T>(cbor: Cbor, matcher: CborMatcher<T>): T => {
  if (typeof cbor === "bigint") {
      return matcher.onInteger(cbor);
  }

  if (cbor instanceof Uint8Array) {
    return matcher.onByteString(cbor);
  }

  if (typeof cbor === "string") {
    return matcher.onTextString(cbor);
  }

  // Indefinite-length byte or text strings are represented via Indefinite<Uint8Array|string>.
  if (cbor instanceof Indefinite) {
    const items = cbor.items;
    if (items instanceof Uint8Array) {
      // Indefinite-length byte string
      return matcher.onIndefiniteArray([items]);
    }
    if (typeof items === "string") {
      // Indefinite-length text string
      return matcher.onIndefiniteArray([items as unknown as Cbor]);
    }
  }

  if (Array.isArray(cbor)) {
    return matcher.onArray(cbor);
  }

  if (cbor instanceof Map) {
    return matcher.onMap(cbor);
  }

  if (typeof cbor === "number") {
    // We do not know whether it was encoded as float16/32/64; call the most general.
    return matcher.onFloat64(cbor);
  }

  if (cbor === null) {
    return matcher.onNull();
  }

  if (typeof cbor === "boolean") {
    return matcher.onBoolean(cbor);
  }

  if (isCborUndefined(cbor)) {
    return matcher.onUndefined();
  }

  if (isCborNull(cbor)) {
    return matcher.onNull();
  }

  if (typeof cbor === "object" && "tag" in cbor && "value" in cbor) {
    const { tag, value } = cbor as { tag: CborTag; value: Cbor };
    return matcher.onTag(tag, value);
  }

  // Fallback for unexpected shapes
  throw new Error("Unknown CBOR value shape");
};

export const deserialiseCbor = (bytes: Uint8Array): Result<Cbor, JsonError> => {
  const reader = new CborReader(bytes);

  const readValue = (): Result<Cbor, JsonError> => {
    return reader.peekState().andThen((state) => {
      switch (state) {
        case CborReaderState.UnsignedInteger:
          return reader.readUInt();

        case CborReaderState.NegativeInteger:
          return reader.readInt();

        case CborReaderState.ByteString:
          return reader.readByteString();

        case CborReaderState.TextString:
          return reader.readTextString();

        case CborReaderState.Boolean:
          return reader.readBoolean();

        case CborReaderState.Null:
          return reader.readNull().map(() => cborNull);

        // Not sure why but the CborReader can have overlapping
        // states for simpe values.
        case CborReaderState.SimpleValue:
          return reader.readSimpleValue().andThen((simple) => {
            switch (simple) {
              case CborSimpleValue.Undefined:
                return ok(cborUndefined);
              case CborSimpleValue.Null:
                return ok(cborNull);
              case CborSimpleValue.True:
                return ok(true);
              case CborSimpleValue.False:
                return ok(false);
              default:
                return err(`Unsupported simple value: ${simple}`);
            }
          });

        case CborReaderState.StartArray:
          return readArray();

        case CborReaderState.StartMap:
          return readMap();

        default:
          // Arrays, maps, tags, floats, etc. are not yet supported in this step.
          return err(`deserialiseCbor: unsupported initial CBOR state ${state}`);
      }
    });
  };

  const readArray = (): Result<Cbor, JsonError> => {
    return reader.readStartArray().andThen((length) => {
      const items: Cbor[] = [];

      if (length === null) {
        // Indefinite-length array
        const loop = (): Result<Cbor[], JsonError> => {
          return reader.peekState().andThen((state) => {
            if (state === CborReaderState.EndArray) {
              return reader.readEndArray().map(() => items);
            }
            return readValue().andThen((val) => {
              items.push(val);
              return loop();
            });
          });
        };
        return loop().map((vals) => new Indefinite(vals as Cbor[]));
      } else {
        // Definite-length array
        const loop = (remaining: number): Result<Cbor[], JsonError> => {
          if (remaining === 0) {
            return reader.readEndArray().map(() => items);
          }
          return readValue().andThen((val) => {
            items.push(val);
            return loop(remaining - 1);
          });
        };
        return loop(length).map((vals) => vals as Cbor[]);
      }
    });
  };

  const readMap = (): Result<Cbor, JsonError> => {
    return reader.readStartMap().andThen((length) => {
      const map = new Map<Cbor, Cbor>();

      if (length === null) {
        // Indefinite-length map
        const loop = (): Result<Map<Cbor, Cbor>, JsonError> => {
          return reader.peekState().andThen((state) => {
            if (state === CborReaderState.EndMap) {
              return reader.readEndMap().map(() => map);
            }
            return readValue()
              .andThen((key) =>
                readValue().map((value) => {
                  map.set(key, value);
                  return map;
                })
              )
              .andThen(() => loop());
          });
        };
        return loop().map((m) => new Indefinite(m));
      } else {
        // Definite-length map
        const loop = (remainingPairs: number): Result<Map<Cbor, Cbor>, JsonError> => {
          if (remainingPairs === 0) {
            return reader.readEndMap().map(() => map);
          }
          return readValue()
            .andThen((key) =>
              readValue().map((value) => {
                map.set(key, value);
                return map;
              })
            )
            .andThen(() => loop(remainingPairs - 1));
        };
        return loop(length);
      }
    });
  };
  return readValue();
};

/**
 * Serialises a CBOR AST value into encoded bytes using CborWriter.
 */
export const serialiseCbor = (value: Cbor): Uint8Array => {
  const writer = new CborWriter();

  const writeValue = (v: Cbor): void => {
    if (isCborNull(v)) {
      writer.writeNull();
      return;
    }

    if (isCborUndefined(v)) {
      writer.writeUndefined();
      return;
    }

    if (typeof v === "boolean") {
      writer.writeBoolean(v);
      return;
    }

    if (typeof v === "bigint") {
      writer.writeInt(v);
      return;
    }

    if (typeof v === "string") {
      writer.writeTextString(v);
      return;
    }

    if (v as any instanceof Uint8Array) {
      writer.writeByteString(v);
      return;
    }

    // indefinite wrappers
    if (isIndefiniteArray(v)) {
      // Don't ask me why the above narrowing is not working
      let arr = v as Indefinite<Cbor[]>;
      writer.writeStartArray();
      for (const item of arr.items) {
        writeValue(item);
      }
      writer.writeEndArray();
      return;
    }

    if (isIndefiniteMap(v)) {
      let m = v as Indefinite<Map<Cbor, Cbor>>;
      writer.writeStartMap();
      // Same as above
      for (const [k, val] of m.items.entries()) {
        writeValue(k);
        writeValue(val);
      }
      writer.writeEndMap();
      return;
    }

    if (Array.isArray(v)) {
      // Same as above
      let arr = v as Cbor[];
      writer.writeStartArray(arr.length);
      for (const item of arr) {
        writeValue(item);
      }
      return;
    }

    if (v as any instanceof Map) {
      // Same as above
      let m = v as Map<Cbor, Cbor>;
      writer.writeStartMap(m.size);
      for (const [k, val] of m.entries()) {
        writeValue(k);
        writeValue(val);
      }
      return;
    }

    // tagged
    if (typeof v === "object" && v !== null && "tag" in v && "value" in v) {
      writer.writeTag((v as { tag: CborTag }).tag as CborTag);
      writeValue((v as { value: Cbor }).value as Cbor);
      return;
    }
    // PANIC
    throw new Error(`serialiseCbor: unsupported CBOR AST node: ${String(v)}`);
  };
  writeValue(value);
  return writer.encode();
};

export const cbor2BooleanCodec: CborCodec<boolean> = {
  deserialise: (data: Cbor) => {
    if (typeof data === "boolean") {
      return ok(data);
    }
    return err(`Expected CBOR boolean but got: ${String(data)}`);
  },
  serialise: (value: boolean): Cbor => value,
};

export const cbor2StringCodec: CborCodec<string> = {
  deserialise: (data: Cbor) => {
    if (typeof data === "string") {
      return ok(data);
    }
    return err(`Expected CBOR text string but got: ${String(data)}`);
  },
  serialise: (value: string): Cbor => value,
};

/**
 * Codec for signed integers (CBOR major types 0 and 1).
 * Accepts any bigint and rejects non-bigint.
 */
export const cbor2IntCodec: CborCodec<bigint> = {
  deserialise: (data: Cbor) => {
    if (typeof data === "bigint") {
      return ok(data);
    }
    return err(`Expected CBOR integer but got: ${String(data)}`);
  },
  serialise: (value: bigint): Cbor => value,
};

export const cbor2ByteStringCodec: CborCodec<Uint8Array> = {
  deserialise: (data: Cbor) => {
    if (data instanceof Uint8Array) {
      return ok(data);
    }
    return err(`Expected CBOR byte string but got: ${String(data)}`);
  },
  serialise: (value: Uint8Array): Cbor => value,
};

export const cbor2TextStringCodec: CborCodec<string> = {
  deserialise: (data: Cbor) => {
    if (typeof data === "string") {
      return ok(data);
    }
    return err(`Expected CBOR text string but got: ${String(data)}`);
  },
  serialise: (value: string): Cbor => value,
};

export const cbor2NullCodec: CborCodec<null> = {
  deserialise: (data: Cbor) => {
    if (isCborNull(data)) {
      return ok(null);
    }
    return err(`Expected CBOR null but got: ${String(data)}`);
  },
  serialise: (_value: null): Cbor => cborNull,
};

export const cbor2UndefinedCodec: CborCodec<void> = {
  deserialise: (data: Cbor) => {
    if (isCborUndefined(data)) {
      return ok(undefined);
    }
    return err(`Expected CBOR undefined but got: ${String(data)}`);
  },
  serialise: (_value: void): Cbor => cborUndefined,
};

export const cbor2ArrayCodec: CborCodec<Cbor[]> = {
  deserialise: (data: Cbor) => {
    if (Array.isArray(data)) {
      return ok(data);
    }
    return err(`Expected CBOR definite array but got: ${String(data)}`);
  },
  serialise: (value: Cbor[]): Cbor => value,
};

export const indefiniteCbor2ArrayCodec: CborCodec<Indefinite<Cbor[]>> = {
  deserialise: (data: Cbor) => {
    if (isIndefiniteArray(data)) {
      return ok(data);
    }
    return err(`Expected CBOR indefinite array but got: ${String(data)}`);
  },
  serialise: (value: Indefinite<Cbor[]>): Cbor => value,
};

export const cbor2MapCodec: CborCodec<Map<Cbor, Cbor>> = {
  deserialise: (data: Cbor) => {
    if (data instanceof Map) {
      return ok(data);
    }
    return err(`Expected CBOR definite map but got: ${String(data)}`);
  },
  serialise: (value: Map<Cbor, Cbor>): Cbor => value,
};

export const indefiniteCbor2MapCodec: CborCodec<Indefinite<Map<Cbor, Cbor>>> = {
  deserialise: (data: Cbor) => {
    if (isIndefiniteMap(data)) {
      return ok(data);
    }
    return err(`Expected CBOR indefinite map but got: ${String(data)}`);
  },
  serialise: (value: Indefinite<Map<Cbor, Cbor>>): Cbor => value,
};

export type IsIndefinite = Tagged<boolean, "IsIndefinite">;
export const indefiniteLength = true as IsIndefinite;
export const definiteLength = false as IsIndefinite;

type DictFieldCodecs = Record<string, CborCodec<any>>;
type DictOfOutput<T extends DictFieldCodecs> = {
  [K in keyof T]?: T[K] extends CborCodec<infer O> ? O : never;
};

/**
 * dictOf:
 *  - `indefinite` flag controls whether serialisation uses definite or indefinite-length map.
 *  - fieldCodecs: object mapping string field names to CborCodec instances.
 *  - keys are always encoded as CBOR text strings.
 */
export const dictOf = <T extends DictFieldCodecs>(
  indefinite: IsIndefinite,
  fieldCodecs: T
): CborCodec<DictOfOutput<T>> => {
  return {
    deserialise: (data: Cbor) => {
      const map: Map<Cbor, Cbor> | undefined = (() => {
        if (!indefinite && data instanceof Map) {
          return data;
        }
        if (indefinite && isIndefiniteMap(data)) {
          return data.items;
        }
        return undefined;
      })();

      if (!map) {
        return err(`Expected CBOR map for dictOf but got: ${String(data)}`);
      }

      const result: Partial<DictOfOutput<T>> = {};
      const errors: Record<string, JsonError> = {};
      let hasErrors = false;

      for (const [key, rawVal] of map.entries()) {

        if(typeof key !== "string") {
          hasErrors = true;
          errors[String(key)] = `Expected string keys in dictOf but got: ${String(key)}`;
          continue;
        }
        const codec = fieldCodecs[key];
        if (!codec) {
          hasErrors = true;
          errors[key] = `Unexpected key in dictOf: ${key}`;
          continue;
        }
        codec.deserialise(rawVal).match(
          (val) => {
            (result as any)[key] = val;
          },
          (e) => {
            errors[key] = e;
            hasErrors = true;
          }
        );
      }

      if (hasErrors) {
        return err(errors as JsonError);
      }
      return ok(result as DictOfOutput<T>);
    },

    serialise: (value: DictOfOutput<T>): Cbor => {
      const map = new Map<Cbor, Cbor>();

      for (const key in fieldCodecs) {
        const codec = fieldCodecs[key];
        const fieldVal = (value as any)[key];
        if (fieldVal === undefined) {
          continue;
        }
        const cborKey: Cbor = key; // encode keys as CBOR text strings
        const cborVal = codec.serialise(fieldVal);
        map.set(cborKey, cborVal);
      }

      return indefinite ? new Indefinite(map) : map;
    },
  };
};

export const homogeneousMapOf = <K, V>(
  indefinite: IsIndefinite,
  keyCodec: CborCodec<K>,
  valueCodec: CborCodec<V>
): CborCodec<Map<K, V>> => {
  return {
    deserialise: (data: Cbor) => {
      const src: Map<Cbor, Cbor> | undefined = (() => {
        if (!indefinite && data instanceof Map) {
          return data;
        }
        if (indefinite && isIndefiniteMap(data)) {
          return data.items;
        }
        return undefined;
      })();

      if (!src) {
        return err(`Expected CBOR map for mapOf but got: ${String(data)}`);
      }

      const result = new Map<K, V>();
      const errors: JsonError[] = [];
      let hasErrors = false;

      for (const [rawKey, rawVal] of src.entries()) {
        const decodedKey = keyCodec.deserialise(rawKey);
        const decodedVal = valueCodec.deserialise(rawVal);

        if (decodedKey.isErr() || decodedVal.isErr()) {
          if (decodedKey.isErr()) errors.push(decodedKey.error);
          if (decodedVal.isErr()) errors.push(decodedVal.error);
          hasErrors = true;
          continue;
        }

        result.set(decodedKey.value, decodedVal.value);
      }

      if (hasErrors) {
        return err(errors as unknown as JsonError);
      }
      return ok(result);
    },

    serialise: (value: Map<K, V>): Cbor => {
      const map = new Map<Cbor, Cbor>();

      for (const [k, v] of value.entries()) {
        const cborKey = keyCodec.serialise(k);
        const cborVal = valueCodec.serialise(v);
        map.set(cborKey, cborVal);
      }

      return indefinite ? new Indefinite(map) : map;
    },
  };
};

type KeyValueCodecs = readonly [CborCodec<any>, CborCodec<any>];

/**
 * PairTupleOutput:
 *  - Given an array of [KeyCodec, ValueCodec] pairs, produces an N‑tuple type:
 *    [[K1, V1], [K2, V2], ...]
 *  - This models “an N‑tuple of 2‑tuples” directly in TypeScript.
 */
type PairTupleOutput<Pairs extends readonly KeyValueCodecs[]> = {
  [I in keyof Pairs]:
    Pairs[I] extends [CborCodec<infer K>, CborCodec<infer V>]
      ? [K, V]
      : never;
};

/**
 * heterogeneousMapOf:
 *  - Accepts `indefinite` flag and an N‑tuple of [KeyCodec, ValueCodec] pairs.
 *  - TypeScript side: N‑tuple of 2‑tuples with precise per‑slot types:
 *      [[K1, V1], [K2, V2], ...]
 *  - CBOR side: encoded as a CBOR map (definite / indefinite by `indefinite`).
 *  - We bind entry i in the map to pair i in the tuple. This is how we preserve
 *    tuple shape on top of a map representation.
 */
export const heterogeneousMapOf = <
  Pairs extends readonly KeyValueCodecs[]
>(
  indefinite: IsIndefinite,
  ...pairs: Pairs
): CborCodec<PairTupleOutput<Pairs>> => {
  type OutTuple = PairTupleOutput<Pairs>;

  return {
    deserialise: (data: Cbor) => {
      const src: Map<Cbor, Cbor> | undefined = (() => {
        if (!indefinite && data instanceof Map) {
          return data;
        }
        if (indefinite && isIndefiniteMap(data)) {
          return data.items;
        }
        return undefined;
      })();

      if (!src) {
        return err(
          `Expected CBOR map for tupleMapOfPairs but got: ${String(data)}`
        );
      }

      const entries = Array.from(src.entries());

      if (entries.length !== pairs.length) {
        return err(
          `Expected map with ${pairs.length} entries but got ${entries.length}`
        );
      }

      const out: any[] = [];
      const errors: JsonError[] = [];
      let hasErrors = false;

      pairs.forEach(([kCodec, vCodec], index) => {
        const [rawKey, rawVal] = entries[index];

        const dk = kCodec.deserialise(rawKey);
        const dv = vCodec.deserialise(rawVal);

        if (dk.isOk() && dv.isOk()) {
          out[index] = [dk.value, dv.value];
        } else {
          if (dk.isErr()) errors.push(dk.error);
          if (dv.isErr()) errors.push(dv.error);
          hasErrors = true;
        }
      });

      if (hasErrors) {
        return err(errors as unknown as JsonError);
      }

      return ok(out as OutTuple);
    },

    serialise: (value: OutTuple): Cbor => {
      const map = new Map<Cbor, Cbor>();

      pairs.forEach(([kCodec, vCodec], index) => {
        const [k, v] = value[index] as any;
        const cborKey = kCodec.serialise(k);
        const cborVal = vCodec.serialise(v);
        map.set(cborKey, cborVal);
      });

      return indefinite ? new Indefinite(map) : map;
    },
  };
};

export const tupleOf = <Codecs extends readonly CborCodec<any>[]>(
  indefinite: IsIndefinite,
  ...codecs: Codecs
): CborCodec<{ [K in keyof Codecs]: Codecs[K] extends CborCodec<infer O> ? O : never }> => {
  type TupleOut = { [K in keyof Codecs]: Codecs[K] extends CborCodec<infer O> ? O : never };

  return {
    deserialise: (data: Cbor) => {
      // Accept both definite arrays and Indefinite<Cbor[]>
      let items: Cbor[] | undefined;

      if (!indefinite && Array.isArray(data)) {
        items = data;
      } else if (indefinite && isIndefiniteArray(data)) {
        items = data.items;
      } else {
        return err(`Expecting ${indefinite ? "indefinite" : "definite"} CBOR array for tupleOf but got: ${String(data)}`);
      }

      if (items.length !== codecs.length) {
        return err(
          `Expected tuple of length ${codecs.length} but got array of length ${items.length}`
        );
      }

      const result: any[] = [];
      const errors: JsonError[] = [];
      let hasErrors = false;

      codecs.forEach((codec, index) => {
        const value = items![index];
        const decoded = codec.deserialise(value);
        if (decoded.isOk()) {
          result[index] = decoded.value;
        } else {
          errors.push(decoded.error);
          hasErrors = true;
        }
      });

      if (hasErrors) {
        return err(errors as unknown as JsonError);
      }

      return ok(result as TupleOut);
    },

    serialise: (value: TupleOut): Cbor => {
      const arr: Cbor[] = [];

      codecs.forEach((codec, index) => {
        const v = (value as any)[index];
        arr.push(codec.serialise(v));
      });

      return indefinite ? new Indefinite(arr as Cbor[]) : arr;
    },
  };
};

export const arrayOf = <T>(
  indefinite: IsIndefinite,
  itemCodec: CborCodec<T>
): CborCodec<T[]> => {
  return {
    deserialise: (data: Cbor) => {
      let items: Cbor[] | undefined;

      if (!indefinite && Array.isArray(data)) {
        items = data;
      } else if (indefinite && isIndefiniteArray(data)) {
        items = data.items;
      } else {
        return err(`Expecting ${indefinite ? "indefinite" : "definite"} CBOR array for arrayOf but got: ${String(data)}`);
      }

      const result: T[] = [];
      const errors: JsonError[] = [];
      let hasErrors = false;

      for (const item of items) {
        const decoded = itemCodec.deserialise(item);
        if (decoded.isOk()) {
          result.push(decoded.value);
        } else {
          errors.push(decoded.error);
          hasErrors = true;
        }
      }

      if (hasErrors) {
        return err(errors as unknown as JsonError);
      }

      return ok(result);
    },

    serialise: (value: T[]): Cbor => {
      const arr: Cbor[] = [];
      for (const v of value) {
        arr.push(itemCodec.serialise(v));
      }

      if (indefinite) {
        return new Indefinite(arr as Cbor[]);
      }
      return arr;
    },
  };
};
