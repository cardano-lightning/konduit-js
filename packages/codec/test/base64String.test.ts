import { describe, it, expect } from 'vitest';
import * as base64String from '../src/base64String';
import * as uint8Array from '../src/uint8Array';
import { unwrapErrWithSubstring, unwrapOk } from './assertions';
import { parse, stringify, type Json } from '../src/json';

describe('Base64String', () => {
  it('accepts a valid padded base64 string', () => {
    const result = base64String.Base64String.fromString('AQIDBA==');
    const value = unwrapOk(result);
    expect(value).toBe('AQIDBA==');
  });

  it('rejects invalid character in base64 string', () => {
    const result = base64String.Base64String.fromString('AQID$A==');
    unwrapErrWithSubstring(result, "Invalid character");
  });

  it('rejects invalid padding in base64 string', () => {
    const result = base64String.Base64String.fromString('A=QID');
    unwrapErrWithSubstring(result, "Invalid base64 format");
  });

  it('roundtrips Uint8Array ↔ Base64String', () => {
    const original = new Uint8Array([0x00, 0x01, 0x02, 0xfe, 0xff]);
    const b64 = base64String.fromUint8Array(original);
    const decoded = base64String.toUint8Array(b64);
    expect(decoded).toStrictEqual(original);
  });

  it('jsonCodec roundtrips via JSON string', () => {
    const original = new Uint8Array([1, 2, 3, 4]);
    const b64 = base64String.fromUint8Array(original);
    const json = base64String.jsonCodec.serialise(b64);
    const parsed = unwrapOk(parse(stringify(json)));
    const decodedB64 = unwrapOk(base64String.jsonCodec.deserialise(parsed as Json));
    const roundtripped = base64String.toUint8Array(decodedB64);
    expect(roundtripped).toStrictEqual(original);
  });

  it('json2Uint8ArrayThroughBase64Codec roundtrips', () => {
    const original = new Uint8Array([10, 20, 30]);
    // serialise Uint8Array to Json through base64
    const json = uint8Array.json2Uint8ArrayThroughBase64Codec.serialise(original);
    const parsed = unwrapOk(parse(stringify(json)));
    // deserialise back to Uint8Array
    const decoded = unwrapOk(uint8Array.json2Uint8ArrayThroughBase64Codec.deserialise(parsed as Json));
    expect(decoded).toStrictEqual(original);
  });
});
