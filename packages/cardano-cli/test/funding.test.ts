import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { Json } from "@konduit/codec/json";
import { NetworkMagicNumber } from "@konduit/konduit-consumer/cardano";
import { PositiveBigInt } from "@konduit/codec/integers/big";
import {
  createWallet,
  getTip,
  selectUtxos,
  transferFunds,
  UtxoMap,
  type Recipient,
} from "../src/index";

const TESTNET_MAGIC = NetworkMagicNumber.fromPositiveBigInt(
  PositiveBigInt.fromDigits(4, 2),
);

/** A payment address of the local testnet; generated offline. */
let address: string;

beforeAll(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cardano-cli-addr-"));
  try {
    const vkey = path.join(dir, "wallet.vkey");
    const skey = path.join(dir, "wallet.skey");
    const addr = path.join(dir, "wallet.addr");
    execFileSync("cardano-cli", [
      "conway",
      "address",
      "key-gen",
      "--verification-key-file",
      vkey,
      "--signing-key-file",
      skey,
    ]);
    execFileSync("cardano-cli", [
      "conway",
      "address",
      "build",
      "--payment-verification-key-file",
      vkey,
      "--testnet-magic",
      "42",
      "--out-file",
      addr,
    ]);
    address = fs.readFileSync(addr, "utf-8").trim();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

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

const utxoMapOf = (lovelace: bigint[]): UtxoMap => {
  const entries = lovelace.map((amount, index) => {
    const txOutRef = `${index.toString(16).padStart(64, "0")}#0`;
    return `    "${txOutRef}": {
      "address": "${address}",
      "datum": null,
      "datumhash": null,
      "inlineDatum": null,
      "inlineDatumRaw": null,
      "referenceScript": null,
      "value": { "lovelace": ${amount.toString()} }
    }`;
  });
  const json = `{\n${entries.join(",\n")}\n}`;
  const parsed = Json.fromString(json);
  if (parsed.isErr()) throw new Error(`fixture is not json: ${parsed.error}`);
  const map = UtxoMap.jsonDeserialiser(parsed.value);
  if (map.isErr())
    throw new Error(`fixture does not deserialise: ${map.error}`);
  return map.value;
};

describe("selectUtxos", () => {
  it("selects the largest utxos first", () => {
    const result = selectUtxos(
      3_000_000,
      utxoMapOf([1_000_000n, 5_000_000n, 2_000_000n]),
    );
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.totalLovelace).toBe(5_000_000);
      expect(result.value.selectedUtxos.size).toBe(1);
    }
  });

  it("reports insufficient funds instead of throwing", () => {
    const result = selectUtxos(10_000_000, utxoMapOf([1_000_000n, 2_000_000n]));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("InsufficientFunds");
      expect(result.error.requiredLovelace).toBe(10_000_000n);
      expect(result.error.availableLovelace).toBe(3_000_000n);
    }
  });
});

describe("UtxoMap.jsonDeserialiser", () => {
  const utxoJson = (referenceScript: string): string => `{
    "aa00000000000000000000000000000000000000000000000000000000000001#0": {
      "address": "${address}",
      "datum": null,
      "datumhash": null,
      "inlineDatum": null,
      "inlineDatumRaw": null,
      "referenceScript": ${referenceScript},
      "value": { "lovelace": 1000000 }
    }
  }`;

  const deserialise = (json: string) => {
    const parsed = Json.fromString(json);
    if (parsed.isErr()) throw new Error(`fixture is not json: ${parsed.error}`);
    const map = UtxoMap.jsonDeserialiser(parsed.value);
    if (map.isErr())
      throw new Error(`fixture does not deserialise: ${map.error}`);
    return map.value;
  };

  it("accepts the reference script as a hex string (cardano-cli < 10)", () => {
    const map = deserialise(utxoJson('"59155b0101002980"'));
    const utxo = [...map.values()][0];
    expect(utxo?.referenceScript).toBe("59155b0101002980");
  });

  it("accepts the reference script as a script object (cardano-cli >= 10)", () => {
    const map = deserialise(
      utxoJson(
        '{"script": {"cborHex": "59155b0101002980", "description": "", "type": "PlutusScriptV3"}, "description": "", "type": "PlutusScriptV3"}',
      ),
    );
    const utxo = [...map.values()][0];
    expect(utxo?.referenceScript).toBe("59155b0101002980");
  });

  it("accepts a utxo without a reference script", () => {
    const map = deserialise(utxoJson("null"));
    const utxo = [...map.values()][0];
    expect(utxo?.referenceScript).toBe(null);
  });
});

