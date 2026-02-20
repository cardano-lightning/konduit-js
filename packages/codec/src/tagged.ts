export const mkOrdForScalar = <T extends bigint | number | string | boolean>() => {
  const areEqual = (a: T, b: T): boolean => a === b;
  const isLessThan = (a: T, b: T): boolean => a < b;
  const isLessThanOrEqual = (a: T, b: T): boolean => a <= b;
  const isGreaterThan = (a: T, b: T): boolean => a > b;
  const isGreaterThanOrEqual = (a: T, b: T): boolean => a >= b;
  return {
    areEqual,
    isLessThan,
    isLessThanOrEqual,
    isGreaterThan,
    isGreaterThanOrEqual,
  }
}

export const mkOrdForUint8Array = <T extends Uint8Array>() => {
  const areEqual = (a: T, b: T): boolean => a.length === b.length && a.every((value, index) => value === b[index]);
  const isLessThan = (a: T, b: T): boolean => {
    const minLength = Math.min(a.length, b.length);
    for (let i = 0; i < minLength; i++) {
      if (a[i] < b[i]) return true;
      if (a[i] > b[i]) return false;
    }
    return a.length < b.length;
  };
  const isLessThanOrEqual = (a: T, b: T): boolean => areEqual(a, b) || isLessThan(a, b);
  const isGreaterThan = (a: T, b: T): boolean => !areEqual(a, b) && !isLessThan(a, b);
  const isGreaterThanOrEqual = (a: T, b: T): boolean => areEqual(a, b) || isGreaterThan(a, b);
  return {
    areEqual,
    isLessThan,
    isLessThanOrEqual,
    isGreaterThan,
    isGreaterThanOrEqual,
  }
}

export const mkSemigroup = <T extends bigint | number | string | boolean>(combine: (a: T, b: T) => T) => {
  return {
    combine
  }
}
