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

export const writeUInt8 = (arr: Uint8Array, value: number, offset: number): void => {
  new DataView(arr.buffer, arr.byteOffset, arr.byteLength).setUint8(offset, value);
}

export const equal = (a: Uint8Array, b: Uint8Array): boolean => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) {
      return false;
    }
  }
  return (a.length === b.length);
}

export const alloc = (size: number): Uint8Array => {
  return new Uint8Array(size);
};

export const toUtf8 = (str: string): Uint8Array => {
  return new TextEncoder().encode(str);
};

export const fromUtf8 = (arr: Uint8Array): string => {
  return new TextDecoder("utf-8", { fatal: false }).decode(arr);
};

export const readUInt16BE = (arr: Uint8Array, offset: number): number => {
  return new DataView(arr.buffer, arr.byteOffset + offset, 2).getUint16(0, false);
};

export const writeUInt16BE = (arr: Uint8Array, value: number, offset: number): void => {
  new DataView(arr.buffer, arr.byteOffset + offset, 2).setUint16(0, value, false);
};

export const readUInt32BE = (arr: Uint8Array, offset: number): number => {
  return new DataView(arr.buffer, arr.byteOffset + offset, 4).getUint32(0, false);
};

export const writeUInt32BE = (arr: Uint8Array, value: number, offset: number): void => {
  new DataView(arr.buffer, arr.byteOffset + offset, 4).setUint32(0, value, false);
};

export const readFloat32BE = (arr: Uint8Array, offset: number): number => {
  return new DataView(arr.buffer, arr.byteOffset + offset, 4).getFloat32(0, false);
};

export const writeFloat32BE = (arr: Uint8Array, value: number, offset: number): void => {
  new DataView(arr.buffer, arr.byteOffset + offset, 4).setFloat32(0, value, false);
};

export const readFloat64BE = (arr: Uint8Array, offset: number): number => {
  return new DataView(arr.buffer, arr.byteOffset + offset, 8).getFloat64(0, false);
};

export const writeFloat64BE = (arr: Uint8Array, value: number, offset: number): void => {
  new DataView(arr.buffer, arr.byteOffset + offset, 8).setFloat64(0, value, false);
};
