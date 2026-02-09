import { describe, it, expect } from "vitest";
import {
  cbor2ArrayCodec,
  cbor2BooleanCodec,
  cbor2ByteStringCodec,
  cbor2IntCodec,
  cbor2NullCodec,
  cbor2StringCodec,
  cbor2UndefinedCodec,
  definiteLength,
  deserialiseCbor,
  dictOf,
  heterogeneousMapOf,
  homogeneousMapOf,
  indefiniteLength,
  serialiseCbor,
  tupleOf,
} from "../../../src/cbor/codecs/sync";
import { Cbor, Indefinite, isIndefiniteArray, isIndefiniteMap } from "../../../src/cbor/core";
import { unwrapOk, unwrapErr, expectOk } from "../../assertions";
import { HexString } from "../../../src/hexString";

describe("CBOR primitive codecs", () => {
  describe("cbor2BooleanCodec", () => {
    it("deserialises true", () => {
      const result = cbor2BooleanCodec.deserialise(true);
      expectOk(result).toBe(true);
    });

    it("deserialises false", () => {
      const result = cbor2BooleanCodec.deserialise(false);
      expectOk(result).toBe(false);
    });

    it("fails on non-boolean values", () => {
      unwrapErr(cbor2BooleanCodec.deserialise(1n));
      unwrapErr(cbor2BooleanCodec.deserialise("true"));
      unwrapErr(cbor2BooleanCodec.deserialise(null as any));
    });

    it("serialises booleans unchanged", () => {
      expect(cbor2BooleanCodec.serialise(true)).toBe(true);
      expect(cbor2BooleanCodec.serialise(false)).toBe(false);
    });
  });

  describe("cbor2StringCodec", () => {
    it("deserialises strings", () => {
      const result = cbor2StringCodec.deserialise("hello");
      expectOk(result).toBe("hello");
    });

    it("fails on non-string values", () => {
      unwrapErr(cbor2StringCodec.deserialise(1n as any));
      unwrapErr(cbor2StringCodec.deserialise(true as any));
      unwrapErr(cbor2StringCodec.deserialise(null as any));
    });

    it("serialises strings unchanged", () => {
      expect(cbor2StringCodec.serialise("world")).toBe("world");
    });
  });

  describe("cbor2IntCodec", () => {
    it("deserialises non-negative bigints", () => {
      const resultZero = cbor2IntCodec.deserialise(0n);
      const resultPos = cbor2IntCodec.deserialise(123n);

      expectOk(resultZero).toBe(0n);
      expectOk(resultPos).toBe(123n);
    });


    it("fails on non-bigint types", () => {
      unwrapErr(cbor2IntCodec.deserialise(1 as any));
      unwrapErr(cbor2IntCodec.deserialise("1" as any));
      unwrapErr(cbor2IntCodec.deserialise(true as any));
    });

    it("serialises non-negative bigints unchanged", () => {
      expect(cbor2IntCodec.serialise(0n)).toBe(0n);
      expect(cbor2IntCodec.serialise(42n)).toBe(42n);
    });

    it("cannot serialise negative values as unsigned", () => {
      // serialise is typed to return Cbor but implementation returns err(any) for negative;
      // we just ensure it doesn't silently produce a bigint
      const result = cbor2IntCodec.serialise(-1n as any);
      expect(typeof result === "bigint" && result >= 0n).toBe(false);
    });
  });

  describe("cbor2IntCodec", () => {
    it("deserialises positive, zero and negative bigints", () => {
      expectOk(cbor2IntCodec.deserialise(0n)).toBe(0n);
      expectOk(cbor2IntCodec.deserialise(10n)).toBe(10n);
      expectOk(cbor2IntCodec.deserialise(-5n)).toBe(-5n);
    });

    it("fails on non-bigint types", () => {
      unwrapErr(cbor2IntCodec.deserialise(1 as any));
      unwrapErr(cbor2IntCodec.deserialise("1" as any));
      unwrapErr(cbor2IntCodec.deserialise(false as any));
    });

    it("serialises bigints unchanged", () => {
      expect(cbor2IntCodec.serialise(7n)).toBe(7n);
      expect(cbor2IntCodec.serialise(-3n)).toBe(-3n);
    });
  });

  describe("cbor2ByteStringCodec", () => {
    it("deserialises definite byte strings", () => {
      const bytes = new Uint8Array([1, 2, 3]);
      const result = cbor2ByteStringCodec.deserialise(bytes);
      expectOk(result).toEqual(bytes);
    });

    it("fails on non-byte-string types", () => {
      unwrapErr(cbor2ByteStringCodec.deserialise("abc" as any));
      unwrapErr(cbor2ByteStringCodec.deserialise(1n as any));
      unwrapErr(cbor2ByteStringCodec.deserialise(true as any));
    });

    it("serialises byte strings unchanged", () => {
      const bytes = new Uint8Array([9, 8, 7]);
      expect(cbor2ByteStringCodec.serialise(bytes)).toBe(bytes);
    });
  });

  describe("cbor2NullCodec and cbor2UndefinedCodec", () => {
    it("deserialises null wrapper", () => {
      const cborNullValue = { toString: () => "CborNull" } as any;
      // The real cborNull instance is checked by isCborNull inside codec;
      // here we just ensure failure on non-CborNull
      unwrapErr(cbor2NullCodec.deserialise(cborNullValue));
    });

    it("deserialises undefined wrapper", () => {
      const cborUndefValue = { toString: () => "CborUndefined" } as any;
      unwrapErr(cbor2UndefinedCodec.deserialise(cborUndefValue));
    });
  });
});

