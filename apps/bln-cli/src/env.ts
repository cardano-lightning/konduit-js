/**
 * Interface representing the structured configuration for a single lightning node,
 * read from environment variables.
 */

export interface Env {
  expiry: number | null;
  amount: bigint;
  nodes: Record<string, NodeEnv>;
}

export const NODE_TYPES = ["LND", "CLN", "MOCK"] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export interface NodeEnv {
  name: string;
  type: NodeType;
  baseUrl: string;
  credentials?: string; // Macaroon, Rune, API Key, etc.
  tlsCertificates?: string;
}

// Prevent name clash
const ENV_PREFIX = "KJS";

const EXPIRY = "EXPIRY";
const AMOUNT = "AMOUNT";
const NODE_PREFIX = "NODE";

// node envvars key format is KJS_NODE_<name>_BLAH.

const NODE_TYPE = "TYPE";
const NODE_BASE_URL = "BASE_URL";
const NODE_CREDENTIALS = "CREDENTIALS";
const NODE_TLS_CERTIFICATES = "TLS_CERTIFICATES";

/**
 * Constructs kjs env from envvars
 * * @returns Env
 */
export function getEnv(): Env {
  const raw = process.env;
  const kjs = Object.keys(raw).reduce(
    (acc, curr) => {
      if (curr.startsWith(ENV_PREFIX)) {
        acc[curr.slice(ENV_PREFIX.length + 1)] = raw[curr] || "";
      }
      return acc;
    },
    {} as Record<string, string>,
  );

  const env = {
    expiry: kjs[EXPIRY] ? Number(kjs[EXPIRY]) : null,
    amount: kjs[AMOUNT] ? BigInt(kjs[AMOUNT]) : 0n,
    nodes: {},
  } as Env;

  // Infer names from `TYPE` declaration
  const names = Object.keys(kjs)
    .filter((x) => x.startsWith(`${NODE_PREFIX}`) && x.endsWith(NODE_TYPE))
    .map((x) =>
      x.slice(NODE_PREFIX.length + 1, -(NODE_TYPE.length + 1)).toLowerCase(),
    );

  for (const name of names) {
    const prefix = `${NODE_PREFIX}_${name.toUpperCase()}`;
    const nodeType = kjs[`${prefix}_${NODE_TYPE}`] as NodeType;
    if (!NODE_TYPES.includes(nodeType))
      throw new Error(`Unknown node type ${nodeType}`);
    const baseUrl = kjs[`${prefix}_${NODE_BASE_URL}`];
    const credentials = kjs[`${prefix}_${NODE_CREDENTIALS}`];
    const tlsCertificates = kjs[`${prefix}_${NODE_TLS_CERTIFICATES}`];
    env.nodes[name] = {
      name,
      type: nodeType,
      baseUrl,
      credentials,
      tlsCertificates,
    };
  }

  return env;
}

export const ENV = getEnv();
