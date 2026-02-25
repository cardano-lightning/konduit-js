import { err, ok, type Result } from "neverthrow";

export const encode = (bytes: Uint8Array): string =>
  [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

type HexDecodingError =
  | { type: "InvalidLength" }
  | { type: "InvalidCharacter"; char: string; byteIndex: number };

export const decode = (hex: string): Result<Uint8Array, HexDecodingError> => {
  if (hex.length % 2 !== 0) {
    return err({ type: "InvalidLength" });
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byteStr = hex.slice(i, i + 2);
    const byte = Number.parseInt(byteStr, 16);
    if (Number.isNaN(byte)) {
      return err({ type: "InvalidCharacter", char: byteStr, byteIndex: i });
    }
    bytes[i / 2] = byte;
  }
  return ok(bytes);
}

export const unsafeDecode = (hex: string): Uint8Array => {
  const result = decode(hex);
  if (result.isErr()) {
    throw new Error(`Failed to decode hex string: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}
