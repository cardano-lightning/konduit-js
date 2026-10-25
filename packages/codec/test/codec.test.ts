import { describe, it, expect } from 'vitest';
import { ok, err, type Result } from 'neverthrow';
import { tupleOf, type Codec } from '../src/codec';

describe('generic tupleOf (non-JSON)', () => {
  const stringToNumberCodec: Codec<string, number, string> = {
    deserialise: (input: string): Result<number, string> => {
      const n = Number(input);
      if (Number.isNaN(n)) {
        return err(`Not a number: ${input}`);
      }
      return ok(n);
    },
    serialise: (value: number): string => value.toString(),
  };

  const stringToBooleanCodec: Codec<string, boolean, string> = {
    deserialise: (input: string): Result<boolean, string> => {
      if (input === 'true') return ok(true);
      if (input === 'false') return ok(false);
      return err(`Not a boolean: ${input}`);
    },
    serialise: (value: boolean): string => (value ? 'true' : 'false'),
  };

  it('deserialises multiple codecs from a tuple of inputs into a tuple', () => {
    const codec = tupleOf(stringToNumberCodec, stringToNumberCodec);
    const result = codec.deserialise(['42', '21']);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual<[number, number]>([42, 21]);
    }
  });

  it('serialises a tuple using each corresponding codec', () => {
    const codec = tupleOf(stringToNumberCodec, stringToBooleanCodec);
    const output = codec.serialise([123, true]);

    expect(output).toEqual<[string, string]>(['123', 'true']);
  });

  it('returns an error when any element codec fails', () => {
    const codec = tupleOf(stringToNumberCodec, stringToBooleanCodec);
    const result = codec.deserialise(['not-a-boolean-or-number', 'not-a-boolean-or-number']);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      // by implementation we get the last error (from boolean codec)
      expect(result.error).toBe('Not a boolean: not-a-boolean-or-number');
    }
  });
});
