import { CborAdditionalInfo, CborInitialByte, CborMajorType, CborSimpleValue, CborTag } from './core'
import type { Float16 } from "../Float16";
import * as float16 from "../Float16";
import type { Result } from "neverthrow";
import { ok, err } from "neverthrow";
import type { JsonError } from '../json/codecs';
import { unsafeUnwrap } from '../neverthrow';

const _okNull = ok(null);

// Constants
const UNEXPECTED_END_OF_BUFFER_MSG = 'Unexpected end of buffer';

/** Specifies the state of a CborReader instance. */
export enum CborReaderState {
  /** Indicates the undefined state. */
  Undefined = 0,

  /** Indicates that the next CBOR data item is an unsigned integer (major type 0). */
  UnsignedInteger,

  /** Indicates that the next CBOR data item is a negative integer (major type 1). */
  NegativeInteger,

  /** Indicates that the next CBOR data item is a byte string (major type 2). */
  ByteString,

  /** Indicates that the next CBOR data item denotes the start of an indefinite-length byte string (major type 2). */
  StartIndefiniteLengthByteString,

  /** Indicates that the reader is at the end of an indefinite-length byte string (major type 2). */
  EndIndefiniteLengthByteString,

  /** Indicates that the next CBOR data item is a UTF-8 string (major type 3). */
  TextString,

  /** Indicates that the next CBOR data item denotes the start of an indefinite-length UTF-8 text string (major type 3). */
  StartIndefiniteLengthTextString,

  /** Indicates that the reader is at the end of an indefinite-length UTF-8 text string (major type 3). */
  EndIndefiniteLengthTextString,

  /** Indicates that the next CBOR data item denotes the start of an array (major type 4). */
  StartArray,
  /** Indicates that the reader is at the end of an array (major type 4). */
  EndArray,

  /** Indicates that the next CBOR data item denotes the start of a map (major type 5). */
  StartMap,

  /** Indicates that the reader is at the end of a map (major type 5). */
  EndMap,

  /** Indicates that the next CBOR data item is a semantic tag (major type 6). */
  Tag,

  /** Indicates that the next CBOR data item is a simple value (major type 7). */
  SimpleValue,
  /** Indicates that the next CBOR data item is an IEEE 754 Half-Precision float (major type 7). */
  HalfPrecisionFloat,
  /** Indicates that the next CBOR data item is an IEEE 754 Single-Precision float (major type 7). */
  SinglePrecisionFloat,

  /** Indicates that the next CBOR data item is an IEEE 754 Double-Precision float (major type 7). */
  DoublePrecisionFloat,
  /** Indicates that the next CBOR data item is a null literal (major type 7). */
  Null,
  /** Indicates that the next CBOR data item encodes a bool value (major type 7). */
  Boolean,

  /** Indicates that the reader has completed reading a full CBOR document. */
  Finished
}

/** The stack frame to keep track of nested item data. */
type StackFrame = {
  type: CborMajorType | null;
  frameOffset: number;
  definiteLength?: number;
  itemsRead: number;
  currentKeyOffset: number | null;
};

/** A stateful, forward-only reader for Concise Binary Object Representation (CBOR) encoded data. */
export class CborReader {
  readonly #data: Uint8Array;
  #offset = 0;
  #nestedItems: Array<StackFrame> = new Array<StackFrame>();
  #isTagContext = false;
  #currentFrame: StackFrame;
  #cachedState = CborReaderState.Undefined;