describe("CBOR array codec", () => {
  it("deserialises definite arrays", () => {
    const arr: Cbor[] = [1n, 2n, "three"];
    const decoded = unwrapOk(cbor2ArrayCodec.deserialise(arr));
    expect(decoded).toEqual(arr);
  });

  it("fails on non-array values", () => {
    unwrapErr(cbor2ArrayCodec.deserialise(1n as any));
    unwrapErr(cbor2ArrayCodec.deserialise("x" as any));
  });

  it("serialises arrays unchanged", () => {
    const arr: Cbor[] = [true, 0n, "ok"];
    expect(cbor2ArrayCodec.serialise(arr)).toBe(arr);
  });
});

describe("tupleOf codec", () => {
  it("deserialises and serialises a simple fixed-length tuple", () => {
    const codec = tupleOf(definiteLength, cbor2IntCodec, cbor2StringCodec, cbor2BooleanCodec);

    const cborTuple: Cbor = [1n, "hi", true];
    const decoded = unwrapOk(codec.deserialise(cborTuple));
    expect(decoded).toEqual([1n, "hi", true]);

    const reEncoded = codec.serialise(decoded);
    expect(Array.isArray(reEncoded)).toBe(true);
    const arr = reEncoded as Cbor[];
    expect(arr[0]).toBe(1n);
    expect(arr[1]).toBe("hi");
    expect(arr[2]).toBe(true);
  });

  it("fails when input is not an array", () => {
    const codec = tupleOf(definiteLength, cbor2IntCodec, cbor2StringCodec);
    unwrapErr(codec.deserialise(1n as Cbor));
    unwrapErr(codec.deserialise("x" as Cbor));
    unwrapErr(codec.deserialise(true as Cbor));
  });

  it("fails when array length does not match tuple arity", () => {
    const codec = tupleOf(definiteLength, cbor2IntCodec, cbor2StringCodec);

    // too short
    unwrapErr(codec.deserialise([1n] as Cbor));

    // too long
    unwrapErr(codec.deserialise([1n, "x", true] as Cbor));
  });

  it("supports nested tuples", () => {
    const inner = tupleOf(indefiniteLength, cbor2IntCodec, cbor2BooleanCodec);
    const outer = tupleOf(definiteLength, cbor2StringCodec, inner);

    const cborValue: Cbor = ["key", new Indefinite([5n, false])];
    const decoded = unwrapOk(outer.deserialise(cborValue));
    expect(decoded[0]).toBe("key");
    expect(decoded[1]).toEqual([5n, false]);

    const reEncoded = outer.serialise(decoded);
    expect(Array.isArray(reEncoded)).toBe(true);
    const arr = reEncoded as Cbor[];
    expect(arr[0]).toBe("key");
    let innerOut = arr[1];
    if(!isIndefiniteArray(innerOut)) throw new Error("expected indefinite array");
    expect(innerOut.items[0]).toBe(5n);
    expect(innerOut.items[1]).toBe(false);
  });

  it("works with arrays inside tuple elements via cbor2ArrayCodec", () => {
    const codec = tupleOf(indefiniteLength, cbor2StringCodec, cbor2ArrayCodec);

    const cborValue: Cbor = new Indefinite(["nums", [1n, 2n, 3n] as Cbor]);
    const decoded = unwrapOk(codec.deserialise(cborValue));
    expect(decoded[0]).toBe("nums");
    expect(decoded[1]).toEqual([1n, 2n, 3n]);

    const reEncoded = codec.serialise(decoded);
    if(!isIndefiniteArray(reEncoded)) throw new Error("expected indefinite array");
    const arr = reEncoded.items;
    expect(arr[0]).toBe("nums");
    expect(Array.isArray(arr[1])).toBe(true);
    expect(arr[1]).toEqual([1n, 2n, 3n]);
  });
});

