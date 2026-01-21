export const concat = (arrays: Uint8Array[]): Uint8Array => {
  let total = 0;
  for (const a of arrays) total += a.length;
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

export const writeUInt32LE = (arr: Uint8Array, value: number, offset: number): void => {
  new DataView(arr.buffer, arr.byteOffset, arr.byteLength).setUint32(offset, value, true);
}

export const equal = (a: Uint8Array, b: Uint8Array): boolean => {
  const equals = true;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) {
      return false;
    }
  }
  return equals;
}

