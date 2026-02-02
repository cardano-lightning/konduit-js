import { describe, it } from "vitest";
import { Connector } from "../../src/cardano/connector";
import { expectErr } from "../assertions";
import { Milliseconds } from "../../src/time/duration";

describe("Connector integration tests", () => {
  it("should reject when connecting to an invalid server URL", async () => {
    expectErr(await Connector.new("https://invalid-server-that-does-not-exist.example.com"));
  });

  it("should reject (and not panic) when URL is malformed", async () => {
    expectErr(await Connector.new("ht!tp://in valid-url"));
  });

  it("should reject when server is responding with invalid response", async () => {
    expectErr(await Connector.new("https://example.com"));
  });

  // We shorten the test timeout to avoid waiting too long
  it("should reject when the server is not responding", async () => {
    let httpTimeout = Milliseconds.fromDigits(5, 0, 0);
    const result = await Connector.new("https://blackhole.webpagetest.org/", httpTimeout);
    expectErr(result);
  }, 1000);
});

