import { type Env } from "../env.ts";
import { mkClient } from "../clients.ts";

export interface Options {}

export async function handle(env: Env, name: string, options?: Options) {
  const clientEnv = env.nodes[name];
  if (typeof clientEnv === "undefined") throw new Error(`Unknown node ${name}`);
  const client = mkClient(clientEnv);
  await client?.getHealth().then(console.log);
}
