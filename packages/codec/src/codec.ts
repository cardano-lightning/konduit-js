import { err, ok, type Result } from "neverthrow";

export type Deserialiser<I, O, E> = (i: I) => Result<O, E>;

export type Serialiser<O, I> = (o: O) => I;

export type Codec<I, O, E> = {
  deserialise: Deserialiser<I, O, E>;
  serialise: Serialiser<O, I>;
};

export const pipeDeserialisers = <I, M, O, E>(
  first: Deserialiser<I, M, E>,
  second: Deserialiser<M, O, E>
): Deserialiser<I, O, E> => {
  return (input: I): Result<O, E> => {
    return first(input).andThen(second);
  };
};

export const pipe = <I, M, O, E>(
  first: Codec<I, M, E>,
  second: Codec<M, O, E>
): Codec<I, O, E> => {
  return {
    deserialise: pipeDeserialisers(first.deserialise, second.deserialise),
    serialise: (output: O): I => {
      const mid = second.serialise(output);
      return first.serialise(mid);
    }
  };
}

// A more natural order of composition
// More Categorical one :-P
export const compose = <I, M, O, E>(
  second: Codec<M, O, E>,
  first: Codec<I, M, E>
): Codec<I, O, E> => {
  return pipe(first, second);
}

export const mkIdentityCodec = <I, E>(): Codec<I, I, E> => {
  return {
    deserialise: (input: I): Result<I, E> => ok(input),
    serialise: (output: I): I => output
  };
}

// TODO (refactor):
// * Introduce simple Iso type (into: A -> B, from: B -> A) and use it for rmap and lmap
// * Change the order in the lmap (iso, codec) and keep the order in rmap (codec, iso).
//
export type Iso<A, B> = {
  into: (a: A) => B;
  from: (b: B) => A;
};

// Profunctor (tfu!) like mappings from both sides
export const rmap = <I, O1, O2, E>(
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

export const lmap = <I1, I2, O, E>(
  codec: Codec<I2, O, E>,
  fn: (i: I1) => I2,
  fnInv: (i: I2) => I1
): Codec<I1, O, E> => {
  return {
    deserialise: (input: I1): Result<O, E> => {
      const mid = fn(input);
      return codec.deserialise(mid);
    },
    serialise: (output: O): I1 => {
      const mid = codec.serialise(output);
      return fnInv(mid);
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

export type Case2Serialisers<O1, O2, I> =
  (serO1: Serialiser<O1, I>, serO2: Serialiser<O2, I>) => Serialiser<O1 | O2, I>;

// Unfortunately we need some help in order to compose alternative codecs:
// * we need a little help to dispatch between the two values
// * we need a way to combine errors from both deserialisers
// This uses recursive types and variadic tuples to handle arbitrary numbers of alternatives
export type ExtractCodecOutput<C> = C extends Codec<any, infer O, any> ? O : never;
export type ExtractCodecInput<C> = C extends Codec<infer I, any, any> ? I : never;
export type ExtractCodecError<C> = C extends Codec<any, any, infer E> ? E : never;
export type UnionOfCodecsOutputs<Codecs extends readonly Codec<any, any, any>[]> = ExtractCodecOutput<Codecs[number]>;

export const altCodecs = <Codecs extends readonly Codec<any, any, any>[]>(
  codecs: [...Codecs],
  caseSerialisers: (
    ...serialisers: { [K in keyof Codecs]: Codecs[K] extends Codec<infer I, infer O, any> ? Serialiser<O, I> : never }
  ) => Serialiser<UnionOfCodecsOutputs<Codecs>, ExtractCodecInput<Codecs[number]>>,
  combineErrs: (...errors: ExtractCodecError<Codecs[number]>[]) => ExtractCodecError<Codecs[number]> = (...errs) => errs[errs.length - 1]
): Codec<ExtractCodecInput<Codecs[number]>, UnionOfCodecsOutputs<Codecs>, ExtractCodecError<Codecs[number]>> => {
  return {
    deserialise: (input: ExtractCodecInput<Codecs[number]>): Result<UnionOfCodecsOutputs<Codecs>, ExtractCodecError<Codecs[number]>> => {
      const errors: ExtractCodecError<Codecs[number]>[] = [];
      for (const codec of codecs) {
        const result = codec.deserialise(input);
        if (result.isOk()) {
          return result as Result<UnionOfCodecsOutputs<Codecs>, ExtractCodecError<Codecs[number]>>;
        }
        result.mapErr(err => errors.push(err));
      }
      // All alternatives failed, combine all errors
      return err(combineErrs(...errors)) as Result<UnionOfCodecsOutputs<Codecs>, ExtractCodecError<Codecs[number]>>;
    },
    serialise: (output: UnionOfCodecsOutputs<Codecs>): ExtractCodecInput<Codecs[number]> => {
      const serialisers = codecs.map(codec => codec.serialise) as any;
      const ser = caseSerialisers(...serialisers);
      return ser(output);
    }
  };
};