  /**
   * Initializes a CborReader instance over the specified data with the given configuration.
   *
   * @param data The CBOR encoded data to read.
   */
  constructor(data: Uint8Array) {
    this.#data = new Uint8Array(data);
    this.#currentFrame = {
      currentKeyOffset: null,
      frameOffset: 0,
      itemsRead: 0,
      type: null
    };
  }

  /**
   * Reads the next CBOR token, without advancing the reader.
   *
   * @returns The current CBOR reader state.
   */
  peekState(): Result<CborReaderState, JsonError> {
    if (this.#cachedState === CborReaderState.Undefined) {
      return this.#peekStateCore().map(state => {
        this.#cachedState = state;
        return state;
      });
    }
    return ok(this.#cachedState);
  }

  /**
   * Gets the total number of unread bytes in the buffer.
   *
   * @returns The total number of unread bytes in the buffer.
   */
  getBytesRemaining() {
    return this.#data.length - this.#offset;
  }

  /** Skips the next CBOR data item and advance the reader. For indefinite length encodings this includes the break byte. */
  skipValue(): void {
    this.readEncodedValue();
  }

  /**
   * Reads the next CBOR data item, returning a subarray with the encoded value. For indefinite length encodings
   * this includes the break byte.
   *
   * @returns A subarray with the encoded value as a contiguous region of memory.
   */
  readEncodedValue(): Result<Uint8Array, JsonError> {
    const initialOffset = this.#offset;

    const loop = (currDepth: number): Result<null, JsonError> => {
      return this.#skipNextNode(currDepth).match(
        (depth: number) => {
          if(depth > 0) {
            return loop(depth);
          }
          return _okNull;
        },
        (e) => err(e)
      );
    };
    return loop(0).map(() => {
      return this.#data.slice(initialOffset, this.#offset);
    });
  }

  /** Reads the next data item as the start of an array (major type 4). */
  readStartArray(): Result<number | null, JsonError> {
    return this.#peekInitialByte(CborMajorType.Array).andThen((header: CborInitialByte) => {
      if (header.getAdditionalInfo() === CborAdditionalInfo.IndefiniteLength) {
        this.#advanceBuffer(1);
        this.#pushDataItem(CborMajorType.Array);
        return _okNull;
      }
      const buffer = this.#getRemainingBytes();
      return CborReader.#peekDefiniteLength(header, buffer).map(({ length, bytesRead }) => {
        this.#advanceBuffer(bytesRead);
        this.#pushDataItem(CborMajorType.Array, length);
        return length;
      });
    });
  }

  /** Reads the end of an array (major type 4). */
  readEndArray(): Result<null, JsonError> {
    if (this.#currentFrame.definiteLength === undefined) {
      return this.#validateNextByteIsBreakByte()
        .andThen(() => this.#popDataItem(CborMajorType.Array))
        .andThen(() => this.#advanceBufferAndDataItemCounters(1));
    }
    return this.#popDataItem(CborMajorType.Array)
      .map(() => {
        this.#advanceDataItemCounters();
        return null;
      });
  }

  /**
   * Reads the next data item as a signed integer (major types 0,1).
   *
   * @returns The decoded integer value.
   */
  readInt(): Result<bigint, JsonError> {
    return this.#peekSignedInteger().andThen(({ signedInt, bytesRead }) => {
      return this.#advanceBufferAndDataItemCounters(bytesRead)
        .map(() => signedInt);
    });
  }

  /**
   * Reads the next data item as an unsigned integer (major type 0).
   *
   * @returns The decoded integer value.
   */
  readUInt(): Result<bigint, JsonError> {
    return this.#peekUnsignedInteger().andThen(({ unsignedInt, bytesRead }) => {
      return this.#advanceBufferAndDataItemCounters(bytesRead)
        .map(() => unsignedInt);
    });
  }

  /**
   * Reads the next data item as a double-precision floating point number (major type 7).
   *
   * @returns The decoded double value.
   */
  readDouble(): Result<number, JsonError> {
    return this.#peekInitialByte(CborMajorType.Simple).andThen((header: CborInitialByte) => {
      const remainingBytes = this.#getRemainingBytes();
      switch (header.getAdditionalInfo()) {
        case CborAdditionalInfo.Additional16BitData: {
          return this.#ensureReadCapacity(3).andThen(() => {
            let result = float16.toNumber(remainingBytes.slice(1) as Float16);
            return this.#advanceBufferAndDataItemCounters(3).map(() => result);
          });
        }
        case CborAdditionalInfo.Additional32BitData: {
          return this.#ensureReadCapacity(5).andThen(() => {
            let result = Buffer.from(remainingBytes).readFloatBE(1);
            return this.#advanceBufferAndDataItemCounters(5).map(() => result);
          });
        }
        case CborAdditionalInfo.Additional64BitData: {
          return this.#ensureReadCapacity(9).andThen(() => {
            let result = Buffer.from(remainingBytes).readDoubleBE(1);
            return this.#advanceBufferAndDataItemCounters(9).map(() => result);
          });
        }
      default:
        return err('Not a float encoding');
      }
    });
  }

  /**
   * Reads the next data item as a CBOR simple value (major type 7).
   *
   * @returns The decoded CBOR simple value.
   */
  readSimpleValue(): Result<CborSimpleValue, JsonError> {
    return this.#peekInitialByte(CborMajorType.Simple).andThen((header: CborInitialByte) => {
      if ((header.getInitialByte() & CborInitialByte.AdditionalInformationMask) < CborAdditionalInfo.Additional8BitData) {
        return this.#advanceBufferAndDataItemCounters(1).map(() => header.getAdditionalInfo().valueOf() as CborSimpleValue);
      }
      if (header.getAdditionalInfo() === CborAdditionalInfo.Additional8BitData) {
        return this.#ensureReadCapacity(2).andThen(() => {
          const value = this.#data[this.#offset + 1];
          return this.#advanceBufferAndDataItemCounters(2).map(() => value as CborSimpleValue);
        });
      }
      return err('Not a simple value encoding');
    });
  }

  /**
   * Reads the next data item as a CBOR negative integer representation (major type 1).
   *
   * @returns An unsigned integer denoting -1 minus the integer.
   */
  readCborNegativeIntegerRepresentation() {
    return this.#peekInitialByte(CborMajorType.NegativeInteger).map((header: CborInitialByte) => {
      return CborReader.#decodeUnsignedInteger(header, this.#getRemainingBytes()).map(({ unsignedInt, bytesRead }) => {
        return this.#advanceBufferAndDataItemCounters(bytesRead).map(() => unsignedInt);
      });
    });
  }

  /**
   * Reads the next data item as the start of a map (major type 5).
   *
   * @returns The number of key-value pairs in a definite-length map, or null if the map is indefinite-length.
   *
   * remark: Map contents are consumed as if they were arrays twice the length of the map's declared size.
   *
   * For example, a map of size 1 containing a key of type int with a value of type string
   * must be consumed by successive calls to readInt32 and readTextString.
   */
  readStartMap(): Result<number | null, JsonError> {
    return this.#peekInitialByte(CborMajorType.Map).andThen((header: CborInitialByte) => {
      if (header.getAdditionalInfo() === CborAdditionalInfo.IndefiniteLength) {
        return this.#advanceBuffer(1).map(() => {
          this.#pushDataItem(CborMajorType.Map);
          this.#currentFrame.currentKeyOffset = this.#offset;
          return null;
        });
      } else {
        const buffer = this.#getRemainingBytes();

        return CborReader.#peekDefiniteLength(header, buffer).andThen(result => {
          if (2 * result.length > buffer.length - result.bytesRead)
            return err('Definite length exceeds buffer size');
          return this.#advanceBuffer(result.bytesRead).map(() => {
            this.#pushDataItem(CborMajorType.Map, 2 * result.length);
            return result.length;
          });
        });
      }
    });
  }

  /** Reads the end of a map (major type 5). */
  readEndMap(): Result<null, JsonError> {
    if (this.#currentFrame.definiteLength === undefined) {
      return this.#validateNextByteIsBreakByte().andThen(() => {
        if (this.#currentFrame.itemsRead % 2 !== 0) return err('Key missing value');
        this.#popDataItem(CborMajorType.Map);
        return this.#advanceBufferAndDataItemCounters(1);
      });
    } else {
      this.#popDataItem(CborMajorType.Map);
      this.#advanceDataItemCounters();
    }
    return _okNull;
  }

  /**
   * Reads the next data item as a boolean value (major type 7).
   *
   * @returns The decoded value.
   */
  readBoolean(): Result<boolean, JsonError> {
    return this.#peekInitialByte(CborMajorType.Simple).andThen((header: CborInitialByte) => {
      const val = header.getAdditionalInfo();
      if (val !== CborAdditionalInfo.AdditionalTrue && val !== CborAdditionalInfo.AdditionalFalse)
        return err('Not a boolean encoding');
      const result = val === CborAdditionalInfo.AdditionalTrue;
      return this.#advanceBufferAndDataItemCounters(1).map(() => result);
    });
  }

  /** Reads the next data item as a null value (major type 7). */
  readNull(): Result<null, JsonError> {
    return this.#peekInitialByte(CborMajorType.Simple).andThen((header: CborInitialByte) => {
      const val = header.getAdditionalInfo();
      if (val !== CborAdditionalInfo.AdditionalNull) return err('Not a null encoding');
      return this.#advanceBufferAndDataItemCounters(1);
    });
  }

  /** Reads the next data item as the start of an indefinite-length byte string (major type 2). */
  readStartIndefiniteLengthByteString(): Result<null, JsonError> {
    return this.#peekInitialByte(CborMajorType.ByteString).andThen((header: CborInitialByte) => {
      if (header.getAdditionalInfo() !== CborAdditionalInfo.IndefiniteLength)
        return err('Not indefinite length string');
      return this.#advanceBuffer(1).map(() => {
        this.#pushDataItem(CborMajorType.ByteString);
        return null;
      });
    });
  }

  /** Ends reading an indefinite-length byte string (major type 2). */
  readEndIndefiniteLengthByteString(): Result<null, JsonError> {
    return this.#validateNextByteIsBreakByte()
      .andThen(() => this.#popDataItem(CborMajorType.ByteString))
      .andThen(() => this.#advanceBufferAndDataItemCounters(1));
  }

  /**
   * Reads the next data item as a byte string (major type 2).
   *
   * @returns The decoded byte array.
   *
   * Remark: The method accepts indefinite length strings, which it concatenates to a single string.
   */
  readByteString(): Result<Uint8Array, JsonError> {
    return this.#peekInitialByte(CborMajorType.ByteString).andThen((header: CborInitialByte) => {
      if (header.getAdditionalInfo() === CborAdditionalInfo.IndefiniteLength) {
        return this.#readIndefiniteLengthByteStringConcatenated(CborMajorType.ByteString).andThen(({ val, encodingLength }) => {
          return this.#advanceBufferAndDataItemCounters(encodingLength).map(() => val);
        });
      }
      // FIXME: This combo makes not sens
      // #ensureReadCapacity(bytesToRead: number): Result<null, JsonError> {
      //   if (this.#data.length - this.#offset < bytesToRead) {
      //     return err(UNEXPECTED_END_OF_BUFFER_MSG);
      //   }
      //   return _okNull;
      // }
      //
      // #advanceBuffer(length: number): Result<null, JsonError> {
      //   if (this.#offset + length > this.#data.length) return err('Buffer offset out of bounds');
      //   this.#offset += length;
      //   this.#cachedState = CborReaderState.Undefined;
      //   return _okNull;
      // }
      const buffer = this.#getRemainingBytes();
      return CborReader.#peekDefiniteLength(header, buffer).andThen(result => {
        const { length, bytesRead } = result;
        return this.#ensureReadCapacity(bytesRead + length)
          .andThen(() => this.#advanceBufferAndDataItemCounters(bytesRead + length))
          .map(() => buffer.slice(bytesRead, bytesRead + length));
        });
    });
  }

  /**
   * Reads the next data item as a byte string (major type 2).
   *
   * @returns The decoded byte array.
   *
   * Remark: The method accepts indefinite length strings, which it concatenates to a single string.
   */
  readDefiniteLengthByteString(): Result<Uint8Array, JsonError> {
    return this.#peekInitialByte(CborMajorType.ByteString)
      .andThen((header: CborInitialByte) => {
        if (header.getAdditionalInfo() === CborAdditionalInfo.IndefiniteLength) {
          return err('Expected definite length array and got indefinite length');
        }
        const buffer = this.#getRemainingBytes();
        return CborReader.#peekDefiniteLength(header, buffer).andThen(result => {
          const { length, bytesRead } = result;
          return this.#ensureReadCapacity(bytesRead + length).andThen(() => {
            return this.#advanceBufferAndDataItemCounters(bytesRead + length).map(() => buffer.slice(bytesRead, bytesRead + length));
          });
        });
      });
  }

  /** Reads the next data item as the start of an indefinite-length UTF-8 text string (major type 3). */
  readStartIndefiniteLengthTextString(): Result<null, JsonError> {
    return this.#peekInitialByte(CborMajorType.Utf8String).andThen((header: CborInitialByte) => {
      if (header.getAdditionalInfo() !== CborAdditionalInfo.IndefiniteLength)
        return err('Not indefinite length string');

      this.#advanceBuffer(1);
      this.#pushDataItem(CborMajorType.Utf8String);
      return _okNull;
    });
  }

  /** Ends reading an indefinite-length UTF-8 text string (major type 3). */
  readEndIndefiniteLengthTextString() {
    return this.#validateNextByteIsBreakByte()
      .andThen(() => this.#popDataItem(CborMajorType.Utf8String))
      .andThen(() => this.#advanceBufferAndDataItemCounters(1));
  }

  /**
   * Reads the next data item as a UTF-8 text string (major type 3).
   *
   * @returns The decoded string.
   *
   * Remark: The method accepts indefinite length strings, which it concatenates to a single string.
   */
  readTextString(): Result<string, JsonError> {
    return this.#peekInitialByte(CborMajorType.Utf8String).andThen((header: CborInitialByte) => {
      if (header.getAdditionalInfo() === CborAdditionalInfo.IndefiniteLength) {
        return this.#readIndefiniteLengthByteStringConcatenated(CborMajorType.Utf8String)
            .andThen(({ val, encodingLength }) => {
              return this.#advanceBufferAndDataItemCounters(encodingLength).map(() => Buffer.from(val).toString('utf8'));
            });
      }

      const buffer = this.#getRemainingBytes();
      return CborReader.#peekDefiniteLength(header, buffer).andThen(({ length, bytesRead }) => {
        return this.#ensureReadCapacity(bytesRead + length)
          .andThen(() => this.#advanceBufferAndDataItemCounters(bytesRead + length))
          .map(() => Buffer.from(buffer.slice(bytesRead, bytesRead + length)).toString('utf8'));
      });
    });
  }

  /**
   * Reads the next data item as a UTF-8 text string (major type 3).
   *
   * @returns The decoded string.
   *
   * Remark: The method accepts indefinite length strings, which it concatenates to a single string.
   */
  readDefiniteLengthTextString(): Result<string, JsonError> {
    return this.#peekInitialByte(CborMajorType.Utf8String).andThen((header: CborInitialByte) => {
      if (header.getAdditionalInfo() === CborAdditionalInfo.IndefiniteLength) {
        return err('Expected definite length string and got indefinite length');
      }
      const buffer = this.#getRemainingBytes();
      return CborReader.#peekDefiniteLength(header, buffer).andThen(({ length, bytesRead }) => {
        return this.#ensureReadCapacity(bytesRead + length).andThen(() => {
          return this.#advanceBufferAndDataItemCounters(bytesRead + length)
            .map(() => Buffer.from(buffer.slice(bytesRead, bytesRead + length)).toString('utf8'));
        });
      });
    });
  }

  /**
   * Reads the next data item as a semantic tag (major type 6) advancing the reader.
   *
   * @returns The decoded value.
   */
  readTag(): Result<CborTag, JsonError> {
    return this.#peekTagCore().map(({ tag, bytesRead }) => {
      this.#advanceBuffer(bytesRead);
      this.#isTagContext = true;
      return tag;
    });
  }

  /**
   * Reads the next data item as a semantic tag (major type 6), without advancing the reader.
   *
   * @returns The decoded value.
   */
  peekTag(): Result<CborTag, JsonError> {
    return this.#peekTagCore().map(r => r.tag);
  }

  // Private methods.

  /**
   * Peeks the next initial byte without advancing the data stream.
   *
   * @param expectedType If an expected type is given, the method will throw in the event of a major type mismatch.
   * @returns The next initial byte.
   */
  // eslint-disable-next-line complexity
  #peekInitialByte(expectedType?: CborMajorType): Result<CborInitialByte, JsonError> {
    if (
      this.#currentFrame.definiteLength !== undefined &&
      this.#currentFrame.definiteLength - this.#currentFrame.itemsRead === 0
    )
      return err('No more data items to read');

    if (this.#offset === this.#data.length) {
      if (this.#currentFrame.type === null && this.#currentFrame.definiteLength === undefined && this.#offset > 0)
        return err('End of root-level. No more data items to read');

      return err(UNEXPECTED_END_OF_BUFFER_MSG);
    }

    const nextByte = CborInitialByte.from(this.#data[this.#offset]);

    switch (this.#currentFrame.type) {
      case CborMajorType.ByteString:
      case CborMajorType.Utf8String:
        // Indefinite-length string contexts allow two possible data items:
        // 1) Definite-length string chunks of the same major type OR
        // 2) a break byte denoting the end of the indefinite-length string context.
        if (
          nextByte.getInitialByte() === CborInitialByte.IndefiniteLengthBreakByte ||
          (nextByte.getMajorType() === this.#currentFrame.type &&
            nextByte.getAdditionalInfo() !== CborAdditionalInfo.IndefiniteLength)
        ) {
          break;
        }

        return err(
          `Indefinite length string contains invalid data item, ${nextByte.getMajorType()}`
        );
    }

    if (expectedType && expectedType !== nextByte.getMajorType())
      return err(
        `Major type mismatch, expected type ${expectedType} but got ${nextByte.getMajorType()}`
      );

    return ok(nextByte);
  }

  /**
   * Peeks the next initial byte without advancing the data stream.
   *
   * @param buffer the buffer where to get the initial byte from.
   * @param expectedType If an expected type is given, the method will throw in the event of a major type mismatch.
   * @returns The next initial byte.
   */
  static #peekNextInitialByte(buffer: Uint8Array, expectedType?: CborMajorType): Result<CborInitialByte, JsonError> {
    return CborReader.ensureReadCapacityInArray(buffer, 1).andThen(() => {
      const header = CborInitialByte.from(buffer[0]);

      if (header.getInitialByte() !== CborInitialByte.IndefiniteLengthBreakByte && header.getMajorType() !== expectedType)
        return err('Indefinite length string contains invalid data item');

      return ok(header);
    });
  }

  /** Checks whether the next initial byte is a break byte. */
  #validateNextByteIsBreakByte(): Result<null, JsonError> {
    return this.#peekInitialByte().andThen(result => {
      if (result.getInitialByte() !== CborInitialByte.IndefiniteLengthBreakByte)
        return err('Not at end of indefinite length data item');
      return _okNull;
    });
  }

  /**
   * Goes one level down into the stack.
   *
   * @param majorType The current major type.
   * @param definiteLength The definite length of the current type (if applicable).
   */
  #pushDataItem(majorType: CborMajorType, definiteLength?: number): void {
    const frame: StackFrame = {
      currentKeyOffset: this.#currentFrame.currentKeyOffset,
      definiteLength: this.#currentFrame.definiteLength,
      frameOffset: this.#currentFrame.frameOffset,
      itemsRead: this.#currentFrame.itemsRead,
      type: this.#currentFrame.type
    };

    this.#nestedItems.push(frame);

    this.#currentFrame.type = majorType;
    this.#currentFrame.definiteLength = definiteLength;
    this.#currentFrame.itemsRead = 0;
    this.#currentFrame.frameOffset = this.#offset;
    this.#isTagContext = false;
    this.#currentFrame.currentKeyOffset = null;
  }

  /**
   * Goes one level up on the stack.
   *
   * @param expectedType The expected major type.
   */
  #popDataItem(expectedType: CborMajorType): Result<null, JsonError> {
    if (this.#currentFrame.type === null || this.#nestedItems.length <= 0)
      return err('Is at root context');

    if (expectedType !== this.#currentFrame.type)
      return err(
        `Pop major type mismatch, expected ${expectedType} but got ${this.#currentFrame.type}`
      );

    if (
      this.#currentFrame.definiteLength !== undefined &&
      this.#currentFrame.definiteLength - this.#currentFrame.itemsRead > 0
    )
      return err('Not at end of definite length data item');

    if (this.#isTagContext) return err('Tag not followed by value');

    const frame = this.#nestedItems.pop();
    this.#restoreStackFrame(frame!);
    return _okNull;
  }

  /**
   * Restores the stack after popping the current stack frame.
   *
   * @param frame the stack frame.
   */
  #restoreStackFrame(frame: StackFrame) {
    this.#currentFrame.type = frame.type;
    this.#currentFrame.frameOffset = frame.frameOffset;
    this.#currentFrame.definiteLength = frame.definiteLength;
    this.#currentFrame.itemsRead = frame.itemsRead;
    this.#currentFrame.currentKeyOffset = frame.currentKeyOffset;
    this.#cachedState = CborReaderState.Undefined;
  }

  /**
   * Gets the remaining bytes in the buffer.
   *
   * @returns An array with the remaining bytes in the buffer.
   */
  #getRemainingBytes(): Uint8Array {
    return this.#data.slice(this.#offset);
  }

  /** Advances the data item counters. */
  #advanceDataItemCounters() {
    ++this.#currentFrame.itemsRead;
    this.#isTagContext = false;
  }

  /**
   * Advances the buffer pointer.
   *
   * @param length The number of bytes to advance the buffer.
   */
  #advanceBuffer(length: number): Result<null, JsonError> {
    if (this.#offset + length > this.#data.length) return err('Buffer offset out of bounds');
    this.#offset += length;
    this.#cachedState = CborReaderState.Undefined;
    return _okNull;
  }

  #advanceBufferAndDataItemCounters(length: number): Result<null, JsonError> {
    return this.#advanceBuffer(length).map(() => {
      this.#advanceDataItemCounters();
      return null;
    });
  }

  /**
   * Asserts that there are enough bytes remaining in the buffer to read the give amount of bytes.
   *
   * @param bytesToRead The number of bytes to read.
   */
  #ensureReadCapacity(bytesToRead: number): Result<null, JsonError> {
    if (this.#data.length - this.#offset < bytesToRead) {
      return err(UNEXPECTED_END_OF_BUFFER_MSG);
    }
    return _okNull;
  }

  /**
   * Asserts that there are enough bytes remaining in the buffer to read the give amount of bytes.
   *
   * @param data The array to read the bytes from.
   * @param bytesToRead The number of bytes to read.
   */
  static ensureReadCapacityInArray(data: Uint8Array, bytesToRead: number): Result<null, JsonError> {
    if (data.length < bytesToRead) {
      return err(UNEXPECTED_END_OF_BUFFER_MSG);
    }
    return _okNull;
  }

  /**
   * Reads the next CBOR token, without advancing the reader.
   *
   * @returns An object that represents the current CBOR reader state.
   */
  // eslint-disable-next-line sonarjs/cognitive-complexity,complexity
  #peekStateCore(): Result<CborReaderState, JsonError> {
    if (
      this.#currentFrame.definiteLength !== undefined &&
      this.#currentFrame.definiteLength - this.#currentFrame.itemsRead === 0
    ) {
      // is at the end of a definite-length context
      if (this.#currentFrame.type === null) return ok(CborReaderState.Finished);

      switch (this.#currentFrame.type) {
        case CborMajorType.Array:
          return ok(CborReaderState.EndArray);
        case CborMajorType.Map:
          return ok(CborReaderState.EndMap);
        default:
          return err('Invalid CBOR major type pushed to stack.');
      }
    }

    if (this.#offset === this.#data.length) {
      if (this.#currentFrame.type === null && this.#currentFrame.definiteLength === undefined) {
        return ok(CborReaderState.Finished);
      }

      return err(UNEXPECTED_END_OF_BUFFER_MSG);
    }

    // peek the next initial byte
    const initialByte = CborInitialByte.from(this.#data[this.#offset]);

    if (initialByte.getInitialByte() === CborInitialByte.IndefiniteLengthBreakByte) {
      if (this.#isTagContext) {
        return err('Tag not followed by value');
      }

      if (this.#currentFrame.definiteLength === undefined) {
        switch (this.#currentFrame.type) {
          case null:
            // found a break byte at the end of a root-level data item sequence
            return err('Unexpected break byte');
          case CborMajorType.ByteString:
            return ok(CborReaderState.EndIndefiniteLengthByteString);
          case CborMajorType.Utf8String:
            return ok(CborReaderState.EndIndefiniteLengthTextString);
          case CborMajorType.Array:
            return ok(CborReaderState.EndArray);
          case CborMajorType.Map: {
            if (this.#currentFrame.itemsRead % 2 === 0) return ok(CborReaderState.EndMap);

            return err('Key missing value');
          }
          default:
            return err('Invalid CBOR major type pushed to stack.');
        }
      } else {
        return err('Unexpected break byte');
      }
    }

    if (this.#currentFrame.type !== null && this.#currentFrame.definiteLength !== null) {
      // is at indefinite-length nested data item
      switch (this.#currentFrame.type) {
        case CborMajorType.ByteString:
        case CborMajorType.Utf8String:
          if (initialByte.getMajorType() !== this.#currentFrame.type) {
            return err('Indefinite length string contains invalid data item');
          }
          break;
      }
    }

    switch (initialByte.getMajorType()) {
      case CborMajorType.UnsignedInteger:
        return ok(CborReaderState.UnsignedInteger);
      case CborMajorType.NegativeInteger:
        return ok(CborReaderState.NegativeInteger);
      case CborMajorType.ByteString:
        return initialByte.getAdditionalInfo() === CborAdditionalInfo.IndefiniteLength
          ? ok(CborReaderState.StartIndefiniteLengthByteString)
          : ok(CborReaderState.ByteString);
      case CborMajorType.Utf8String:
        return initialByte.getAdditionalInfo() === CborAdditionalInfo.IndefiniteLength
          ? ok(CborReaderState.StartIndefiniteLengthTextString)
          : ok(CborReaderState.TextString);
      case CborMajorType.Array:
        return ok(CborReaderState.StartArray);
      case CborMajorType.Map:
        return ok(CborReaderState.StartMap);
      case CborMajorType.Tag:
        return ok(CborReaderState.Tag);
      case CborMajorType.Simple:
        return ok(CborReader.mapSimpleValueDataToReaderState(initialByte.getAdditionalInfo()));
      default:
        return err('Invalid CBOR major type.');
    }
  }

  /**
   * Maps simple value data to reader state.
   *
   * @param value The value.
   */
  static mapSimpleValueDataToReaderState(value: CborAdditionalInfo): CborReaderState {
    // https://tools.ietf.org/html/rfc7049#section-2.3
    switch (value) {
      case CborAdditionalInfo.AdditionalNull:
        return CborReaderState.Null;
      case CborAdditionalInfo.AdditionalFalse:
      case CborAdditionalInfo.AdditionalTrue:
        return CborReaderState.Boolean;
      case CborAdditionalInfo.Additional16BitData:
        return CborReaderState.HalfPrecisionFloat;
      case CborAdditionalInfo.Additional32BitData:
        return CborReaderState.SinglePrecisionFloat;
      case CborAdditionalInfo.Additional64BitData:
        return CborReaderState.DoublePrecisionFloat;
      default:
        return CborReaderState.SimpleValue;
    }
  }

  /**
   * Peeks the definite length for given data item.
   *
   * @param header The initial byte header.
   * @param data The data stream.
   * @returns An object with the definite length and the bytes read.
   */
  static #peekDefiniteLength(header: CborInitialByte, data: Uint8Array): Result<{ length: number; bytesRead: number }, JsonError> {
    return CborReader.#decodeUnsignedInteger(header, data).map(({ unsignedInt: length, bytesRead }) => {
      return { bytesRead, length: Number(length) };
    });
  }

  /**
   * Peeks an unsigned integer from the data stream.
   *
   * @returns An object with the unsigned int and the bytes read.
   */
  #peekUnsignedInteger(): Result<{ unsignedInt: bigint; bytesRead: number }, JsonError> {
    return this.#peekInitialByte().andThen((header: CborInitialByte) => {
      switch (header.getMajorType()) {
        case CborMajorType.UnsignedInteger: {
          return CborReader.#decodeUnsignedInteger(
            header,
            this.#getRemainingBytes()
          );
        }
        case CborMajorType.NegativeInteger: {
          return err('Integer overflow');
        }
        default:
          return err(
            `Reader type mismatch, expected ${CborMajorType.UnsignedInteger} but got ${header.getMajorType()}`
          );
      }
    });
  }

  /**
   * Peeks a signed integer from the data stream.
   *
   * @returns An object with the signed int and the bytes read.
   */
  #peekSignedInteger(): Result<{ signedInt: bigint; bytesRead: number }, JsonError> {
    return this.#peekInitialByte().andThen((header: CborInitialByte) => {

      switch (header.getMajorType()) {
        case CborMajorType.UnsignedInteger: {
          return CborReader.#decodeUnsignedInteger(
            header,
            this.#getRemainingBytes()
          ).map(({ unsignedInt: signedInt, bytesRead }) => {
            return { bytesRead, signedInt: BigInt(signedInt) };
          });
        }
        case CborMajorType.NegativeInteger: {
          return CborReader.#decodeUnsignedInteger(header, this.#getRemainingBytes()).map(({ unsignedInt, bytesRead }) => {
            return { bytesRead, signedInt: BigInt(-1) - unsignedInt };
          });
        }
        default:
          return err(
            `Reader type mismatch, expected ${CborMajorType.UnsignedInteger} or ${
              CborMajorType.NegativeInteger
            } but got ${header.getMajorType()}`
          );
      }
    });
  }

  /**
   * Reads the contents of a indefinite length bytearray or text and returns all the chunks concatenated.
   *
   * @param type The type of the indefinite array.
   * @returns The concatenated array.
   */
  #readIndefiniteLengthByteStringConcatenated(type: CborMajorType): Result<{ val: Uint8Array; encodingLength: number; }, JsonError> {
    const data = this.#getRemainingBytes();
    let concat = Buffer.from([]);
    let encodingLength = 0;

    let i = 1; // skip the indefinite-length initial byte

    let initialByteWrapped = CborReader.#peekNextInitialByte(data.slice(i), type);
    // FIXME: Ugly shortcasts down below :-(
    if(initialByteWrapped.isErr()) return initialByteWrapped.mapErr(err => err) as any;
    let nextInitialByte = unsafeUnwrap(initialByteWrapped);

    while (nextInitialByte.getInitialByte() !== CborInitialByte.IndefiniteLengthBreakByte) {
      const res = CborReader.#peekDefiniteLength(nextInitialByte, data.slice(i));
      if(res.isErr()) {
        return res as any;
      };
      const { length: chunkLength, bytesRead } = unsafeUnwrap(res);
      const payloadSize = bytesRead + Number(chunkLength);

      concat = Buffer.concat([concat, data.slice(i + (payloadSize - chunkLength), i + payloadSize)]);

      i += payloadSize;

      initialByteWrapped = CborReader.#peekNextInitialByte(data.slice(i), type);
      if(initialByteWrapped.isErr()) return initialByteWrapped as any;
      nextInitialByte = unsafeUnwrap(initialByteWrapped);
    }
    encodingLength = i + 1; // include the break byte
    return ok({ encodingLength, val: new Uint8Array(concat) });
  }

  /**
   * Peeks the core tag.
   *
   * @returns the Core tag and the bytes that would be consumed from the stream.
   */
  #peekTagCore(): Result<{ tag: CborTag; bytesRead: number }, JsonError> {
    return this.#peekInitialByte(CborMajorType.Tag).andThen((header: CborInitialByte) => {
      return CborReader.#decodeUnsignedInteger(header, this.#getRemainingBytes())
    }).map(({ unsignedInt: result, bytesRead }) => {
      return { bytesRead, tag: Number(result) as CborTag };
    });
  }

  /**
   * Decodes an unsigned integer.
   *
   * https://tools.ietf.org/html/rfc7049#section-2.1
   *
   * @param header The header byte.
   * @param data the data.
   */
  static #decodeUnsignedInteger(header: CborInitialByte, data: Uint8Array): Result<{ unsignedInt: bigint; bytesRead: number }, JsonError> {
    if ((header.getInitialByte() & CborInitialByte.AdditionalInformationMask) < CborAdditionalInfo.Additional8BitData)
      return ok({ bytesRead: 1, unsignedInt: BigInt(header.getAdditionalInfo()) });

    switch (header.getAdditionalInfo()) {
      case CborAdditionalInfo.Additional8BitData: {
        return CborReader.ensureReadCapacityInArray(data, 2).map(() => {
          return { bytesRead: 2, unsignedInt: BigInt(data[1]) };
        });
      }
      case CborAdditionalInfo.Additional16BitData: {
        return CborReader.ensureReadCapacityInArray(data, 3).map(() => {
          const buffer = Buffer.from(data.slice(1));
          const val = buffer.readUInt16BE();
          return { bytesRead: 3, unsignedInt: BigInt(val) };
        });
      }
      case CborAdditionalInfo.Additional32BitData: {
        return CborReader.ensureReadCapacityInArray(data, 5).map(() => {
          const buffer = Buffer.from(data.slice(1));
          const val = buffer.readUInt32BE();

          return { bytesRead: 5, unsignedInt: BigInt(val) };
        });
      }
      case CborAdditionalInfo.Additional64BitData: {
        return CborReader.ensureReadCapacityInArray(data, 9).map(() => {

          const buffer = Buffer.from(data.slice(1, 9));

          let result = BigInt(0);

          for (const element of buffer) {
            result = (result << BigInt(8)) + BigInt(element);
          }

          return { bytesRead: 9, unsignedInt: result };
        });
      }
      default:
        return err('Invalid integer encoding');
    }
  }

  /**
   * Skips the next item in the current nested level
   *
   * @param initialDepth The starting depth.
   * @returns the depth after the node has been skipped.
   */
  // eslint-disable-next-line complexity
  #skipNextNode(initialDepth: number): Result<number, JsonError> {
    let stateWrapped: Result<CborReaderState, JsonError>;
    let state: CborReaderState;
    let depth = initialDepth;

    // peek, skipping any tags we might encounter
    while ((stateWrapped = this.#peekStateCore()).isOk() && (state = unsafeUnwrap(stateWrapped)) === CborReaderState.Tag) {
      var tag = this.readTag();
      if(tag.isErr()) return tag;
    }
    if(stateWrapped.isErr()) return stateWrapped;
    state = unsafeUnwrap(stateWrapped);

    switch (state) {
      case CborReaderState.UnsignedInteger:
        return this.readUInt().map(() => depth);
      case CborReaderState.NegativeInteger:
        return this.readCborNegativeIntegerRepresentation().map(() => depth);
      case CborReaderState.ByteString:
        return this.readByteString().map(() => depth);
      case CborReaderState.TextString:
        return this.readTextString().map(() => depth);
      case CborReaderState.StartIndefiniteLengthByteString:
        return this.readStartIndefiniteLengthByteString().map(() => depth++);
      case CborReaderState.EndIndefiniteLengthByteString:
        return this.readEndIndefiniteLengthByteString().map(() => depth--);
      case CborReaderState.StartIndefiniteLengthTextString:
        return this.readStartIndefiniteLengthTextString().map(() => depth++);
      case CborReaderState.EndIndefiniteLengthTextString:
        if (depth === 0) return err(`Skip invalid state: ${state}`);
        return this.readEndIndefiniteLengthTextString().map(() => depth--);
      case CborReaderState.StartArray:
        return  this.readStartArray().map(() => depth++);
      case CborReaderState.EndArray:
        if (depth === 0) return err(`Skip invalid state: ${state}`);
        return this.readEndArray().map(() => depth--);
      case CborReaderState.StartMap:
        return this.readStartMap().map(() => depth++);
      case CborReaderState.EndMap:
        if (depth === 0) return err(`Skip invalid state: ${state}`);
        return this.readEndMap().map(() => depth--);
      case CborReaderState.HalfPrecisionFloat:
      case CborReaderState.SinglePrecisionFloat:
      case CborReaderState.DoublePrecisionFloat:
        return this.readDouble().map(() => depth);
      case CborReaderState.Null:
      case CborReaderState.Boolean:
      case CborReaderState.SimpleValue:
        return this.readSimpleValue().map(() => depth);
      default:
        return err(`Skip invalid state: ${state}`);
    }
  }
}
