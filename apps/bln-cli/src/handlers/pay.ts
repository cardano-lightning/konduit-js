import { type Env } from "../env.ts";
import { mkClient } from "../clients.ts";
import { type PayRequest } from "../clients/interface.ts";

export const Output = ["Default"];

type Options = {
  request: PayRequest;
  output: (typeof Output)[number];
};

export async function handle(env: Env, name: string, options: Options) {
  const clientEnv = env.nodes[name];
  if (typeof clientEnv === "undefined") throw new Error(`Unknown node ${name}`);
  const client = mkClient(clientEnv);
  const res = await client.pay(options.request || {});
  const output = options.output || "Default";
  if (output === "Default") {
    console.log(res);
  } else {
    console.warn(`Unknown output option ${output}`);
    console.log(res);
  }
}
