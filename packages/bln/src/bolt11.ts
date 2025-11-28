import { bech32, utf8 } from "@scure/base";
import { SHORT_LOOKUP, type Network, type Short } from "./network.ts";
import { convert, type WordParser } from "./words.ts";
import * as uint8Array from "./uint8Array.ts";
import { recoverPubkey } from "./secp.ts";

/** Defines the structure for a single tag definition in the TAGGED_DATA map. */
export interface TagParser<T> {
  tag: number;
  parser: WordParser<T>;
  multi?: boolean;
}

/** Defines the structure for a single entry in the inverted TAGGED_PARSERS map. */
interface NameParser<T> {
  // Narrowed to strictly use keys from the final interface
  name: keyof TaggedData;
  parser: WordParser<T>;
  multi?: boolean;
}

interface RouteHint {
  pubkey: Uint8Array;
  shortChannelId: Uint8Array; // Hex string
  feeBaseMsat: number;
  feeProportionalMillionths: number;
  cltvExpiryDelta: number;
}

interface ExtraBits {
  start_bit: number;
  bits: boolean[];
  has_required: boolean;
}

interface FeatureBits {
  [key: string]: "required" | "supported" | "unsupported" | ExtraBits;
}

/// TAGGED

/**
 * The tagged data part
 */
export interface TaggedData {
  /** The SHA256 hash of the payment preimage */
  paymentHash: Uint8Array;
  /** A free-form textual description of the payment. */
  description?: string;
  /** The SHA256 hash of the description (decoded from hex). */
  descriptionHash?: Uint8Array;
  /** The minimum CLTV delta for the final hop. */
  minFinalCltvExpiry?: number;
  /** The expiry time of the invoice in seconds. */
  expiry?: number;
  /** The payment secret (decoded from hex). */
  paymentSecret?: Uint8Array;
  /** The feature bits/flags associated with the invoice. */
  features?: FeatureBits;
  /** Route hint */
  routeHint?: RouteHint[];
  /** Payee pub key. */
  payee?: Uint8Array;
  /** Fallback address. */
  fallbackAddress?: FallbackAddress;
  /** Fallback address. */
  metadata?: number[];
}

/**
 * Represents a decoded Lightning Network BOLT11 Invoice.
 */
export interface DecodedInvoice {
  /** The original invoice (raw string). */
  raw: string;
  /** The coin network (e.g., 'btc', 'tb') derived from the 'coin_network' section. */
  network: Network;
  /** The amount of the payment in Satoshis. */
  amount?: bigint;
  /** The invoice creation timestamp (seconds since epoch). */
  timestamp: number;
  /** The SHA256 hash of the payment preimage */
  paymentHash: Uint8Array;
  /** A free-form textual description of the payment. */
  description?: string;
  /** The SHA256 hash of the description (decoded from hex). */
  descriptionHash?: Uint8Array;
  /** The minimum CLTV delta for the final hop. */
  minFinalCltvExpiry?: number;
  /** The expiry time of the invoice in seconds. */
  expiry?: number;
  /** The payment secret (decoded from hex). */
  paymentSecret?: Uint8Array;
  /** The feature bits/flags associated with the invoice. */
  features?: FeatureBits;
  /** The feature bits/flags associated with the invoice. */
  routeHint?: any;
  /** The ECDSA signature over the invoice (decoded from hex). */
  signature: Uint8Array;
  /** Payee pub key. */
  payee: Uint8Array;
  /** Fallback address. */
  fallbackAddress?: FallbackAddress;
}

/// PARSERS

/**
 * ParseBigEndian
 * */

const parseBytes: WordParser<Uint8Array> = (words: number[]) =>
  bech32.fromWords(words);
const parseStr: WordParser<string> = (words: number[]) =>
  utf8.encode(bech32.fromWords(words));
const parseBe: WordParser<number> = (words: number[]) =>
  words.reduce((acc: number, curr: number) => acc * 32 + curr, 0);
const intBe = (bytes: Uint8Array) =>
  bytes.reduce((acc: number, curr: number) => acc * 256 + curr, 0);

