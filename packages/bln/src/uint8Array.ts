export function concat(list: Uint8Array[]): Uint8Array {
  const length = list.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const arr of list) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

export function equals(l: Uint8Array, r: Uint8Array): boolean {
  return Array.from(l).every((x, i) => x === r[i]);
}