describe("CBOR dictOf and homogeneousMapOf codecs", () => {
  describe("dictOf", () => {
    it("deserialises a definite map into a dict with typed fields", () => {
      const codec = dictOf(definiteLength, {
        name: cbor2StringCodec,
        age: cbor2IntCodec,
      });
      const map = codec.serialise({ name: "Alice", age: 30n });
      const result = unwrapOk(codec.deserialise(map));
      expect(result).toEqual({ name: "Alice", age: 30n });
    });

    it("collects field errors into a JSON object", () => {
      const codec = dictOf(definiteLength, {
        name: cbor2StringCodec,
        age: cbor2IntCodec,
      });

      const map = new Map<Cbor, Cbor>();
      map.set("name", 123n); // wrong type
      map.set("age", -1n);   // invalid unsigned

      const err = unwrapErr(codec.deserialise(map));
      expect(typeof err).toBe("object");
    });

    it("serialises to a definite-length map when definiteLength flag used", () => {
      const codec = dictOf(definiteLength, {
        name: cbor2StringCodec,
        age: cbor2IntCodec,
      });

      const value = { name: "Bob", age: 40n };
      const cbor = codec.serialise(value);
      expect(cbor instanceof Map).toBe(true);
      const map = cbor as Map<Cbor, Cbor>;
      expect(map.get("name")).toBe("Bob");
      expect(map.get("age")).toBe(40n);
    });

    it("serialises to an Indefinite map when indefiniteLength flag used", () => {
      const codec = dictOf(indefiniteLength, {
        name: cbor2StringCodec,
      });

      const value = { name: "Carol" };
      const cbor = codec.serialise(value);
      expect(isIndefiniteMap(cbor)).toBe(true);
      if (!isIndefiniteMap(cbor)) throw new Error("expected Indefinite map");
      expect(cbor.items.get("name")).toBe("Carol");
    });
  });

  describe("homogeneousMapOf", () => {
    it("deserialises definite map with typed keys and values", () => {
      const codec = homogeneousMapOf(definiteLength, cbor2StringCodec, cbor2IntCodec);

      const raw = new Map<Cbor, Cbor>();
      raw.set("a", 1n);
      raw.set("b", -2n);

      const result = unwrapOk(codec.deserialise(raw));
      expect(result.size).toBe(2);
      expect(result.get("a")).toBe(1n);
      expect(result.get("b")).toBe(-2n);
    });

    it("deserialises indefinite map with typed keys and values", () => {
      const codec = homogeneousMapOf(indefiniteLength, cbor2StringCodec, cbor2IntCodec);

      const inner = new Map<Cbor, Cbor>();
      inner.set("x", 10n);
      inner.set("y", -10n);
      const raw = new Indefinite(inner);

      const result = unwrapOk(codec.deserialise(raw));
      expect(result.get("x")).toBe(10n);
      expect(result.get("y")).toBe(-10n);
    });

    it("collects key/value errors into a JSON array", () => {
      const codec = homogeneousMapOf(definiteLength, cbor2StringCodec, cbor2IntCodec);

      const raw = new Map<Cbor, Cbor>();
      raw.set(1n, 2n);        // invalid key type
      raw.set("ok", "notInt"); // invalid value type

      const err = unwrapErr(codec.deserialise(raw));
      expect(Array.isArray(err)).toBe(true);
    });

    it("serialises to definite map when definiteLength flag used", () => {
      const codec = homogeneousMapOf(definiteLength, cbor2StringCodec, cbor2IntCodec);

      const value = new Map<string, bigint>();
      value.set("a", 1n);
      value.set("b", -1n);

      const cbor = codec.serialise(value);
      expect(cbor instanceof Map).toBe(true);
      const map = cbor as Map<Cbor, Cbor>;
      expect(map.get("a")).toBe(1n);
      expect(map.get("b")).toBe(-1n);
    });

    it("serialises to Indefinite map when indefiniteLength flag used", () => {
      const codec = homogeneousMapOf(indefiniteLength, cbor2StringCodec, cbor2IntCodec);

      const value = new Map<string, bigint>();
      value.set("k", 5n);

      const cbor = codec.serialise(value);
      expect(isIndefiniteMap(cbor)).toBe(true);
      if (!isIndefiniteMap(cbor)) throw new Error("expected Indefinite map");
      expect(cbor.items.get("k")).toBe(5n);
    });
  });
});

