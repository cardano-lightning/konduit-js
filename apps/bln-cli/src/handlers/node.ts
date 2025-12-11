import { type NodeEnv, type Env } from "../env.ts";

export interface InfoOptions {
  json?: boolean;
}

export function info(env: Env, names?: string[], options?: InfoOptions) {
  if (typeof names === "undefined" || names.length == 0) {
    names = Object.keys(env.nodes);
  }
  const content: NodeEnv[] = names.map((name) => {
    const val = env.nodes[name];
    if (!val) throw new Error(`Unknown node ${name}. Is it in the env?`);
    return val;
  });
  const json = options?.json || false;
  if (json) {
    console.log(JSON.stringify(content, null, 2));
  } else {
    for (const name of names) {
      const table = env.nodes[name];
      if (!table) {
        throw new Error(`Unknown node ${name}. Is it in the env?`);
      } else {
        console.table(table);
      }
    }
  }
}

// --- CLI Handlers Module ---
// Contains mock API interactions and core business logic functions.

export interface Invoice {
  paymentRequest: string;
  description: string;
  amountMsat: number;
  expirySec: number;
  destinationNode: string;
}

/**
 * Mocks the creation of a lightning invoice.
 * @param toNode The node that will receive the payment.
 * @param amountMsat The amount of the invoice in millisatoshis.
 * @param expirySec The time the invoice is valid for in seconds.
 * @returns A mock Invoice object.
 */
export const createInvoice = (
  toNode: string,
  amountMsat: number,
  expirySec: number,
): Invoice => {
  // Generate a mock payment request
  const ts = Date.now();
  const pr = `lnbc1${amountMsat}p1AT${ts}qg9t4s2q...${toNode.substring(0, 4)}pr`;

  return {
    paymentRequest: pr,
    description: `Invoice for ${amountMsat} msat to ${toNode}`,
    amountMsat,
    expirySec,
    destinationNode: toNode,
  };
};

/**
 * Mocks the payment of a lightning invoice.
 * @param fromNode The node paying the invoice.
 * @param paymentDetails The details of the payment, including the amount.
 * @returns A mock success message.
 */
export const payInvoice = (
  fromNode: string,
  paymentDetails: { invoice: string; amountMsat: number },
): string => {
  // Simulate payment logic: connecting, routing, paying, settling
  return `SUCCESS: Node ${fromNode} paid invoice ${paymentDetails.invoice} for ${paymentDetails.amountMsat} msat.`;
};

/**
 * Mocks a simple QR code representation for the console.
 * @param data The data to encode (e.g., a payment request).
 * @returns A string representing a simulated QR code.
 */
export const generateQrCode = (data: string): string => {
  // In a real application, a library would be used to generate an ASCII or image QR code.
  const border = "█".repeat(40);
  return [
    border,
    `█  ${" ".repeat(7)}[ Lightning QR Code ]${" ".repeat(8)}  █`,
    `█  (Simulated block for: ${data.substring(0, 24)}...)  █`,
    `█  ${" ".repeat(10)}[ Scan Me ]${" ".repeat(11)}  █`,
    border,
  ].join("\n");
};

/**
 * Core logic for displaying node information.
 * @param names A comma-separated string of node names, or undefined for all nodes.
 */
export const handleNodeInfo = (names: string | undefined) => {
  const allNodes = ["Alice", "Bob", "Charlie", "Daemon"];

  let requestedNodes: string[];

  if (!names || names.trim() === "") {
    // If list is empty (cli node) or undefined (cli), print info for all named nodes.
    requestedNodes = allNodes;
    console.log("--- Showing Info for ALL Named Nodes ---");
  } else {
    // Process the comma-separated list
    requestedNodes = names
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    console.log(
      `--- Showing Info for Requested Nodes: ${requestedNodes.join(", ")} ---`,
    );
  }

  const info = requestedNodes.map((name) => ({
    name: name,
    pubKey: `03${name.toLowerCase()}...`, // Mock public key
    status: allNodes.includes(name) ? "Online" : "Offline/Unknown",
    channels: allNodes.includes(name) ? Math.floor(Math.random() * 10) + 1 : 0,
    alias: `${name}-ln-node`,
  }));

  console.table(info);
};
