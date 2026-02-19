/* eslint-disable no-bitwise */
/* eslint-disable unicorn/number-literal-case */
import { CborInitialByte, CborMajorType, CborTag } from './core';
import * as float16 from '../Float16';
import { HexString } from '../hexString';
import * as hexString from '../hexString';
import * as u8a from '../uint8Array';

// Constants
const MINUS_ONE = BigInt(-1);
const SHIFT32 = BigInt('0x100000000');
const ONE = 24;
const TWO = 25;
const FOUR = 26;
const EIGHT = 27;
const FALSE = 0xf4;
const TRUE = 0xf5;
const NULL = 0xf6;
const UNDEFINED = 0xf7;
const INDEFINITE_LENGTH_ARRAY = 0x9f;
const INDEFINITE_LENGTH_MAP = 0xbf;
const HALF = (7 << 5) | 25;
const FLOAT = (7 << 5) | 26;
const DOUBLE = (7 << 5) | 27;
const BUF_NAN = hexString.toUint8Array(HexString.unsafeFromString('ffc00000'));
const BUF_INF_NEG = hexString.toUint8Array(HexString.unsafeFromString('fff0000000000000'));
const BUF_INF_POS = hexString.toUint8Array(HexString.unsafeFromString('7ff0000000000000'));

/** A simple writer for Concise Binary Object Representation (CBOR) encoded data. */
export class CborWriter {
  #buffer: Uint8Array = new Uint8Array(0);

  /**
   * Writes the provided value as a tagged bignum encoding, as described in RFC7049 section 2.4.2.
   *
   * @param value The value to write.
   */
  writeBigInteger(value: bigint): CborWriter {
    let tag = CborTag.UnsignedBigNum;

    if (value < 0) {
      value = -value + MINUS_ONE;
      tag = CborTag.NegativeBigNum;
    }

    let str = value.toString(16);
    if (str.length % 2) {
      str = `0${str}`;
    }
    const buffer = hexString.toUint8Array(HexString.unsafeFromString(str));
    this.writeTag(tag);
    this.#writeTypeValue(CborMajorType.ByteString, buffer.length);
    this.#buffer = u8a.concat([this.#buffer, buffer]);

    return this;
  }

  /**
   * Writes a boolean value (major type 7).
   *
   * @param value The value to write.
   */
  writeBoolean(value: boolean): CborWriter {
    this.#pushUInt8(value ? TRUE : FALSE);

    return this;
  }

  /**
   * Writes a buffer as a byte string encoding (major type 2).
   *
   * @param value The value to write.
   */
  writeByteString(value: Uint8Array): CborWriter {
    this.#writeTypeValue(CborMajorType.ByteString, value.length);
    this.#buffer = u8a.concat([this.#buffer, value]);

    return this;
  }

  /**
   * Writes the next data item as a UTF-8 text string (major type 3).
   *
   * @param value The string.
   */
  writeTextString(value: string): CborWriter {
    const encoded = u8a.toUtf8(value);
    this.#writeTypeValue(CborMajorType.Utf8String, encoded.length);
    this.#buffer = u8a.concat([this.#buffer, encoded]);

    return this;
  }

  /**
   * Writes a single CBOR data item which has already been encoded.
   *
   * @param value The value to write.
   */
  writeEncodedValue(value: Uint8Array): CborWriter {
    this.#buffer = u8a.concat([this.#buffer, value]);

    return this;
  }

  /**
   * Writes the start of a definite or indefinite-length array (major type 4).
   *
   * @param length The length of the definite-length array, or undefined for an indefinite-length array.
   */
  writeStartArray(length?: number): CborWriter {
    if (length !== undefined) {
      this.#writeTypeValue(CborMajorType.Array, length);
    } else {
      this.#pushUInt8(INDEFINITE_LENGTH_ARRAY);
    }

    return this;
  }

  /** Writes the end of an array (major type 4). */
  writeEndArray(): CborWriter {
    this.#pushUInt8(CborInitialByte.IndefiniteLengthBreakByte);

    return this;
  }

  /**
   * Writes the start of a definite or indefinite-length map (major type 5).
   *
   * @param length The length of the definite-length map, or null for an indefinite-length map.
   */
  writeStartMap(length?: number): CborWriter {
    if (length !== undefined) {
      this.#writeTypeValue(CborMajorType.Map, length);
    } else {
      this.#pushUInt8(INDEFINITE_LENGTH_MAP);
    }

    return this;
  }

  /** Writes the end of a map (major type 5). */
  // eslint-disable-next-line sonarjs/no-identical-functions
  writeEndMap(): CborWriter {
    this.#pushUInt8(CborInitialByte.IndefiniteLengthBreakByte);

    return this;
  }