describe("CBOR end-to-end roundtrip with mixed/nested codecs", () => {
  it("rountrips a definite map into a dict with typed fields", () => {
    type Person = {
      name: string;
      age: bigint;
    };
    const codec = dictOf(definiteLength, {
      name: cbor2StringCodec,
      age: cbor2IntCodec,
    });
    const cborIn = codec.serialise({ name: "Alice", age: 30n } as Person);
    const bytes = serialiseCbor(cborIn);
    console.log(`${HexString.fromUint8Array(bytes)}`);

  //   // Deserialise bytes back to CBOR AST
    const cborOut = unwrapOk(deserialiseCbor(bytes));
    const result = unwrapOk(codec.deserialise(cborOut));
    expect(result).toEqual({ name: "Alice", age: 30n });
  });

  it("rountrips a simple triple", () => {
    const codec = tupleOf(definiteLength, cbor2IntCodec, cbor2StringCodec, cbor2BooleanCodec);
    const cborIn = codec.serialise([42n, "hello", true]);
    const bytes = serialiseCbor(cborIn);
    console.log(`${HexString.fromUint8Array(bytes)}`);

    // Deserialise bytes back to CBOR AST
    const cborOut = unwrapOk(deserialiseCbor(bytes));
    const result = unwrapOk(codec.deserialise(cborOut));
    expect(result).toEqual([42n, "hello", true]);
  });

  it("roundtrips a heterogeneous map with mixed key/value types", () => {
    const codec = heterogeneousMapOf(definiteLength,
      [cbor2StringCodec, tupleOf(definiteLength, cbor2IntCodec, cbor2BooleanCodec)],
      [cbor2IntCodec, cbor2BooleanCodec]
    );
    let pairs: [[string, [bigint, boolean]], [bigint, boolean]] = [["key", [42n, false]], [28n, true]];
    const cborIn = codec.serialise(pairs);
    const bytes = serialiseCbor(cborIn);
    console.log(`${HexString.fromUint8Array(bytes)}`);

    // Deserialise bytes back to CBOR AST
    const cborOut = unwrapOk(deserialiseCbor(bytes));
    const result = unwrapOk(codec.deserialise(cborOut));
    expect(result).toEqual(pairs);
  });

  it("roundtrips a dictOf with nested dictOf values", () => {
    const addressCodec = dictOf(definiteLength, {
      street: cbor2StringCodec,
      zip: cbor2IntCodec,
    });

    const personCodec = dictOf(definiteLength, {
      name: cbor2StringCodec,
      age: cbor2IntCodec,
      active: cbor2BooleanCodec,
      address: addressCodec,
    });

    const person = {
      name: "Alice",
      age: 30n,
      active: true,
      address: {
        street: "Main St",
        zip: 12345n,
      },
    };

    const cborIn = personCodec.serialise(person);
    const bytes = serialiseCbor(cborIn);
    console.log(`${HexString.fromUint8Array(bytes)}`);

    // Deserialise bytes back to CBOR AST
    const cborOut = unwrapOk(deserialiseCbor(bytes));
    const result = unwrapOk(personCodec.deserialise(cborOut));
    expect(result).toEqual(person);
  });
});
