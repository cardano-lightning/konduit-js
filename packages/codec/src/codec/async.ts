import { Result, ok, err } from "neverthrow";
import type { Codec, Serialiser } from "../codec";

export type AsyncDeserialiser<I, O, E> = (i: I) => Promise<Result<O, E>>;

export const mapAsyncDeserialiser = <I, O1, O2, E>(
  deserialiser: AsyncDeserialiser<I, O1, E>,
  fn: (o: O1) => O2
): AsyncDeserialiser<I, O2, E> => {
  return async (input: I): Promise<Result<O2, E>> => {
    const result = await deserialiser(input);
    return result.map(fn);
  };
};

export const mapAsyncDeserialiserErr = <I, O, E1, E2>(
  deserialiser: AsyncDeserialiser<I, O, E1>,
  fn: (e: E1) => E2
): AsyncDeserialiser<I, O, E2> => {
  return async (input: I): Promise<Result<O, E2>> => {
    const result = await deserialiser(input);
    return result.mapErr(fn);
  };
}

export const andThenAsyncDeserialiser = <I, M, O, E>(
  first: AsyncDeserialiser<I, M, E>,
  second: AsyncDeserialiser<M, O, E>
): AsyncDeserialiser<I, O, E> => {
  return async (input: I): Promise<Result<O, E>> => {
    const firstResult = await first(input);
    return firstResult.match(
      second,
      (error) => err(error)
    );
  };
}

export const orElseAsyncDeserialiser = <I, O, E>(
  first: AsyncDeserialiser<I, O, E>,
  second: AsyncDeserialiser<I, O, E>
): AsyncDeserialiser<I, O, E> => {
  return async (input: I): Promise<Result<O, E>> => {
    const firstResult = await first(input);
    return firstResult.match(
      (value) => ok(value),
      (_error) => second(input)
    );
  };
}

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
    deserialise: async (input: I): Promise<Result<O, E>> => {
      const result = codec.deserialise(input);
      return result.match(
        (value) => ok(value),
        (error) => err(error)
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
    deserialise: async (input: I): Promise<Result<O, E>> => {
      return andThenAsyncDeserialiser(first.deserialise, second.deserialise)(input);
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
    deserialise: async (input: I): Promise<Result<I, E>> => ok(input),
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
    deserialise: async (input: I): Promise<Result<O2, E>> => {
      return mapAsyncDeserialiser(codec.deserialise, fn)(input);
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
    deserialise: async (input: I1): Promise<Result<O, E>> => {
      const mid = fn(input);
      return codec.deserialise(mid);
    },
    serialise: (output: O): I1 => {
      const mid = codec.serialise(output);
      return fnInv(mid);
    }
  };
};

export const rmap = <I, O1, O2, E>(
  codec: AsyncCodec<I, O1, E>,
  fn: (o: O1) => Promise<O2>,
  fnInv: (o: O2) => O1
): AsyncCodec<I, O2, E> => {
  return {
    deserialise: async (input: I): Promise<Result<O2, E>> => {
      const result = await codec.deserialise(input);
      return result.match(
        async (value) => {
          const newValue = await fn(value);
          return ok(newValue);
        },
        (error) => err(error)
      );
    },
    serialise: (output: O2): I => {
      const mid = fnInv(output);
      return codec.serialise(mid);
    }
  };
};

// Map error type
export const mapErr = <I, O, E, F>(
  codec: AsyncCodec<I, O, E>,
  fn: (e: E) => F
): AsyncCodec<I, O, F> => {
  return {
    deserialise: async (input: I): Promise<Result<O, F>> => {
      return mapAsyncDeserialiserErr(codec.deserialise, fn)(input);
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
    deserialise: async (input: I): Promise<Result<O1 | O2, E>> => {
      const firstResult = await first.deserialise(input);
      return firstResult.match(
        (value) => ok(value),
        async (err1) => {
          const secondResult = await second.deserialise(input);
          return secondResult.mapErr(
            (err2) => combineErrs(err1, err2)
          );
        }
      )
    },
    serialise: (output: O1 | O2): I => {
      const ser = caseSerialisers(first.serialise, second.serialise);
      return ser(output);
    }
  };
};

