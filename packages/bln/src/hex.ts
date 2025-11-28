export const encode = (bytes: Uint8Array) =>
  [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
export const decode = (hex: string) =>
  Uint8Array.from((hex.match(/../g) || []).map((h) => parseInt(h, 16)));
