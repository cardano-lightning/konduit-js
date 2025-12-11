import { base16, base64 } from "@scure/base";
import { Command } from "commander";
import * as bln from "@konduit/bln";

import { type Env } from "./env.ts";
import * as handlers from "./handlers.ts";
import { type PayRequest } from "./clients/interface.ts";

interface Handlers {
  showEnv: typeof handlers.showEnv;
  health: typeof handlers.health;
  getInvoices: typeof handlers.getInvoices;
  makeInvoice: typeof handlers.makeInvoice;
  pay: typeof handlers.pay;
}

/**
 * Sets up the commands and options on the Commander program instance.
 * @param program The Commander program instance.
 * @param handlers The exported functions from the handlers module.
 */
export const cli = (program: Command, handlers: Handlers, env: Env) => {
  program
    .command("show-env [nodes]")
    .description("Print info of nodes")
    .option("--json", "Output json rather than tables", false)
    .action((nodes, options) => {
      const names = nodes ? nodes.split(",") : [];
      handlers.showEnv(env, names, options);
    });

  program
    .command("show-invoice invoice")
    .description("Pretty invoice")
    .action((invoice) => {
      const replacer = (k: any, x: any) =>
        x instanceof Uint8Array ? base16.encode(x).toLowerCase() : x;
      console.table(JSON.stringify(bln.bolt11.parse(invoice), replacer, 2));
    });

  program
    .command("health node")
    .description("Do a healthcheck on the node")
    .action((node) => {
      handlers.health(env, node);
    });

  program
    .command("get-invoices node")
    .description("Get invoices on the node")
    .option("-p, --pending", "Filter to only include pending invoices.")
    .option("-r, --reverse", "List invoices in reverse chronological order.")
    .option(
      "-i, --offset <offset>",
      "The index offset to start listing from.",
      BigInt,
    )
    .option(
      "-l, --limit <limit>",
      "Maximum number of invoices to return.",
      BigInt,
    )
    .option(
      "--after <time>",
      "Filter invoices created AFTER this timestamp (POSIX MS). Accepts seconds or ISO date.",
      parseTimeMs,
    )
    .option(
      "--before <time>",
      "Filter invoices created BEFORE this timestamp (POSIX MS). Accepts seconds or ISO date.",
      parseTimeMs,
    )
    .action((node, options) => {
      handlers.getInvoices(env, node, {
        isPending: options.pending,
        isReversed: options.reverse,
        ...(options.offset !== undefined && { indexOffset: options.offset }),
        ...(options.limit !== undefined && { limit: options.limit }),
        ...(options.after !== undefined && { after: options.after }),
        ...(options.before !== undefined && { before: options.before }),
      });
    });

  program
    .command("make-invoice node")
    .description("Make a new invoice")
    .option(
      "-d, --description <text>",
      "Optional human-readable description (BOLT 11 memo).",
    )
    .option("--amount <amount>", "Amount in milli-satoshis.", (val) =>
      BigInt(val),
    )
    .option("--expiry <seconds>", "Invoice expiration in seconds.", (val) =>
      BigInt(val),
    )
    .option(
      "--hash <base64>",
      "The preimage hash (32 bytes). Accepts Base64 or 64-char Hex.",
      parseBytes32,
    )
    .option(
      "--description-hash <base64>",
      "Hash of the description. Accepts Base64 or 64-char Hex.",
      parseBytes32,
    )
    .option("--fallback <address>", "Fallback on-chain address.")
    .option("--cltv <delta>", "Minimum CLTV expiry delta.", (val) =>
      BigInt(val),
    )
    // .option('--route-hints <json>', 'Custom routing hints as a JSON array string.', JSON.parse)
    .option("--private", "Include private routing hints (isPrivate=true).")
    .option("--output <output>", "Output format", "Default")
    .action((node, raw) => {
      const allowedOutputs = ["Default", "PayRequest", "Qr"];
      const parseOutput = (value: string) => {
        if (!allowedOutputs.includes(value))
          throw new Error(
            `Invalid output: ${value}. Must be one of: ${allowedOutputs.join(", ")}`,
          );
        return value;
      };
      handlers.makeInvoice(env, node, {
        request: {
          description: raw.description,
          hash: raw.hash,
          amountMsat: raw.amount,
          descriptionHash: raw.descriptionHash,
          expiry: raw.expiry,
          fallbackAddr: raw.fallbackAddr,
          cltvExpiry: raw.cltvExpiry,
          isPrivate: raw.private,
          // FIXME :: I don't know what this should look like
          ...(raw.routeHints && { routeHints: raw.routeHints as any[] }),
        },
        // FIXME :: sort the typing
        output: parseOutput(raw.output) as any,
      });
    });

  program
    .command("pay node ")
    .description("Pay an invoice")
    .option("--request <bolt11>", "BOLT 11 payment request string.")
    .option(
      "--payee <pubkey>",
      "Destination public key of the payee.",
      parseBytes33,
    )
    .option("--amount <msat>", "Amount in milli-satoshis (msat).", (val) =>
      BigInt(val),
    )
    .option(
      "--hash <hash>",
      "Payment hash (R-Hash). Accepts Hex or Base64.",
      parseBytes33,
    )
    .option(
      "--secret <secret>",
      "Payment secret (preimage hash). Accepts Hex or Base64.",
      parseBytes32,
    )
    .option("--fee-limit <msat>", "Maximum fee in msat (feeLimit).", (val) =>
      BigInt(val),
    )
    .option(
      "--fee-limit-sat <satoshis>",
      "Fee limit in satoshis (feeLimitSat).",
      (val) => BigInt(val),
    )
    .option("--cltv-limit <limit>", "Maximum CLTV expiry limit.", parseInt)
    .option("--final-cltv-delta <delta>", "Final CLTV expiry delta.", parseInt)
    .option("--timeout <seconds>", "Payment timeout in seconds.", parseInt)
    .option(
      "--time-pref <preference>",
      "Time preference factor (double).",
      parseFloat,
    )
    .option("--outgoing-chan-id <id>", "Specific outgoing channel ID.", (val) =>
      BigInt(val),
    )
    .option(
      "--outgoing-chan-ids <ids>",
      "Comma-separated list of channel IDs.",
      (val) => val,
    )
    .option(
      "--last-hop <pubkey>",
      "Last hop public key. Accepts Hex or Base64.",
      parseBytes33,
    )
    .option("--max-parts <parts>", "Max number of payment shards.", parseInt)
    .option("--max-shard-msat <msat>", "Max size of a single shard.", (val) =>
      BigInt(val),
    )
    .option("--allow-self", "Allow self-payments.")
    .option("--amp", "Use AMP (Atomic Multi-Path) payment.")
    .option("--cancelable", "Allow payment cancellation.")
    .option(
      "--no-updates",
      "Suppress inflight updates. FIXME :: this will break things if switched off!",
    )
    .option("--route-hints <json>", "JSON array of route hints.", (val) =>
      JSON.parse(val),
    )
    .option(
      "--payee-records <json>",
      "JSON object for payee custom records.",
      (val) => JSON.parse(val),
    )
    .option(
      "--first-hop-records <json>",
      "JSON object for first hop custom records.",
      (val) => JSON.parse(val),
    )
    .option("--payee-features <bits>", "JSON array of feature bits.", (val) =>
      JSON.parse(val),
    )
    .action((node, raw) => {
      console.log("RAW", raw);
      const request: PayRequest = {
        ...(raw.request && { paymentRequest: raw.request }),
        ...(raw.payee && { payee: raw.payee }),
        ...(raw.amount && { amount: raw.amount }),
        ...(raw.hash && { paymentHash: raw.hash }),
        ...(raw.secret && { paymentSecret: raw.secret }),
        ...(raw.feeLimit && { feeLimit: raw.feeLimit }),
        ...(raw.feeSat && { feeLimitSat: raw.feeSat }),
        ...(raw.finalCltvDelta !== undefined && {
          finalCltvDelta: raw.finalCltvDelta,
        }),
        ...(raw.cltvLimit !== undefined && { cltvLimit: raw.cltvLimit }),
        ...(raw.timeout !== undefined && { timeoutSeconds: raw.timeout }),
        ...(raw.timePref !== undefined && { timePref: raw.timePref }),
        ...(raw.outgoingChannelId && {
          outgoingChannelId: raw.outgoingChannelId,
        }),
        ...(raw.lastHop && { lastHopPubkey: raw.lastHop }),
        ...(raw.maxParts !== undefined && { maxParts: raw.maxParts }),
        ...(raw.maxShardSizeMsat && { maxShardSizeMsat: raw.maxShardSizeMsat }),
        ...(raw.allowSelf !== undefined && { allowSelfPayment: raw.allowSelf }),
        ...(raw.isAmp !== undefined && { isAmp: raw.isAmp }),
        ...(raw.isCancelable !== undefined && {
          isCancelable: raw.isCancelable,
        }),
        ...(raw.noUpdates !== undefined && {
          noInflightUpdates: raw.noUpdates,
        }),
        ...(raw.hints && { routeHints: raw.hints }),
        ...(raw.payeeRecords && { payeeCustomRecords: raw.payeeRecords }),
        ...(raw.firstHopRecords && {
          firstHopCustomRecords: raw.firstHopRecords,
        }),
        ...(raw.payeeFeatures && { payeeFeatures: raw.payeeFeatures }),
        ...(raw.outgoingChannelIds && {
          /// FIXME :: what's going on with these types
          outgoingChannelIds: raw.outgoingChannelIds
            .split(",")
            .map((s: string) => BigInt(s.trim())),
        }),
      };
      handlers.pay(env, node, { request, output: "Default" });
    });
};

const parseTimeMs = (value: string): bigint => {
  if (/^\d+$/.test(value)) {
    return BigInt(value) * 1000n;
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date/time format: ${value}`);
  }
  return BigInt(date.getTime());
};

const parseBytes32 = (value: string): Uint8Array => {
  if (value.length === 64) {
    return base16.decode(value);
  }
  return base64.decode(value);
};

const parseBytes33 = (value: string): Uint8Array => {
  if (value.length === 66) {
    return base16.decode(value);
  }
  return base64.decode(value);
};