function parseFixed(n: number) {
  return (words: number[]) => {
    if (words.length != n)
      throw new Error(`Expected ${n} words. Got ${words.length}`);
    return parseBytes(words);
  };
}

export interface FallbackAddress {
  version: number;
  bytes: Uint8Array;
}

const parseFallbackAddress: WordParser<FallbackAddress> = (words: number[]) => {
  const version = words[0] || -1;
  const bytes = new Uint8Array(convert(words.slice(1), 5, 8, true));
  return { version, bytes };
};

const TAGGED_DATA: Record<keyof TaggedData, TagParser<any>> = {
  paymentHash: { tag: 1, parser: parseFixed(52) },
  paymentSecret: { tag: 16, parser: parseFixed(52) },
  description: { tag: 13, parser: parseStr },
  payee: { tag: 19, parser: parseFixed(53) },
  descriptionHash: { tag: 23, parser: parseFixed(52) },
  expiry: { tag: 6, parser: parseBe },
  minFinalCltvExpiry: { tag: 24, parser: parseBe },
  fallbackAddress: { tag: 9, parser: parseFallbackAddress },
  routeHint: { tag: 3, parser: parseRouteHint, multi: true },
  features: { tag: 5, parser: featuresParser },
  metadata: { tag: 27, parser: parseBytes },
};

const TAGGED_PARSERS = (() =>
  Object.entries(TAGGED_DATA).reduce(
    (acc, [name, { tag, parser, multi }]) => {
      acc[tag] = { name: name as keyof TaggedData, parser, multi };
      return acc;
    },
    {} as { [key: number]: NameParser<any> },
  ))();

function parseRouteHint(words: number[]): RouteHint[] {
  const routes: RouteHint[] = [];
  let bytes: Uint8Array = bech32.fromWords(words);
  // FIXME :: DOUBLE CHECK THIS IS REALLY VIA HEX
  while (bytes.length >= 51) {
    const pubkey = bytes.slice(0, 33);
    const shortChannelId = bytes.slice(33, 41);
    const feeBaseMSats = intBe(bytes.slice(41, 45));
    const feeProportionalMillionths = intBe(bytes.slice(45, 49));
    const cltvExpiryDelta = intBe(bytes.slice(49, 51));
    bytes = bytes.slice(51);
    routes.push({
      pubkey,
      shortChannelId: shortChannelId,
      feeBaseMsat: feeBaseMSats,
      feeProportionalMillionths: feeProportionalMillionths,
      cltvExpiryDelta: cltvExpiryDelta,
    });
  }
  return routes;
}

const FEATUREBIT_ORDER: string[] = [
  "option_data_loss_protect",
  "initial_routing_sync",
  "option_upfront_shutdown_script",
  "gossip_queries",
  "var_onion_optin",
  "gossip_queries_ex",
  "option_static_remotekey",
  "payment_secret",
  "basic_mpp",
  "option_support_large_channel",
];

/**
 * Parses feature bits (tag 5) into a structured object.
 */
function featuresParser(words: number[]): FeatureBits {
  const bools: boolean[] = words
    .slice()
    .reverse()
    .flatMap((word) => [
      !!(word & 0b1),
      !!(word & 0b10),
      !!(word & 0b100),
      !!(word & 0b1000),
      !!(word & 0b10000),
    ]);

  while (bools.length < FEATUREBIT_ORDER.length * 2) {
    bools.push(false);
  }

  const featureBits: FeatureBits = {};
  FEATUREBIT_ORDER.forEach((featureName, index) => {
    const required = bools[index * 2];
    const supported = bools[index * 2 + 1];
    featureBits[featureName] = required
      ? "required"
      : supported
        ? "supported"
        : "unsupported";
  });

  const extraBits = bools.slice(FEATUREBIT_ORDER.length * 2);
  featureBits.extra_bits = {
    start_bit: FEATUREBIT_ORDER.length * 2,
    bits: extraBits,
    has_required: extraBits.reduce(
      (result, bit, index) => (index % 2 === 0 ? result || bit : result),
      false,
    ),
  } as ExtraBits;

  return featureBits;
}

