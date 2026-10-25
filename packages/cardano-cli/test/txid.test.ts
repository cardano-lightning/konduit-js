import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import type { Result } from "neverthrow";
import type { TxIdHex } from "@konduit/konduit-consumer/cardano";
import {
  getTxIdFromTxBodyFile,
  getTxIdFromTxFile,
  txIdFromTxIdOutput,
} from "../src/index";

const TX_ID =
  "da49ee0105ffceb499f2df54d8c5b62b9bef4b884be975c7e6a4554a6467bcb4";

/**
 * A transaction file that `cardano-cli` accepts, built *without* a node:
 * `build-raw` needs no chain access and `assemble` just wraps the body.
 */
const buildOfflineTxFile = (dir: string): string => {
  const bodyFile = path.join(dir, "body.json");
  const txFile = path.join(dir, "tx.json");
  execFileSync("cardano-cli", [
    "conway",
    "transaction",
    "build-raw",
    "--tx-in",
    `${TX_ID}#0`,
    "--tx-out",
    "addr_test1vzsyuay6pjdpdgh630wfntua9p8dyttwyplupeuy22vfheqv5dnge+1000000",
    "--fee",
    "200000",
    "--out-file",
    bodyFile,
  ]);
  execFileSync("cardano-cli", [
    "conway",
    "transaction",
    "assemble",
    "--tx-body-file",
    bodyFile,
    "--out-file",
    txFile,
  ]);
  return txFile;
};

/**
 * Put a fake `cardano-cli` at the front of `PATH` so we can drive the
 * helper against a cardano-cli that behaves like an older release.
 */
const withFakeCardanoCli = (script: string, run: () => void): void => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fake-cardano-cli-"));
  const binDir = path.join(dir, "bin");
  fs.mkdirSync(binDir);
  const binPath = path.join(binDir, "cardano-cli");
  fs.writeFileSync(binPath, script, { mode: 0o755 });
  const originalPath = process.env.PATH;
  process.env.PATH = `${binDir}:${originalPath ?? ""}`;
  try {
    run();
  } finally {
    process.env.PATH = originalPath;
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

describe("txIdFromTxIdOutput", () => {
  it("accepts the bare hex text output of every cardano-cli with the command", () => {
    const result = txIdFromTxIdOutput(`${TX_ID}\n`);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe(TX_ID);
  });

  it("accepts the json envelope of cardano-cli >= 10.3.0.0", () => {
    const result = txIdFromTxIdOutput(JSON.stringify({ txhash: TX_ID }));
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe(TX_ID);
  });

  it("rejects output that is neither hex nor json", () => {
    const result = txIdFromTxIdOutput("cardano-cli: command not found");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("TxIdParseError");
      expect(result.error.reason).toBe("notHexOrJson");
    }
  });

  it("rejects json that is not an object", () => {
    const result = txIdFromTxIdOutput("[1,2,3]");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.reason).toBe("notJsonObject");
  });

  it("rejects json without a txhash field", () => {
    const result = txIdFromTxIdOutput(JSON.stringify({ txid: TX_ID }));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.reason).toBe("missingTxHashField");
  });

  it("rejects a txhash that is not a transaction id", () => {
    const result = txIdFromTxIdOutput(
      JSON.stringify({ txhash: "not-a-tx-id" }),
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.reason).toBe("invalidTxHash");
  });
});

describe("getTxIdFromTxFile", () => {
  let tmpDir: string;
  let txFile: string;
  let txBodyFile: string;

  const expectTxId = (
    result: Result<TxIdHex, unknown>,
    expected: string,
  ): void => {
    if (result.isErr()) {
      throw new Error(
        `expected a transaction id, got error: ${JSON.stringify(result.error)}`,
      );
    }
    expect(result.value).toBe(expected);
  };

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cardano-cli-txid-"));
    txFile = buildOfflineTxFile(tmpDir);
    txBodyFile = path.join(tmpDir, "body.json");
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads the tx id out of a transaction file", () => {
    const expected = execFileSync(
      "cardano-cli",
      ["conway", "transaction", "txid", "--tx-file", txFile],
      { encoding: "utf-8" },
    ).trim();
    expect(expected).toMatch(/^[0-9a-f]{64}$/);

    expectTxId(getTxIdFromTxFile(txFile), expected);
  });

  it("reads the tx id out of a transaction body file", () => {
    const expected = execFileSync(
      "cardano-cli",
      ["conway", "transaction", "txid", "--tx-body-file", txBodyFile],
      { encoding: "utf-8" },
    ).trim();

    expectTxId(getTxIdFromTxBodyFile(txBodyFile), expected);
  });

  it("works with a cardano-cli that predates --output-json", () => {
    // cardano-cli < 10.3.0.0 rejects the flag, so the helper must not use it.
    const script = `#!/bin/sh
for arg in "$@"; do
  if [ "$arg" = "--output-json" ]; then
    echo "Invalid option" >&2
    exit 1
  fi
done
echo "${TX_ID}"
`;
    withFakeCardanoCli(script, () => {
      expectTxId(getTxIdFromTxFile(txFile), TX_ID);
    });
  });

  it("works with a cardano-cli that prints the json envelope", () => {
    const script = `#!/bin/sh
echo '{"txhash":"${TX_ID}"}'
`;
    withFakeCardanoCli(script, () => {
      expectTxId(getTxIdFromTxFile(txFile), TX_ID);
    });
  });
});
