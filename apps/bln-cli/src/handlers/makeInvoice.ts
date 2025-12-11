import * as qr from "qrcode";

import { type Env } from "../env.ts";
import { mkClient } from "../clients.ts";
import { type MakeInvoiceRequest } from "../clients/interface.ts";

export const Output = ["Default", "PayRequest", "Qr"];

type Options = {
  request: MakeInvoiceRequest;
  output: (typeof Output)[number];
};

export async function handle(env: Env, name: string, options: Options) {
  const clientEnv = env.nodes[name];
  if (typeof clientEnv === "undefined") throw new Error(`Unknown node ${name}`);
  const client = mkClient(clientEnv);
  const res = await client.makeInvoice(options.request || {});
  const output = options.output || "Default";
  if (output === "Default") {
    console.log(res);
  } else if (output === "PayRequest") {
    console.log(res.paymentRequest);
  } else if (output === "Qr") {
    qr.toString(res.paymentRequest, { type: "utf8" }).then(console.log);
  } else {
    console.warn(`Unknown output option ${output}`);
    console.log(res);
  }
}
