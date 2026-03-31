import { describe, it, expect } from "vitest";
import { AdaptorFx } from "../../src/adaptorClient/fx";
import { AdaptorFullInfo } from "../../src/adaptorClient";
import { expectOk, expectNotNull } from "../assertions";
import { Millisatoshi } from "../../src/bitcoin";


describe("AdaptorFx endpoint (integration with adaptor server)", () => {
  it("hits the adaptor /opt/fx endpoint if adaptor URL is provided", async (t) => {
    const adaptorUrlOpt = import.meta.env.VITE_TEST_ADAPTOR_URL;
    if (!adaptorUrlOpt) {
      t.skip();
    }

    const adaptorUrlStr = expectNotNull(adaptorUrlOpt);
    const adaptorFullInfo = expectOk(
      await AdaptorFullInfo.fromString(adaptorUrlStr),
      "Failed to fetch adaptor info in AdaptorFx endpoint test",
    );
    const [adaptorUrl, _info] = adaptorFullInfo;

    const { mkAdaptorClient } = await import("../../src/adaptorClient");
    const client = mkAdaptorClient(adaptorUrl);

    const fxResult = await client.fx();
    const fx = expectOk(fxResult, "Failed to call /opt/fx on adaptor");

    expect(typeof fx.createdAt).toBe("number");
    expect(fx.createdAt).toBeGreaterThan(0);

    const testMsat = Millisatoshi.fromDigits(1,0,0,0,0);
    const lovelace = expectOk(AdaptorFx.msatToLovelace(fx, testMsat));
    expect(lovelace).toBeGreaterThanOrEqual(0n);
  });
});
