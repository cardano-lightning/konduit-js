export type WordParser<T> = (words: number[]) => T;

/**
 * Convert inBits-words to outBits words
 * Based on function from bech32 lib.
 * However it is not exported, and we need `pad`.
 * We use only inBits = 5, outBits = 8.
 */
export function convert(
  data: number[],
  inBits: number,
  outBits: number,
  pad: boolean,
) {
  var value = 0;
  var bits = 0;
  var maxV = (1 << outBits) - 1;

  var result = [];
  for (var i = 0; i < data.length; ++i) {
    value = (value << inBits) | (data[i] as number);
    bits += inBits;

    while (bits >= outBits) {
      bits -= outBits;
      result.push((value >> bits) & maxV);
    }
  }

  if (pad) {
    if (bits > 0) {
      result.push((value << (outBits - bits)) & maxV);
    }
  } else {
    if (bits >= inBits) {
      throw new Error("Excess padding");
    }
    if ((value << (outBits - bits)) & maxV) {
      throw new Error("Non-zero padding");
    }
  }
  return result;
}
