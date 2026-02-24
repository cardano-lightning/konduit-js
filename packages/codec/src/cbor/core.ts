/* eslint-disable no-bitwise */
/* eslint-disable unicorn/number-literal-case */

// TODO:
// * Add section to the LICENSE file
// * Add NOTICE file
// * Add section to the README file
// This module was ported from this cardano-js-sdk repository to minimize dependencies:
// https://github.com/input-output-hk/cardano-js-sdk/tree/master/packages/core/src/Serialization/CBOR

/** Represents the 5-bit additional information included in a CBOR initial byte. */
export enum CborAdditionalInfo {
  AdditionalFalse = 20,
  AdditionalTrue = 21,
  AdditionalNull = 22,
  Additional8BitData = 24,
  Additional16BitData = 25,
  Additional32BitData = 26,
  Additional64BitData = 27,
  IndefiniteLength = 31
}

/** Represents CBOR Major Types, as defined in RFC7049 section 2.1. */
export enum CborMajorType {
  /** An unsigned integer in the range 0..264-1 inclusive. The value of the encoded item is the argument itself. */
  UnsignedInteger = 0,

  /** A negative integer in the range -264..-1 inclusive. The value of the item is -1 minus the argument. */
  NegativeInteger = 1,

  /** A byte string. The number of bytes in the string is equal to the argument. */
  ByteString = 2,

  /** A text string (Section 2) encoded as UTF-8 [RFC3629]. The number of bytes in the string is equal to the argument. */
  Utf8String = 3,

  /**
   * An array of data items. In other formats, arrays are also called lists, sequences, or tuples (a "CBOR sequence"
   * is something slightly different, though [RFC8742]). The argument is the number of data items in the array.
   */
  Array = 4,

  /** A map of pairs of data items. Maps are also called tables, dictionaries, hashes, or objects (in JSON). */
  Map = 5,

  /**
   * A tagged data item ("tag") whose tag number, an integer in the range 0..264-1 inclusive, is the argument and whose
   * enclosed data item (tag content) is the single encoded data item that follows the head.
   */
  Tag = 6,

  /** Simple values, Floating-point numbers and the "break" stop code. */
  Simple = 7
}

/** Represents a CBOR initial byte. */
export class CborInitialByte {
  static readonly IndefiniteLengthBreakByte = 0xff;
  static readonly AdditionalInformationMask = 0b0001_1111;

  #initialByte: number;

  private constructor(initialByte: number) {
    this.#initialByte = initialByte;
  }

  /**
   * Initializes a new instance of the CborInitialByte class.
   *
   * @param majorType The initial byte major type.
   * @param additionalInfo The initial byte additional info.
   */
  CborInitialByte(majorType: CborMajorType, additionalInfo: CborAdditionalInfo) {
    let initialByte = (majorType << 5) | additionalInfo;
    return new CborInitialByte(initialByte);
  }

  /**
   * Creates a CborInitialByte class from a packed initialByte.
   *
   * @param initialByte The initial.
   */
  static from(initialByte: number) {
    return new CborInitialByte(initialByte);
  }

  /**
   * Gets the packed initial byte.
   *
   * @returns The packed initial byte.
   */
  getInitialByte(): number {
    return this.#initialByte;
  }

  /**
   * Gets the initial type major type.
   *
   * @returns The major type.
   */
  getMajorType(): CborMajorType {
    return this.#initialByte >> 5;
  }

  /**
   * Gets initial type the additional info.
   *
   * @returns The additional info.
   */
  getAdditionalInfo(): CborAdditionalInfo {
    return this.#initialByte & CborInitialByte.AdditionalInformationMask;
  }
}

/** Represents a CBOR simple value (major type 7). */
export enum CborSimpleValue {
  /** Represents the value 'false'. */
  False = 20,

  /** Represents the value 'true'. */
  True = 21,

  /** Represents the value 'null'. */
  Null = 22,

  /** Represents an undefined value, to be used by an encoder as a substitute for a data item with an encoding problem. */
  Undefined = 23
}

/** Represents a CBOR semantic tag (major type 6). */
export enum CborTag {
  /** Tag value for RFC3339 date/time strings. */
  DateTimeString = 0,

  /** Tag value for Epoch-based date/time strings. */
  UnixTimeSeconds = 1,

