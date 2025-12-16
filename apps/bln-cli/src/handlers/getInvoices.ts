import { type Env } from "../env";
import { mkClient } from "../clients";
import { type GetInvoicesRequest } from "../clients/interface";

type Options = GetInvoicesRequest;

export async function handle(env: Env, name: string, options?: Options) {
  const clientEnv = env.nodes[name];
  if (typeof clientEnv === "undefined") throw new Error(`Unknown node ${name}`);
  const client = mkClient(clientEnv);
  await client.getInvoices(options || {}).then(console.log);
}
