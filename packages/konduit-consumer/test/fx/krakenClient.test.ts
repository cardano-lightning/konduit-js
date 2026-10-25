import { describe, it } from "vitest";
import { mkKrakenClient } from "../../src/fx/kraken";
import { expectOk } from "../assertions";

describe("Kraken client", () => {
  it("fetches all the default tickers", async () => {
    const client = mkKrakenClient();

    const stateResult = await client.getTickers();
    console.log(stateResult);
    expectOk(stateResult, "Failed to fetch prices from Kraken");
  });

  it("fetches a specific ticker", async () => {
    const client = mkKrakenClient();

    const stateResult = await client.getTicker("ADAUSD");
    console.log(stateResult);
    expectOk(stateResult, "Failed to fetch prices from Kraken");
  });
});
