import { err, ok, type Result } from "neverthrow";

export type Deserialiser<I, O, E> = (i: I) => Result<O, E>;

export type Serialiser<O, I> = (o: O) => I;

export type Codec<I, O, E> = {
  deserialise: Deserialiser<I, O, E>;
  serialise: Serialiser<O, I>;
};

export const pipe = <I, M, O, E>(
  first: Codec<I, M, E>,
  second: Codec<M, O, E>
): Codec<I, O, E> => {
  return {
    deserialise: (input: I): Result<O, E> => {
      return first.deserialise(input).andThen(second.deserialise);
    },
    serialise: (output: O): I => {
      const mid = second.serialise(output);
      return first.serialise(mid);
    }
  };
}

// A more natural order of composition :-P
export const compose = <I, M, O, E>(
  second: Codec<M, O, E>,
  first: Codec<I, M, E>
): Codec<I, O, E> => {
  return pipe(first, second);
}

export const imap = <I, O1, O2, E>(
  codec: Codec<I, O1, E>,
  fn: (o: O1) => O2,
  fnInv: (o: O2) => O1
): Codec<I, O2, E> => {
  return {
    deserialise: (input: I): Result<O2, E> => {
      return codec.deserialise(input).map(fn);
    },
    serialise: (output: O2): I => {
      const mid = fnInv(output);
      return codec.serialise(mid);
    }
  };
}

export const mapErr = <I, O, E, F>(
  codec: Codec<I, O, E>,
  fn: (e: E) => F
): Codec<I, O, F> => {
  return {
    deserialise: (input: I): Result<O, F> => {
      return codec.deserialise(input).mapErr(fn);
    },
    serialise: codec.serialise
  };
}

export type CaseSerialisers<O1, O2, I> =
  (serO1: Serialiser<O1, I>, serO2: Serialiser<O2, I>) => Serialiser<O1 | O2, I>;

// Unfortunately we need some help in order to compose two alternative codecs:
// * we need a little help to dispatch between the two values
// * we need a way to combine errors from both deserialisers
export const altCodec = <I, O1, O2, E>(
  first: Codec<I, O1, E>,
  second: Codec<I, O2, E>,
  caseSerialisers: CaseSerialisers<O1, O2, I>,
  combineErrs: (err1: E, err2: E) => E = (_e1, e2) => e2
): Codec<I, O1 | O2, E> => {
  return {
    deserialise: (input: I): Result<O1 | O2, E> =>
      first.deserialise(input).match(
        (res) => ok(res),
        (err1) => second.deserialise(input).match(
          (res) => ok(res),
          (err2) => err(combineErrs(err1, err2))
        )
    ),
    serialise: (output: O1 | O2): I => {
      const ser = caseSerialisers(first.serialise, second.serialise);
      return ser(output);
    }
  };
}
