import { ResultAsync, okAsync, errAsync } from "neverthrow";
import type { Codec, Serialiser } from "../codec";

// Async deserialiser returns a ResultAsync instead of Result
export type AsyncDeserialiser<I, O, E> = (i: I) => ResultAsync<O, E>;

// Serialiser remains synchronous (same as in sync codecs)
export type AsyncCodec<I, O, E> = {
  deserialise: AsyncDeserialiser<I, O, E>;
  serialise: Serialiser<O, I>;
};

// Lift a synchronous codec into an async codec
export const fromSync = <I, O, E>(
  codec: Codec<I, O, E>
): AsyncCodec<I, O, E> => {
  return {
    deserialise: (input: I): ResultAsync<O, E> => {
      const result = codec.deserialise(input);
      return result.match(
        (value) => okAsync(value),
        (error) => errAsync(error)
      );
    },
    serialise: codec.serialise
  };
};

// Compose two async codecs (pipe)
export const pipe = <I, M, O, E>(
  first: AsyncCodec<I, M, E>,
  second: AsyncCodec<M, O, E>
): AsyncCodec<I, O, E> => {
  return {
    deserialise: (input: I): ResultAsync<O, E> => {
      return first.deserialise(input).andThen(second.deserialise);
    },
    serialise: (output: O): I => {
      const mid = second.serialise(output);
      return first.serialise(mid);
    }
  };
};

// Compose in categorical order
export const compose = <I, M, O, E>(
  second: AsyncCodec<M, O, E>,
  first: AsyncCodec<I, M, E>
): AsyncCodec<I, O, E> => {
  return pipe(first, second);
};

// Identity async codec
export const mkIdentityCodec = <I, E>(): AsyncCodec<I, I, E> => {
  return {
    deserialise: (input: I): ResultAsync<I, E> => okAsync(input),
    serialise: (output: I): I => output
  };
};

// Right map (map output type)
export const rmapSync = <I, O1, O2, E>(
  codec: AsyncCodec<I, O1, E>,
  fn: (o: O1) => O2,
  fnInv: (o: O2) => O1
): AsyncCodec<I, O2, E> => {
  return {
    deserialise: (input: I): ResultAsync<O2, E> => {
      return codec.deserialise(input).map(fn);
    },
    serialise: (output: O2): I => {
      const mid = fnInv(output);
      return codec.serialise(mid);
    }
  };
};

// Left map (map input type)
export const lmapSync = <I1, I2, O, E>(
  codec: AsyncCodec<I2, O, E>,
  fn: (i: I1) => I2,
  fnInv: (i: I2) => I1
): AsyncCodec<I1, O, E> => {
  return {
    deserialise: (input: I1): ResultAsync<O, E> => {
      const mid = fn(input);
      return codec.deserialise(mid);
    },
    serialise: (output: O): I1 => {
      const mid = codec.serialise(output);
      return fnInv(mid);
    }
  };
};

// Map error type
export const mapErr = <I, O, E, F>(
  codec: AsyncCodec<I, O, E>,
  fn: (e: E) => F
): AsyncCodec<I, O, F> => {
  return {
    deserialise: (input: I): ResultAsync<O, F> => {
      return codec.deserialise(input).mapErr(fn);
    },
    serialise: codec.serialise
  };
};

// Alternative codec combinator
export type CaseSerialisers<O1, O2, I> =
  (serO1: Serialiser<O1, I>, serO2: Serialiser<O2, I>) => Serialiser<O1 | O2, I>;

export const altCodec = <I, O1, O2, E>(
  first: AsyncCodec<I, O1, E>,
  second: AsyncCodec<I, O2, E>,
  caseSerialisers: CaseSerialisers<O1, O2, I>,
  combineErrs: (err1: E, err2: E) => E = (_e1, e2) => e2
): AsyncCodec<I, O1 | O2, E> => {
  return {
    deserialise: (input: I): ResultAsync<O1 | O2, E> =>
      first.deserialise(input).orElse(
        (err1) => second.deserialise(input).mapErr(
          (err2) => combineErrs(err1, err2)
        )
      ),
    serialise: (output: O1 | O2): I => {
      const ser = caseSerialisers(first.serialise, second.serialise);
      return ser(output);
    }
  };
};