describe("transferFunds", () => {
  const recipients = (count: number): Recipient[] => {
    // The address is only validated when the transaction is built, and we
    // never get that far in these tests.
    return Array.from({ length: count }, () => ({
      amount: 1_000_000,
      address: address as Recipient["address"],
    }));
  };

  it("refuses too many recipients", async () => {
    const result = await transferFunds(
      address as Recipient["address"],
      "/tmp/does-not-matter.skey",
      recipients(61),
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("TooManyRecipients");
      if (result.error.type === "TooManyRecipients") {
        expect(result.error.max).toBe(60);
        expect(result.error.requested).toBe(61);
      }
    }
  });

  it("reports a failed utxo query", async () => {
    const originalSocket = process.env.CARDANO_NODE_SOCKET_PATH;
    process.env.CARDANO_NODE_SOCKET_PATH = path.join(
      os.tmpdir(),
      "no-such-node.sock",
    );
    try {
      const result = await transferFunds(
        address as Recipient["address"],
        "/tmp/does-not-matter.skey",
        recipients(1),
        null,
        TESTNET_MAGIC,
      );
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.type).toBe("UtxoQueryFailed");
    } finally {
      if (originalSocket === undefined) {
        delete process.env.CARDANO_NODE_SOCKET_PATH;
      } else {
        process.env.CARDANO_NODE_SOCKET_PATH = originalSocket;
      }
    }
  });
});

describe("getTip", () => {
  it("reports a failed query instead of throwing", () => {
    const originalSocket = process.env.CARDANO_NODE_SOCKET_PATH;
    process.env.CARDANO_NODE_SOCKET_PATH = path.join(
      os.tmpdir(),
      "no-such-node.sock",
    );
    try {
      const result = getTip();
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.type).toBe("TipQueryFailed");
    } finally {
      if (originalSocket === undefined) {
        delete process.env.CARDANO_NODE_SOCKET_PATH;
      } else {
        process.env.CARDANO_NODE_SOCKET_PATH = originalSocket;
      }
    }
  });

  it("reports a node that is not synchronised", () => {
    const script = `#!/bin/sh
cat <<'JSON'
{ "block": 1, "epoch": 1, "era": "Conway", "hash": "aa", "slot": 2, "slotInEpoch": 1, "slotsToEpochEnd": 100, "syncProgress": "0.42" }
JSON
`;
    withFakeCardanoCli(script, () => {
      const result = getTip();
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("NodeNotSynchronised");
        if (result.error.type === "NodeNotSynchronised") {
          expect(result.error.syncProgress).toBe(0.42);
        }
      }
    });
  });
});

describe("createWallet", () => {
  it("creates a wallet offline", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cardano-cli-wallet-"));
    try {
      const result = createWallet(TESTNET_MAGIC, dir);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.addr).toMatch(/^addr_test1/);
        expect(fs.existsSync(result.value.skeyFile)).toBe(true);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports a failing key generation", () => {
    const script = `#!/bin/sh
echo "boom" >&2
exit 2
`;
    withFakeCardanoCli(script, () => {
      const result = createWallet(TESTNET_MAGIC);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("CommandFailed");
        if (result.error.type === "CommandFailed")
          expect(result.error.step).toBe("key-gen");
      }
    });
  });
});
