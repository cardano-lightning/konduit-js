import { bech32, utf8 } from "@scure/base";
import { SHORT_LOOKUP, type Network, type Short } from "./network";
import { convert, type WordParser } from "./words";
import * as uint8Array from "./uint8Array";
import { recoverPubkey } from "./secp";
import { Result, ok, err } from "neverthrow";

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

const parseId: WordParser<number[]> = (words: number[]) => words;
const parseBytes: WordParser<Uint8Array> = (words: number[]) =>
  bech32.fromWords(words);
const parseStr: WordParser<string> = (words: number[]) =>
  utf8.encode(bech32.fromWords(words));
const parseBe: WordParser<number> = (words: number[]) =>
  words.reduce((acc: number, curr: number) => acc * 32 + curr, 0);
const intBe = (bytes: Uint8Array) =>
  bytes.reduce((acc: number, curr: number) => acc * 256 + curr, 0);

function parseFixed(n: number): WordParser<Uint8Array> {
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

export type ParseError =
  | {
      type: "InvalidPrefix";
      message: string;
      prefix: string; // Semantic: the invalid prefix provided
    }
  | {
      type: "UnknownNetwork";
      message: string;
      short: string; // Semantic: the unknown network short code
    }
  | {
      type: "InvalidAmount";
      message: string;
      amountStr: string; // Semantic: the invalid amount string
      details?: string; // Additional info, e.g., "non-digits" or "too large"
    }
  | {
      type: "AmountTooLarge";
      message: string;
      amountMsat: bigint; // Semantic: the amount in msat that was too large
    }
  | {
      type: "InvalidTagData";
      message: string;
      input: number[]; // Semantic: the raw tagged data input
    }
  | {
      type: "InvalidTaggedData";
      message: string;
      tag: number; // Semantic: the tag that failed
      details?: string; // e.g., "length mismatch"
    }
  | {
      type: "InconsistentPayee";
      message: string;
      expectedPayee: Uint8Array; // Semantic: recovered payee
      providedPayee: Uint8Array; // Semantic: payee from tagged data
    }
  | {
      type: "InvalidDataLength";
      message: string;
      expectedLength: number; // Semantic: expected word count
      actualLength: number; // Semantic: actual word count
    }
  | {
      type: "InvalidBech32";
      message: string;
      details: string; // Semantic: error from bech32.decode
    }
  | {
      type: "InvalidSignatureRecovery";
      message: string;
      details?: string; // Any additional recovery error info
    };

export type ParseResult<a> = Result<a, ParseError>;

function parseAmount(s: string): ParseResult<bigint> {
  const trailingChar = s.slice(-1)[0];
  const mkInvalidErr = (msg: string): ParseResult<bigint> => {
    return err({
      type: "InvalidAmount",
      message: msg,
      amountStr: s,
    });
  };
  if (typeof trailingChar === "undefined")
    return mkInvalidErr("Expected non-empty string for amount");
  const hasSuffix = trailingChar.match(/^[munp]$/);
  const valueString = hasSuffix ? s.slice(0, -1) : s;
  if (!valueString.match(/^\d+$/))
    return mkInvalidErr("Expected only digits in amount value");
  const key = (hasSuffix ? trailingChar : "_") as keyof typeof MULTIPLIER;
  const multiplier = MULTIPLIER[key] as (n: bigint) => bigint;
  const amountMsat = multiplier(BigInt(valueString));
  if (amountMsat > MAX_AMOUNT)
    return err({
      type: "AmountTooLarge",
      message: "Amount exceeds maximum allowed value",
      amountMsat,
    });
  return ok(amountMsat);
}

export function parsePrefix(prefix: string): ParseResult<{ network: Network; amount?: bigint }> {
  if (prefix.slice(0, 2) !== "ln")
    return err({
      type: "InvalidPrefix",
      message: "Prefix must start with 'ln'",
      prefix,
    });
  prefix = prefix.slice(2);
  const digitAt = prefix.search(/\d/);
  const short = digitAt < 0 ? prefix : prefix.slice(0, digitAt);
  const network = SHORT_LOOKUP[short as Short];
  if (typeof network === "undefined")
    return err({
      type: "UnknownNetwork",
      message: `Unknown network short code: ${short}`,
      short,
    });
  if(digitAt === -1) {
    return ok({ network });
  }
  return parseAmount(prefix.slice(digitAt)).andThen((amount) => {
    return ok({ network, amount });
  });
}

const runTagParser = <result>(tag: number, name: string, data: number[], parser: WordParser<result>): ParseResult<result> => {
  try {
    const parsed = parser(data);
    return ok(parsed);
  } catch (e) {
    return err({
      type: "InvalidTaggedData",
      message: `Failed to parse tag ${tag} for required field ${name}: ${(e as Error).message}`,
      tag,
      details: (e as Error).message,
    });
  }
}

export function parseTaggedData(s: number[]): ParseResult<TaggedData> {
  const tag2data: Record<number, number[]> = {};
  // The only multi tag is route hint (3)
  const routeHintTag = 3;
  let routeHintData: number[][] = [];
  while (s.length > 0) {
    let [tag, len1, len0] = s;
    if (tag === undefined || len1 === undefined || len0 === undefined)
      return err({
        type: "InvalidTagData",
        message: "Tagged data is incomplete - expecting at least 3 bytes for tag and length",
        input: s,
      });
    let offset = 3 + 32 * len1 + len0;
    const data = s.slice(3, offset);
    if (tag !== routeHintTag) {
      if (tag in tag2data) {
        return err({
          type: "InvalidTaggedData",
          message: `Duplicate tag encountered: ${tag}`,
          tag,
        });
      }
      tag2data[tag] = data;
    } else {
      routeHintData.push(data);
    }
    s = s.slice(offset);
  }
  const parseRequired = <res>(tag: number, name: string, parser: WordParser<res>): ParseResult<res> => {
    const data = tag2data[tag];
    if (!data)
      return err({
        type: "InvalidTaggedData",
        message: `Missing required tag ${tag} for: ${name}`,
        tag,
      });
    return runTagParser(tag, name, data, parser);
  }
  const parseOptional = <res>(tag: number, name: string, parser: WordParser<res>): ParseResult<res | undefined> => {
    const data = tag2data[tag];
    if (!data) return ok(undefined);
    return runTagParser(tag, name, data, parser);
  }

  return Result.combine([
    parseRequired<Uint8Array>(1, "paymentHash", parseFixed(52)),
    Result.combine(routeHintData.map((data) => {
      return runTagParser(3, "routeHint", data, parseRouteHint);
    })).andThen((nestedHints) => {
      const hints: RouteHint[] = [];
      for (const hintList of nestedHints) {
        hints.push(...hintList);
      }
      return ok(hints ?? undefined);
    }),
    parseOptional<FeatureBits>(5, "features", featuresParser),
    parseOptional<number>(6, "expiry", parseBe),
    parseOptional<FallbackAddress>(9, "fallbackAddress", parseFallbackAddress),
    parseOptional<string>(13, "description", parseStr),
    parseOptional<Uint8Array>(16, "paymentSecret", parseFixed(52)),
    parseOptional<Uint8Array>(19, "payee", parseFixed(53)),
    parseOptional<Uint8Array>(23, "descriptionHash", parseFixed(52)),
    parseOptional<number>(24, "minFinalCltvExpiry", parseBe),
    parseOptional<number[]>(27, "metadata", parseId),
  ]).andThen(([
    paymentHash,
    routeHint,
    features,
    expiry,
    fallbackAddress,
    description,
    paymentSecret,
    payee,
    descriptionHash,
    minFinalCltvExpiry,
    metadata,
  ]) => {
    const result: TaggedData = {
      paymentHash,
      description,
      descriptionHash,
      minFinalCltvExpiry,
      expiry,
      paymentSecret,
      features,
      routeHint,
      payee,
      fallbackAddress,
      metadata,
    };
    return ok(result);
  });
}

export function parseData(s: number[]): ParseResult<{ timestamp: number; taggedData: TaggedData }> {
  return Result.combine([
    runTagParser(0, "timestamp", s.slice(0, 7), parseBe),
    parseTaggedData(s.slice(7)),
  ]).andThen(([timestamp, taggedData]) => {
    return ok({ timestamp, taggedData });
  });
}

function parseBech32(s: string): ParseResult<{ prefix: string; words: number[] }> {
  try {
    const { prefix, words } = bech32.decode(s as `${string}1${string}`, false);
    return ok({ prefix, words });
  } catch (e) {
    return err({
      type: "InvalidBech32",
      message: "Failed to decode Bech32 string",
      details: (e as Error).message,
    });
  }
}

/**
 * Parse a BOLT11 Lightning Payment Request into a structured object.
 */
export function parse(s: string): ParseResult<DecodedInvoice> {
  return parseBech32(s).andThen(({ prefix, words }) => {
    return Result.combine([
      parsePrefix(prefix),
      parseData(words.slice(0, -104)),
    ]).andThen(([{ network, amount }, { timestamp, taggedData }]) => {
      const sigWords = words.slice(-104);
      const signature = bech32.fromWords(sigWords) as Uint8Array;
      const payee = recoverPayee(prefix, words.slice(0, -104), signature);
      if (taggedData.payee && !uint8Array.equals(taggedData.payee, payee))
        return err({
          type: "InconsistentPayee",
          message: "Inconsistent payee between tagged data and recovered payee",
          expectedPayee: payee,
          providedPayee: taggedData.payee,
        } as ParseError);
      const result: DecodedInvoice = {
        raw: s,
        network,
        amount,
        timestamp,
        ...taggedData,
        payee,
        signature,
      };
      return ok(result);
    });
  });
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
