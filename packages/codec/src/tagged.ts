export type Compare<T> = (a: T, b: T) => -1 | 0 | 1;

export type Ord<T> = {
  areEqual: (a: T, b: T) => boolean;
  compare: Compare<T>;
  isLessThan: (a: T, b: T) => boolean;
  isLessThanOrEqual: (a: T, b: T) => boolean;
  isGreaterThan: (a: T, b: T) => boolean;
  isGreaterThanOrEqual: (a: T, b: T) => boolean;
  max: (a: T, b: T) => T;
  min: (a: T, b: T) => T;
}

export const mkCompare = <T>(isLessThan: (a: T, b: T) => boolean, isGreaterThan: (a: T, b: T) => boolean): ((a: T, b: T) => -1 | 0 | 1) => {
  return (a: T, b: T): -1 | 0 | 1 => {
    if (isLessThan(a, b)) return -1;
    if (isGreaterThan(a, b)) return 1;
    return 0;
  }
}

export const mkOrdForTuple = <A, B>(ordA: Ord<A>, ordB: Ord<B>): Ord<[A, B]> => {
  type T = [A, B];
  const areEqual = (t1: T, t2: T): boolean => ordA.areEqual(t1[0], t2[0]) && ordB.areEqual(t1[1], t2[1]);
  const isLessThan = (t1: T, t2: T): boolean => {
    if (ordA.areEqual(t1[0], t2[0])) {
      return ordB.isLessThan(t1[1], t2[1]);
    }
    return ordA.isLessThan(t1[0], t2[0]);
  }
  const isLessThanOrEqual = (t1: T, t2: T): boolean => areEqual(t1, t2) || isLessThan(t1, t2);
  const isGreaterThan = (t1: T, t2: T): boolean => !areEqual(t1, t2) && !isLessThan(t1, t2);
  const isGreaterThanOrEqual = (t1: T, t2: T): boolean => areEqual(t1, t2) || isGreaterThan(t1, t2);
  const max = (t1: T, t2: T): T => isGreaterThan(t1, t2) ? t1 : t2;
  const min = (t1: T, t2: T): T => isLessThan(t1, t2) ? t1 : t2;
  return {
    areEqual,
    compare: mkCompare(isLessThan, isGreaterThan),
    isLessThan,
    isLessThanOrEqual,
    isGreaterThan,
    isGreaterThanOrEqual,
    max,
    min,
  }
}


export const mkOrdForScalar = <T extends bigint | number | string | boolean>(): Ord<T> => {
  const areEqual = (a: T, b: T): boolean => a === b;
  const isLessThan = (a: T, b: T): boolean => a < b;
  const isLessThanOrEqual = (a: T, b: T): boolean => a <= b;
  const isGreaterThan = (a: T, b: T): boolean => a > b;
  const isGreaterThanOrEqual = (a: T, b: T): boolean => a >= b;
  const max = (a: T, b: T): T => a > b ? a : b;
  const min = (a: T, b: T): T => a < b ? a : b;
  return {
    areEqual,
    compare: mkCompare(isLessThan, isGreaterThan),
    isLessThan,
    isLessThanOrEqual,
    isGreaterThan,
    isGreaterThanOrEqual,
    max,
    min,
  }
}

export type Uint8ArrayOrderingStrategy = "length-first" | "lexicographic";

export const mkOrdForUint8Array = <T extends Uint8Array>(strategy: Uint8ArrayOrderingStrategy = "lexicographic"): Ord<T> => {
  const areEqual = (a: T, b: T): boolean => a.length === b.length && a.every((value, index) => value === b[index]);
  const isLessThan = (a: T, b: T): boolean => {
    if(strategy === "length-first" && a.length !== b.length) {
      return a.length < b.length;
    }
    const minLength = Math.min(a.length, b.length);
    for (let i = 0; i < minLength; i++) {
      if (a[i]! < b[i]!) return true;
      if (a[i]! > b[i]!) return false;
    }
    return a.length < b.length;
  };
  const isLessThanOrEqual = (a: T, b: T): boolean => areEqual(a, b) || isLessThan(a, b);
  const isGreaterThan = (a: T, b: T): boolean => !areEqual(a, b) && !isLessThan(a, b);
  const isGreaterThanOrEqual = (a: T, b: T): boolean => areEqual(a, b) || isGreaterThan(a, b);
  return {
    areEqual,
    compare: mkCompare(isLessThan, isGreaterThan),
    isLessThan,
    isLessThanOrEqual,
    isGreaterThan,
    isGreaterThanOrEqual,
    max: (a: T, b: T): T => isGreaterThan(a, b) ? a : b,
    min: (a: T, b: T): T => isLessThan(a, b) ? a : b,
  }
}

export const mkSemigroup = <T extends bigint | number | string | boolean>(combine: (a: T, b: T) => T) => {
  return {
    combine
  }
}
