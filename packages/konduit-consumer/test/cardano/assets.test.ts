import { describe, expect, it } from "vitest";
import { Value } from "../../src/cardano/assets";
import { expectOk } from "../assertions";

describe("Value serialization/deserialization", () => {
  it("should successfully roundtrip serialize and deserialize", async () => {
    const origValueHex = "821a0ec7ac9aa4581c269c0c6fb54095825e7f352eb667996872af8d3a988e78595d5958f6a146544d494e763201581c5a0176dc400c08f397a041c2eaa0de667f13f117d3be204595ae77f8a34a43686172616374657234014c536e6f77666c616b6535323401544368726973746d617347726f757050696333313401581c8bb3b343d8e404472337966a722150048c768d0a92a9813596c5338da1434d344201581ce4bbbaa875a797578044ef27713d23dfe07ce74f33163e7c40d7f480a144544d494e01";
    const value = expectOk(Value.cborThroughHexCodec.deserialise(origValueHex));
    const roundtripHex = Value.cborThroughHexCodec.serialise(value);
    expect(roundtripHex).toBe(origValueHex);
  });
});

