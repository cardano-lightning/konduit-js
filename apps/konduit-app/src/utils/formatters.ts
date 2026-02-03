import * as hex from "./hex";

export const MISSING_PLACEHOLDER = "N/A";

/**
 * Abbreviates a string by keeping the specified number of characters
 * at the start and end, replacing the middle section with an ellipsis.
 *
 * @param {string} str - The string to abbreviate.
 * @param {number} prefixLen - The number of characters to keep at the start.
 * @param {number} suffixLen - The number of characters to keep at the end.
 * @returns {string} The abbreviated string.
 */
export const abbreviate = (str: string | null | undefined, prefixLen: number = 8, suffixLen: number = 8, placeholder: string = MISSING_PLACEHOLDER): string => {
  if(str == null || str === undefined) {
    return placeholder;
  }
  if (str.length <= prefixLen + suffixLen) {
    return str;
  }
  return `${str.substring(0, prefixLen)}...${str.substring(str.length - suffixLen)}`;
};

export const abbreviateHex = (bytes: Uint8Array | null | undefined, prefixLen: number = 8, suffixLen: number = 8, hexPrefix: string = "0x", placeholder: string = MISSING_PLACEHOLDER): string => {
  if(bytes == null || bytes === undefined) return placeholder;
  const hexStr = `${hexPrefix}${hex.encode(bytes)}`;
  return abbreviate(hexStr, prefixLen, suffixLen, placeholder);
}

/**
 * Processes a byte array (Uint8Array).
 * - If ALL bytes are alphanumeric (0-9, a-z, A-Z), it returns the decoded string.
 * - Otherwise, it returns the full content as a hexadecimal string.
 *
 * @param {Uint8Array} bytes The byte array to process.
 * @returns {string} The decoded alphanumeric string or a hex string.
 */
export function formatBytesAlphanumericOrHex(bytes: Uint8Array, hexPrefix: string = "0x"): string {
  const isStrictlyAlphanumeric = Array.from(bytes).every((b) => {
    const isNum = b >= 48 && b <= 57; // 0-9
    const isUpper = b >= 65 && b <= 90; // A-Z
    const isLower = b >= 97 && b <= 122; // a-z
    return isNum || isUpper || isLower;
  });
  if (isStrictlyAlphanumeric) {
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  }

  return `${hexPrefix}${hex.encode(bytes)}`;
}

export function orPlaceholder(value: string | null | undefined, placeholder: string = MISSING_PLACEHOLDER): string {
  if(value == null || value === undefined || value === '') {
    return placeholder;
  }
  return value;
}
