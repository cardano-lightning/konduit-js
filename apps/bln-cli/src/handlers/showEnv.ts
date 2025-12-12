import { type NodeEnv, type Env } from "../env";

export interface Options {
  json?: boolean;
}

export function handle(env: Env, names: string[], options?: Options) {
  if (names.length == 0) {
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
    for (const table of content) {
      const truncateStr = mTruncate(30);
      console.table(
        Object.entries(table).reduce((acc, [k, v]) => {
          acc[k] = truncateStr(v);
          return acc;
        }, {} as any),
      );
    }
  }
}

const _truncate = (n: number) => (s: string) =>
  s.length > n ? s.substring(0, n - 3) + "..." : s;

const mTruncate = (n: number) => (s: any) =>
  typeof s === "string"
    ? s.length > n
      ? s.substring(0, n - 3) + "..."
      : s
    : s;