  /**
   * Writes a value as a signed integer encoding (major types 0,1)
   *
   * @param value The value to write.
   */
  writeInt(value: number | bigint): CborWriter {
    if (value < 0) {
      this.#writeTypeValue(CborMajorType.NegativeInteger, -(BigInt(value) + 1n));
    } else {
      this.#writeTypeValue(CborMajorType.UnsignedInteger, value);
    }

    return this;
  }

  /**
   * Writes a value as a signed integer encoding (major types 0,1)
   *
   * @param value The value to write.
   */
  writeFloat(value: number): CborWriter {
    if (value === Number.NEGATIVE_INFINITY) {
      this.#pushUInt8(DOUBLE);
      this.writeEncodedValue(BUF_INF_NEG);
      return this;
    }

    if (value === Number.POSITIVE_INFINITY) {
      this.#pushUInt8(DOUBLE);
      this.writeEncodedValue(BUF_INF_POS);
      return this;
    }

    if (Number.isNaN(value)) {
      this.#pushUInt8(FLOAT);
      this.writeEncodedValue(BUF_NAN);
      return this;
    }

    // Try to encode it as half precision, if it fails due to precision loss, try to encode
    // it as a 32-bit float, if it fails due to precision loss, encode as a 64-bit float
    float16.fromNumber(value).match(
      (val) => {
        this.#pushUInt8(HALF);
        this.writeEncodedValue(val);
      },
      (_err) => {
        const b4 = u8a.alloc(4);
        u8a.writeFloat32BE(b4, value, 0);

        if (u8a.readFloat32BE(b4, 0) === value) {
          this.#pushUInt8(FLOAT);
          this.writeEncodedValue(b4);
        } else {
          const b8 = u8a.alloc(8);
          u8a.writeFloat64BE(b8, value, 0);
          this.#pushUInt8(DOUBLE);
          this.writeEncodedValue(b8);
        }
      }
    );

    return this;
  }

  /** Writes a null value (major type 7). */
  writeNull(): CborWriter {
    this.#pushUInt8(NULL);

    return this;
  }

  /** Writes an undefined value. */
  writeUndefined(): CborWriter {
    this.#pushUInt8(UNDEFINED);

    return this;
  }

  /**
   * Assign a semantic tag (major type 6) to the next data item.
   *
   * @param tag semantic tag.
   */
  writeTag(tag: CborTag | number): CborWriter {
    this.#writeTypeValue(CborMajorType.Tag, tag);

    return this;
  }

  encodeAsHex(): HexString {
    return HexString.fromUint8Array(this.encode());
  }

  /** Returns a new array containing the encoded value. */
  encode(): Uint8Array {
    return new Uint8Array(this.#buffer);
  }

  /** Resets the writer to have no data. */
  reset() {
    this.#buffer = new Uint8Array(0);
  }

  /**
   * Writes a typed value to the buffer.
   *
   * @param majorType The major type of the value.
   * @param value The value.
   */
  #writeTypeValue(majorType: CborMajorType, value: bigint | number) {
    const m = majorType << 5;
    if (value < 24) {
      this.#pushUInt8(m | Number(value));
    } else if (value < 256) {
      this.#pushUInt8(m | ONE);
      this.#pushUInt8(Number(value));
    } else if (value < 65_536) {
      this.#pushUInt8(m | TWO);
      this.#pushUInt16(Number(value));
    } else if (value < 4_294_967_296) {
      this.#pushUInt8(m | FOUR);
      this.#pushUInt32(Number(value));
    } else {
      this.#pushUInt8(m | EIGHT);
      this.#pushUInt32(Number(BigInt(value) / SHIFT32));
      this.#pushUInt32(Number(BigInt(value) % SHIFT32));
    }
  }

  /**
   * Push an Uint8 byte to the buffer in Big Endian.
   *
   * @param {number} value Number(0-255) to encode.
   */
  #pushUInt8(value: number) {
    const b: Uint8Array = new Uint8Array(1);
    u8a.writeUInt8(b, value, 0);
    this.#buffer = u8a.concat([this.#buffer, b]);
  }

  /**
   * Push an Uint16 byte to the buffer in Big Endian.
   *
   * @param {number} value Number(0-65535) to encode.
   */
  #pushUInt16(value: number) {
    const b: Uint8Array = new Uint8Array(2);
    u8a.writeUInt16BE(b, value, 0);

    this.#buffer = u8a.concat([this.#buffer, b]);
  }

  /**
   * Push an Uint32 byte to the buffer in Big Endian.
   *
   * @param {number} value Number(0..2**32-1) to encode.
   */
  #pushUInt32(value: number) {
    const b: Uint8Array = new Uint8Array(4);
    u8a.writeUInt32BE(b, value, 0);
    this.#buffer = u8a.concat([this.#buffer, b]);
  }
}
