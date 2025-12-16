import { type NodeEnv } from "./env";

import { Client as Lnd } from "./clients/lnd";
import { type Client } from "./clients/interface";

export function mkClient(env: NodeEnv): Client {
  if (env.type == "LND") {
    return new Lnd(env);
  } else if (env.type == "CLN") {
    throw new Error("CLN client not yet implemented");
  } else if (env.type == "MOCK") {
    throw new Error("MOCK client not yet implemented");
  } else {
    throw new Error("impossible");
  }
}
