import { describe, it, expect } from 'vitest';
import { expectOk, expectErr } from './assertions';
import { fromSync, pipe, rmapSync } from '../src/codec/async';
import { JsonAsyncCodec, objectOf as syncObjectOf } from '../src/json/async';
import { json2StringCodec, json2NumberCodec, json2BooleanCodec, JsonError } from '../src/json/codecs';
import type { Json } from '../src/json';
import { err, ok, Result } from 'neverthrow';

describe('Async Codecs', () => {
  describe('fromSync and basic operations', () => {
    it('should lift sync codec to async and roundtrip', async () => {
      const asyncStringCodec = fromSync(json2StringCodec);
      const original = "hello async";
      const encoded = asyncStringCodec.serialise(original);
      const decoded = expectOk(await asyncStringCodec.deserialise(encoded));
      expect(decoded).toBe(original);
    });

    it('should rmap async codecs correctly', async () => {
      const asyncNumberCodec: JsonAsyncCodec<number> = fromSync(json2NumberCodec);
      const doubleCodec: JsonAsyncCodec<number> = rmapSync(
        asyncNumberCodec,
        (n: number): number => n * 2,
        (n: number): number => n / 2
      );

      const original = 21n as Json;
      const decoded = expectOk(await doubleCodec.deserialise(original));
      expect(decoded).toBe(42);

      const encoded = doubleCodec.serialise(42);
      expect(encoded).toBe(21n);
    });

    it('should pipe async codecs correctly', async () => {
      const asyncNumberCodec: JsonAsyncCodec<number> = fromSync(json2NumberCodec);
      const numberHalfOfNumberCodec = {
        serialise: (n: number): number => n * 2,
        deserialise: async (n: number): Promise<Result<number, JsonError>> => {
          if(n % 2 !== 0) {
            return err(`Cannot deserialise odd number ${n} to half`);
          }
          return ok(n / 2);
        }
      };
      const doubleCodec: JsonAsyncCodec<number> = pipe(
        asyncNumberCodec,
        numberHalfOfNumberCodec
      );

      const original = 42n as Json;
      const decoded = expectOk(await doubleCodec.deserialise(original));
      expect(decoded).toBe(21);

      const encoded = doubleCodec.serialise(21);
      expect(encoded).toBe(42n);

      const failResult = await doubleCodec.deserialise(43n);
      expectErr(failResult);
    });
  });

  describe('async objectOf with nested objects', () => {
    type Address = {
      street: string;
      city: string;
      zipCode: number;
    };

    type Company = {
      name: string;
      founded: number;
    };

    type Person = {
      name: string;
      age: number;
      isActive: boolean;
      address: Address;
      employer: Company;
    };

    const asyncAddressCodec = syncObjectOf({
      street: fromSync(json2StringCodec),
      city: fromSync(json2StringCodec),
      zipCode: fromSync(json2NumberCodec)
    });

    const asyncCompanyCodec = syncObjectOf({
      name: fromSync(json2StringCodec),
      founded: fromSync(json2NumberCodec)
    });

    const asyncPersonCodec = syncObjectOf({
      name: fromSync(json2StringCodec),
      age: fromSync(json2NumberCodec),
      isActive: fromSync(json2BooleanCodec),
      address: asyncAddressCodec,
      employer: asyncCompanyCodec
    });

    it('should encode and decode nested objects', async () => {
      const person: Person = {
        name: "Alice",
        age: 30,
        isActive: true,
        address: {
          street: "123 Main St",
          city: "Springfield",
          zipCode: 12345
        },
        employer: {
          name: "Tech Corp",
          founded: 2010
        }
      };

      const encoded = asyncPersonCodec.serialise(person);
      const decoded = expectOk(await asyncPersonCodec.deserialise(encoded));
      expect(decoded).toEqual(person);
    });

    it('should collect errors from nested objects', async () => {
      const invalidPerson = {
        name: "Bob",
        age: "not a number", // invalid
        isActive: true,
        address: {
          street: 456n, // invalid
          city: "Metropolis",
          zipCode: 54321n
        },
        employer: {
          name: true, // invalid
          founded: 2015n
        }
      };

      const result = await asyncPersonCodec.deserialise(invalidPerson as Json);
      const errorJson = expectErr(result);
      expect(typeof errorJson).toBe("object");

      if (typeof errorJson === "object" && errorJson !== null) {
        // Should have errors for age, address.street, and employer.name
        expect(errorJson["age"]).toBeDefined();
        expect(typeof errorJson["address"]).toBe("object");
        expect(typeof errorJson["employer"]).toBe("object");

        const addressErrors = errorJson["address"];
        if (typeof addressErrors === "object" && addressErrors !== null) {
          expect(addressErrors["street"]).toBeDefined();
        }

        const employerErrors = errorJson["employer"];
        if (typeof employerErrors === "object" && employerErrors !== null) {
          expect(employerErrors["name"]).toBeDefined();
        }
      }
    });

    it('should handle deeply nested valid objects', async () => {
      const complexPerson: Person = {
        name: "Charlie",
        age: 45,
        isActive: false,
        address: {
          street: "789 Oak Ave",
          city: "Shelbyville",
          zipCode: 67890
        },
        employer: {
          name: "Mega Industries",
          founded: 1995
        }
      };

      const encoded = asyncPersonCodec.serialise(complexPerson);
      const decoded = expectOk(await asyncPersonCodec.deserialise(encoded));

      expect(decoded.name).toBe("Charlie");
      expect(decoded.age).toBe(45);
      expect(decoded.isActive).toBe(false);
      expect(decoded.address.street).toBe("789 Oak Ave");
      expect(decoded.address.city).toBe("Shelbyville");
      expect(decoded.address.zipCode).toBe(67890);
      expect(decoded.employer.name).toBe("Mega Industries");
      expect(decoded.employer.founded).toBe(1995);
    });
  });
});