  /** Tag value for unsigned bignum encodings. */
  UnsignedBigNum = 2,

  /** Tag value for negative bignum encodings. */
  NegativeBigNum = 3,

  /** Tag value for decimal fraction encodings. */
  DecimalFraction = 4,

  /** Tag value for big float encodings. */
  BigFloat = 5,

  /** Tag value for byte strings, meant for later encoding to a base64url string representation. */
  Base64UrlLaterEncoding = 21,

  /** Tag value for byte strings, meant for later encoding to a base64 string representation. */
  Base64StringLaterEncoding = 22,

  /** Tag value for byte strings, meant for later encoding to a base16 string representation. */
  Base16StringLaterEncoding = 23,

  /** Tag value for byte strings containing embedded CBOR data item encodings. */
  EncodedCborDataItem = 24,

  /** Tag value for Rational numbers, as defined in http://peteroupc.github.io/CBOR/rational.html. */
  RationalNumber = 30,

  /** Tag value for Uri strings, as defined in RFC3986. */
  Uri = 32,

  /** Tag value for base64url-encoded text strings, as defined in RFC4648. */
  Base64Url = 33,

  /** Tag value for base64-encoded text strings, as defined in RFC4648. */
  Base64 = 34,

  /** Tag value for regular expressions in Perl Compatible Regular Expressions / Javascript syntax. */
  Regex = 35,

  /** Tag value for MIME messages (including all headers), as defined in RFC2045. */
  MimeMessage = 36,

  /** Tag value for `set<a> = #6.258([* a]) / [* a]`, `nonempty_set<a> = #6.258([+ a]) / [+ a]`, `nonempty_oset<a> = #6.258([+ a]) / [+ a]` */
  Set = 258,

  /** Tag value for the Self-Describe CBOR header (0xd9d9f7). */
  SelfDescribeCbor = 55_799
}

export class Indefinite<T extends Cbor[] | Map<Cbor, Cbor>> { // string | Uint8Array |  - ByteString and String are note supported yet
  public readonly items: T;

  constructor(items: T) {
    this.items = items;
  }

  get length(): number {
    return (this.items as any).length;
  }

  //isString(): this is Indefinite<string> {
  //  return typeof this.items === "string";
  //}

  //isByteString(): this is Indefinite<Uint8Array> {
  //  return this.items instanceof Uint8Array;
  //}

  isArray(): this is Indefinite<Cbor[]> {
    return Array.isArray(this.items);
  }

  isMap(): this is Indefinite<Map<Cbor, Cbor>> {
    return this.items instanceof Map;
  }
}

export const isIndefinite = <T extends Cbor[] | Map<Cbor, Cbor>>(value: any): value is Indefinite<T> => value instanceof Indefinite;

// export const isIndefiniteString = (value: any): value is Indefinite<string> => isIndefinite(value) && value.isString();
// 
// export const isIndefiniteByteString = (value: any): value is Indefinite<Uint8Array> => isIndefinite(value) && value.isByteString();

export const isIndefiniteArray = (value: Cbor): value is Indefinite<Cbor[]> => isIndefinite(value) && value.isArray();

export const isIndefiniteMap = (value: Cbor): value is Indefinite<Map<Cbor, Cbor>> => isIndefinite(value) && value.isMap();


class CborUndefined {
  public constructor() {}

  toString() {
    return "CborUndefined";
  }
}

export const cborUndefined = new CborUndefined();
export const isCborUndefined = (value: any): value is CborUndefined => value instanceof CborUndefined;

class CborNull {
  public constructor() {}

  toString() {
    return "CborNull";
  }
}

export const cborNull = new CborNull();
export const isCborNull = (value: any): value is CborNull => value instanceof CborNull;

// AST representation of the CBOR data
export type Cbor =
  | CborNull
  | CborUndefined
  | boolean
  // TODO: Look closer into floats later
  | number
  | bigint
  | string
  // | Indefinite<string>
  | Uint8Array
  // | Indefinite<Uint8Array>
  | Cbor[]
  | Indefinite<Cbor[]>
  | Map<Cbor, Cbor>
  | Indefinite<Map<Cbor, Cbor>>
  | { tag: CborTag; value: Cbor }
