import { describe, it, expect } from "vitest";
import { CborWriter } from "../../src/cbor/CborWriter";
import { deserialiseCbor } from "../../src/cbor/sync";
import { isCborNull, isCborUndefined, isIndefiniteArray, isIndefiniteMap } from "../../src/cbor/core";
import { unwrapOk } from "../assertions";

describe("deserialiseCbor (primitive types)", () => {
  it("decodes unsigned integers", () => {
    const writer = new CborWriter();
    writer.writeInt(42);
    const bytes = writer.encode();

    const cbor = unwrapOk(deserialiseCbor(bytes));
    expect(typeof cbor === "bigint" || typeof cbor === "number").toBe(true);
    expect(cbor).toBe(42n);
  });

  it("decodes negative integers", () => {
    const writer = new CborWriter();
    writer.writeInt(-5);
    const bytes = writer.encode();

    const cbor = unwrapOk(deserialiseCbor(bytes));
    expect(cbor).toBe(-5n);
  });

  it("decodes byte strings", () => {
    const writer = new CborWriter();
    writer.writeByteString(new Uint8Array([1, 2, 3]));
    const bytes = writer.encode();

    const cbor = unwrapOk(deserialiseCbor(bytes));
    expect(cbor).toBeInstanceOf(Uint8Array);
    expect(Array.from(cbor as Uint8Array)).toEqual([1, 2, 3]);
  });

  it("decodes text strings", () => {
    const writer = new CborWriter();
    writer.writeTextString("hello");
    const bytes = writer.encode();

    const cbor = unwrapOk(deserialiseCbor(bytes));
    expect(cbor).toBe("hello");
  });

  it("decodes booleans", () => {
    const writerTrue = new CborWriter();
    writerTrue.writeBoolean(true);
    const bytesTrue = writerTrue.encode();
    expect(unwrapOk(deserialiseCbor(bytesTrue))).toBe(true);

    const writerFalse = new CborWriter();
    writerFalse.writeBoolean(false);
    const bytesFalse = writerFalse.encode();
    expect(unwrapOk(deserialiseCbor(bytesFalse))).toBe(false);
  });

  it("decodes null", () => {
    const writer = new CborWriter();
    writer.writeNull();
    const bytes = writer.encode();

    const cbor = unwrapOk(deserialiseCbor(bytes));
    expect(isCborNull(cbor)).toBe(true);
  });

  it("decodes undefined value", () => {
    const writer = new CborWriter();
    writer.writeUndefined(); // simple value 23
    const bytes = writer.encode();

    const cbor = unwrapOk(deserialiseCbor(bytes));
    expect(isCborUndefined(cbor)).toBe(true);
  });

  it("decodes empty definite-length array", () => {
    const writer = new CborWriter();
    writer.writeStartArray(0);
    writer.writeEndArray();
    const bytes = writer.encode();

    const cbor = unwrapOk(deserialiseCbor(bytes));
    expect(Array.isArray(cbor)).toBe(true);
    expect(cbor).toHaveLength(0);
  });

  it("decodes definite-length array with mixed types", () => {
    const writer = new CborWriter();
    writer.writeStartArray(4);
    writer.writeInt(1);                  // bigint
    writer.writeTextString("two");       // string
    writer.writeBoolean(true);           // boolean
    writer.writeNull();                  // cborNull
    writer.writeEndArray();

    const bytes = writer.encode();
    const cbor = unwrapOk(deserialiseCbor(bytes));

    expect(Array.isArray(cbor)).toBe(true);
    const arr = cbor as unknown[];
    expect(arr[0]).toBe(1n);
    expect(arr[1]).toBe("two");
    expect(arr[2]).toBe(true);
    expect(isCborNull(arr[3])).toBe(true);
  });

  it("decodes empty indefinite-length array", () => {
    const writer = new CborWriter();
    writer.writeStartArray(); // indefinite
    writer.writeEndArray();
    const bytes = writer.encode();

    const cbor = unwrapOk(deserialiseCbor(bytes));
    expect(isIndefiniteArray(cbor)).toBe(true);
    expect(cbor).toHaveLength(0);
  });

  it("decodes indefinite-length array with mixed types", () => {
    const writer = new CborWriter();
    writer.writeStartArray();            // indefinite
    writer.writeInt(42);
    writer.writeTextString("hello");
    writer.writeBoolean(false);
    writer.writeEndArray();

    const bytes = writer.encode();
    const cbor = unwrapOk(deserialiseCbor(bytes));

    if(!isIndefiniteArray(cbor)) throw new Error("Expected an indefinite array");
    expect(cbor.items).toHaveLength(3);
    expect(cbor.items[0]).toBe(42n);
    expect(cbor.items[1]).toBe("hello");
    expect(cbor.items[2]).toBe(false);
  });

  it("decodes definite-length map with simple keys and values", () => {
    const writer = new CborWriter();
    writer.writeStartMap(2);
    writer.writeTextString("a");
    writer.writeInt(1);
    writer.writeTextString("b");
    writer.writeInt(2);
    writer.writeEndMap();

    const bytes = writer.encode();
    const cbor = unwrapOk(deserialiseCbor(bytes));

    expect(cbor instanceof Map).toBe(true);
    const map = cbor as Map<unknown, unknown>;
    expect(map.size).toBe(2);
    expect(map.get("a")).toBe(1n);
    expect(map.get("b")).toBe(2n);
  });

  it("decodes indefinite-length map with mixed key/value types", () => {
    const writer = new CborWriter();
    writer.writeStartMap(); // indefinite

    writer.writeTextString("num");
    writer.writeInt(10);

    writer.writeInt(1);
    writer.writeTextString("one");

    writer.writeBoolean(true);
    writer.writeNull();

    writer.writeEndMap();

    const bytes = writer.encode();
    const cbor = unwrapOk(deserialiseCbor(bytes));

    if(!isIndefiniteMap(cbor)) throw new Error("Expected an indefinite map");

    expect(cbor.items.get("num")).toBe(10n);
    expect(cbor.items.get(1n)).toBe("one");

    const trueKeyVal = cbor.items.get(true);
    expect(isCborNull(trueKeyVal)).toBe(true);
  });

  it("decodes definite-length array containing a map", () => {
    const writer = new CborWriter();

    // Top-level array: [1, { "k": 4 }]
    writer.writeStartArray(2);

    writer.writeInt(1);

    // { "k": 4 }
    writer.writeStartMap(1);
    writer.writeTextString("k");
    writer.writeInt(4);

    const bytes = writer.encode();
    const cbor = unwrapOk(deserialiseCbor(bytes));

    if(!Array.isArray(cbor))
      throw new Error("Expected an array");

    expect(cbor[0]).toBe(1n);
    const innerMap = cbor[1];
    if(!(innerMap instanceof Map))
      throw new Error("Expected a Map");
    expect(innerMap.get("k")).toBe(4n);
  });

  it("decodes definite-length map containing an array", () => {
    const writer = new CborWriter();

    // Top-level map: { "k": [1, 2, 3] }
    writer.writeStartMap(1);
    writer.writeTextString("k");

    writer.writeStartArray(3);
    writer.writeInt(1);
    writer.writeInt(2);
    writer.writeInt(3);

    const bytes = writer.encode();
    const cbor = unwrapOk(deserialiseCbor(bytes));
    if(!(cbor instanceof Map))
      throw new Error("Expected a Map");
    const innerArr = cbor.get("k");
    if(!Array.isArray(innerArr)) throw new Error("Expected an array");
    expect(innerArr).toHaveLength(3);
    expect(innerArr[0]).toBe(1n);
    expect(innerArr[1]).toBe(2n);
    expect(innerArr[2]).toBe(3n);
  });

  it("decodes definite-length nested arrays and maps", () => {
    const writer = new CborWriter();

    // Top-level array: [1, [2, 3], { "k": 4 }]
    writer.writeStartArray(3);

    writer.writeInt(1);

    // [2, 3]
    writer.writeStartArray(2);
    writer.writeInt(2);
    writer.writeInt(3);

    // { "k": 4 }
    writer.writeStartMap(1);
    writer.writeTextString("k");
    writer.writeInt(4);

    const bytes = writer.encode();
    const cbor = unwrapOk(deserialiseCbor(bytes));

    expect(Array.isArray(cbor)).toBe(true);
    const arr = cbor as unknown[];

    expect(arr[0]).toBe(1n);

    const innerArr = arr[1] as unknown[];
    expect(Array.isArray(innerArr)).toBe(true);
    expect(innerArr[0]).toBe(2n);
    expect(innerArr[1]).toBe(3n);

    const innerMap = arr[2] as Map<unknown, unknown>;
    expect(innerMap instanceof Map).toBe(true);
    expect(innerMap.get("k")).toBe(4n);
  });

  it("decode indefinite-length nested arrays and maps", () => {
    const writer = new CborWriter();

    // Top-level array: [1, [2, 3], { "k": 4 }]
    writer.writeStartArray();

    writer.writeInt(1);

    // [2, 3]
    writer.writeStartArray();
    writer.writeInt(2);
    writer.writeInt(3);
    writer.writeEndArray();

    // { "k": 4 }
    writer.writeStartMap();
    writer.writeTextString("k");
    writer.writeInt(4);
    writer.writeEndMap();

    writer.writeEndArray();

    const bytes = writer.encode();
    const cbor = unwrapOk(deserialiseCbor(bytes));

    if(!isIndefiniteArray(cbor)) {
      throw new Error("Expected an indefinite array");
    }
    const arr = cbor.items;
    expect(arr[0]).toBe(1n);

    const innerArr = arr[1];
    if(!isIndefiniteArray(innerArr)) {
      throw new Error("Expected an indefinite array");
    }
    expect(innerArr.items[0]).toBe(2n);
    expect(innerArr.items[1]).toBe(3n);

    const innerMap = arr[2];
    if(!isIndefiniteMap(innerMap)) {
      throw new Error("Expected an indefinite map");
    }
    expect(innerMap.items.get("k")).toBe(4n);
  });

});