const MULTIPLIER: { [key: string]: (n: bigint) => bigint } = {
  _: (n: bigint) => n * BigInt(1e11),
  m: (n: bigint) => n * BigInt(1e8),
  u: (n: bigint) => n * BigInt(1e5),
  n: (n: bigint) => n * BigInt(1e2),
  p: (n: bigint) => {
    if (n % 10n != 0n) throw new Error("Picosat not supported");
    return n / 10n;
  },
};

const MAX_AMOUNT: bigint = BigInt("2100000000000000000");

function parseAmount(s: string): bigint {
  const trailingChar = s.slice(-1)[0];
  if (typeof trailingChar === "undefined")
    throw new Error("Expected non-empty string");
  const hasSuffix = trailingChar.match(/^[munp]$/);
  const valueString = hasSuffix ? s.slice(0, -1) : s;
  if (!valueString.match(/^\d+$/)) throw new Error(`Expected only digits`);
  const key = (hasSuffix ? trailingChar : "_") as keyof typeof MULTIPLIER;
  const multiplier = MULTIPLIER[key] as (n: bigint) => bigint;
  const amountMsat = multiplier(BigInt(valueString));
  if (amountMsat > MAX_AMOUNT) throw new Error(`Amount greater than allowed`);
  return amountMsat;
}

export function parsePrefix(prefix: string) {
  if (prefix.slice(0, 2) !== "ln") throw new Error("Expect `ln` prefix");
  prefix = prefix.slice(2);
  const digitAt = prefix.search(/\d/);
  const short = digitAt < 0 ? prefix : prefix.slice(0, digitAt);
  const network = SHORT_LOOKUP[short as Short];
  if (typeof network === "undefined")
    throw new Error(`Unknown network short ${short}`);
  const amount = digitAt < 0 ? undefined : parseAmount(prefix.slice(digitAt));
  return { network, ...(typeof amount === "bigint" && { amount }) };
}

export function parseData(s: number[]) {
  const timestamp = parseBe(s.slice(0, 7));
  const taggedData = parseTaggedData(s.slice(7));
  return { timestamp, taggedData };
}

export function parseTaggedData(s: number[]): TaggedData {
  const partial: Partial<TaggedData> = {};
  while (s.length > 0) {
    let [tag, len1, len0] = s;
    if (typeof tag !== "number") throw new Error("Expected more bytes");
    if (typeof len1 !== "number") throw new Error("Expected more bytes");
    if (typeof len0 !== "number") throw new Error("Expected more bytes");
    const nameParser = TAGGED_PARSERS[tag];
    const { name, parser, multi } = nameParser
      ? nameParser
      : { name: `UnknownTag${tag}`, parser: (x: number[]) => x };
    let offset = 3 + 32 * len1 + len0;
    const data = s.slice(3, offset);
    s = s.slice(offset);
    if (multi) {
      // @ts-ignore : FIXME
      partial[name] = [...(partial[name] || []), parser(data)];
    } else {
      // @ts-ignore : FIXME
      partial[name] = parser(data);
    }
  }
  return partial as TaggedData;
}

/**
 * Parse a BOLT11 Lightning Payment Request into a structured object.
 */
export function parse(s: string): DecodedInvoice {
  const { prefix, words } = bech32.decode(s as `${string}1${string}`, false);
  const hrp = parsePrefix(prefix);
  const dataWords = words.slice(0, -104);
  const { timestamp, taggedData } = parseData(dataWords);
  const sigWords = words.slice(-104);
  const signature = bech32.fromWords(sigWords) as Uint8Array;

  const payee = recoverPayee(prefix, dataWords, signature);
  if (taggedData.payee) {
    if (!uint8Array.equals(taggedData.payee, payee))
      throw new Error("Inconsistent payee");
  }

  const result = {
    raw: s,
    ...hrp,
    timestamp,
    ...taggedData,
    payee,
    signature,
  };

  return result;
}

function recoverPayee(
  prefix: string,
  data: number[],
  signature: Uint8Array,
): Uint8Array {
  const sig = new Uint8Array([
    ...signature.slice(-1),
    ...signature.slice(0, 64),
  ]);
  const message = new Uint8Array([
    ...utf8.decode(prefix),
    ...convert(data, 5, 8, true),
  ]);
  return recoverPubkey(message, sig);
}
