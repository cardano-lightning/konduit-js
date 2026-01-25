import { describe, it, expect } from 'vitest';
import { parse, stringify, type Json } from '../src/json';
import { json2StringCodec, json2NumberCodec, json2BooleanCodec, json2NullCodec, objectOf, altJsonCodecs, optional, type JsonCodec } from '../src/json/codecs';
import * as json from '../src/json';
import { expectOk, expectErr } from './assertions';

describe('JSON Codecs', () => {
  describe('basic codecs', () => {
    it('should handle null json correctly', () => {
      expect(json.nullJson).toBeNull();
      const encoded = null;
      expect(encoded).toBeNull();
      const decoded = expectOk(json2NullCodec.deserialise(encoded));
      expect(decoded).toBeNull();
    });
    it('should encode and decode strings', () => {
      const original = "hello world";
      const encoded = json2StringCodec.serialise(original);
      const decoded = expectOk(json2StringCodec.deserialise(encoded));
      expect(decoded).toBe(original);
    });

    it('should encode and decode numbers', () => {
      const original = 42;
      const encoded = json2NumberCodec.serialise(original);
      const decoded = expectOk(json2NumberCodec.deserialise(encoded));
      expect(decoded).toBe(original);
    });

    it('should encode and decode booleans', () => {
      const original = true;
      const encoded = json2BooleanCodec.serialise(original);
      const decoded = expectOk(json2BooleanCodec.deserialise(encoded));
      expect(decoded).toBe(original);
    });

    it('should encode and decode null', () => {
      const value = null;
      const encoded = json2NullCodec.serialise(value);
      const decoded = expectOk(json2NullCodec.deserialise(encoded));
      expect(decoded).toBe(value);
    });

    it('should reject number outside safe integer range', () => {
      const tooBig = BigInt(Number.MAX_SAFE_INTEGER) + 100n;
      expectErr(json2NumberCodec.deserialise(tooBig as Json));
    });
  });

  describe('objectOf codec', () => {
    type Person = {
      name: string;
      age: number;
      active: boolean;
    };

    const json2personCodec: JsonCodec<Person> = objectOf({
      name: json2StringCodec,
      age: json2NumberCodec,
      active: json2BooleanCodec
    });

    it('should encode and decode simple objects', () => {
      const original = { name: "Alice", age: 30, active: true };
      const encoded = json2personCodec.serialise(original);
      const decoded = expectOk(json2personCodec.deserialise(encoded));
      expect(decoded).toEqual(original);
    });

    it('should roundtrip through JSON string', () => {
      const original = { name: "Bob", age: 25, active: false };
      const encoded = json2personCodec.serialise(original);
      const jsonStr = stringify(encoded);
      const parsed = expectOk(parse(jsonStr));
      const decoded = expectOk(json2personCodec.deserialise(parsed));
      expect(decoded).toEqual(original);
    });

    it('should collect errors for missing fields', () => {
      const json2personCodec = objectOf({
        name: json2StringCodec,
        age: json2NumberCodec
      });
      const incomplete = { name: "Charlie" };
      const result = json2personCodec.deserialise(incomplete);
      expectErr(result);
    });

    it('should collect errors for wrong field types', () => {
      const json2personCodec = objectOf({
        name: json2StringCodec,
        age: json2NumberCodec
      });

      const wrongType = {
        name: "Dave",
        age: "not a number"
      };
      const result = json2personCodec.deserialise(wrongType);
      expectErr(result);
    });
  });
  
  describe('nested object codec', () => {
    type Address = {
      street: string;
      city: string;
    };

    type Person = {
      name: string;
      address: Address;
    };
    const json2addressCodec: JsonCodec<Address> = objectOf({
      street: json2StringCodec,
      city: json2StringCodec
    });

    const json2personCodec: JsonCodec<Person> = objectOf({
      name: json2StringCodec,
      address: json2addressCodec
    });
    it('should handle nested objects', () => {
      const person = {
        name: "Bob",
        address: { street: "123 Main St", city: "Springfield" }
      };

      const encoded = json2personCodec.serialise(person);
      const decoded = expectOk(json2personCodec.deserialise(encoded));
      expect(decoded).toStrictEqual(person);
    });

    it('should collect errors in nested objects', () => {
      const invalidPerson = {
        name: "Eve",
        address: {
          street: 123n, // invalid type
          city: "Metropolis"
        }
      };
      const result = json2personCodec.deserialise(invalidPerson);
      const errorJson = expectErr(result);
      expect(typeof errorJson).toBe("object");
      // The error should be something like:
      // {"address":{"street":"Expected string"}}
      if (typeof errorJson === "object" && errorJson !== null) {
        const addressErrors = errorJson["address"];
        expect(typeof addressErrors).toBe("object");
        if (typeof addressErrors === "object" && addressErrors !== null) {
          const streetError = addressErrors["street"];
          expect(typeof streetError).toBe("string");
        }
      }
    });
  });

  describe('alternative codec (string or number)', () => {
    const json2StringOrNumberCodec = altJsonCodecs(
      json2StringCodec,
      json2NumberCodec,
      (serStr, serNum) => (value: string | number) => {
        return typeof value === 'string' ? serStr(value) : serNum(value);
      }
    );

    it('should decode first alternative successfully', () => {
      const strValue = "test";
      const decoded = expectOk(json2StringOrNumberCodec.deserialise(strValue));
      expect(decoded).toBe("test");
    });

    it('should decode second alternative when first fails', () => {
      const numValue = 42n;
      const decoded = expectOk(json2StringOrNumberCodec.deserialise(numValue));
      expect(decoded).toBe(42);
    });

    it('should fail when both alternatives fail', () => {
      const boolValue = true;
      const error = expectErr(json2StringOrNumberCodec.deserialise(boolValue));
      expect(Array.isArray(error)).toBe(true);
      expect((error as Json[]).length).toBe(2);
    });

    it('should serialize using correct case', () => {
      const strEncoded = json2StringOrNumberCodec.serialise("hello");
      expect(strEncoded).toBe("hello");

      const numEncoded = json2StringOrNumberCodec.serialise(123);
      expect(numEncoded).toBe(123n);
    });
  });

  describe('complex object with optional and nullable fields', () => {
    it('optional codec should handle undefined as null in JSON', () => {
      const json2optionalStringCodec = optional(json2StringCodec);

      const encoded1 = json2optionalStringCodec.serialise("hello");
      const decoded1 = expectOk(json2optionalStringCodec.deserialise(encoded1));
      expect(decoded1).toBe("hello");

      const encoded2 = json2optionalStringCodec.serialise(undefined);
      const decoded2 = expectOk(json2optionalStringCodec.deserialise(encoded2));
      expect(decoded2).toBeUndefined();
      expect(encoded2).toBeNull();
    });

    describe('should handle object with nullable string and optional number', () => {
      type Person = {
        name: string;
        nickname: null | string;
        age: number | undefined;
      };
      const json2personCodec: JsonCodec<Person> = objectOf({
        name: json2StringCodec,
        nickname: altJsonCodecs(
          json2NullCodec,
          json2StringCodec,
          (serNull, serString) => (value: null | string) =>
            value === null ? serNull(value) : serString(value)
        ),
        age: optional(json2NumberCodec)
      });

      // Test with all fields present
      it('should encode and decode person with all fields', () => {
        const fullPerson: Person = {
          name: "Alice",
          nickname: "Ally",
          age: 30
        };
        const encoded1 = json2personCodec.serialise(fullPerson);
        const decoded1 = expectOk(json2personCodec.deserialise(encoded1));
        expect(decoded1).toEqual(fullPerson);
      });

      // Test with nickname as null
      it('should encode and decode object with null in nullable value', () => {
        const personWithNullNickname: Person = {
          name: "Bob",
          nickname: null,
          age: 25
        };
        const encoded2 = json2personCodec.serialise(personWithNullNickname);
        const decoded2 = expectOk(json2personCodec.deserialise(encoded2));
        expect(decoded2).toEqual(personWithNullNickname);
      });

      // Test with age as undefined (optional field missing)
      it('should encode and decode object with missing optional value', () => {
        const personWithoutAge: Person = {
          name: "Charlie",
          nickname: "Chuck",
          age: undefined
        };
        const encoded3 = json2personCodec.serialise(personWithoutAge);
        const decoded3 = expectOk(json2personCodec.deserialise(encoded3));
        expect(decoded3.name).toBe("Charlie");
        expect(decoded3.nickname).toBe("Chuck");
        expect(decoded3.age).toBeUndefined();
      });

      // Test with both nickname null and age undefined
      it('should encode and decode object with null and undefined fields', () => {
        const minimalPerson = {
          name: "Dave",
          nickname: null,
          age: undefined,
        };
        const encoded4 = json2personCodec.serialise(minimalPerson);
        const decoded4 = expectOk(json2personCodec.deserialise(encoded4));
        expect(decoded4.name).toBe("Dave");
        expect(decoded4.nickname).toBeNull();
        expect(decoded4.age).toBeUndefined();
      });
      it('should roundtrip through JSON string with optional fields', () => {
        const original: Person = {
          name: "Eve",
          nickname: null,
          age: undefined
        };
        const encoded = json2personCodec.serialise(original);
        const jsonStr = stringify(encoded);
        const parsed = expectOk(parse(jsonStr));
        const decoded = expectOk(json2personCodec.deserialise(parsed));
        expect(decoded.name).toBe("Eve");
        expect(decoded.nickname).toBeNull();
        expect(decoded.age).toBeUndefined();
      });
      it('should store errors for complex object deserialization as JSON object', () => {
        const invalidPerson = {
          name: {}, // valid
          nickname: true, // invalid type
          age: "not a number" // invalid type
        };
        const result = json2personCodec.deserialise(invalidPerson);
        const errorJson = expectErr(result);
        expect(typeof errorJson).toBe("object");
        // The error should be something like:
        //{"name":"Expected string","nickname":["Expected null","Expected string"],"age":"Expected bigint (for number)"}
        if (typeof errorJson === "object" && errorJson !== null) {
          const nameError = errorJson["name"];
          const nicknameError = errorJson["nickname"];
          const ageError = errorJson["age"];
          expect(typeof nameError).toBe("string"); // no error for name
          // Alt codec errors are arrays
          expect(Array.isArray(nicknameError)).toBe(true); // error array for nickname
          expect(typeof ageError).toBe("string"); // error string for age
        }
      });
    });
  });
});


