import { describe, it, expect } from "vitest";
import * as bip21 from "../src/bip21";

describe("bip21 spec", () => {
  it("example 1", () => {
    const result = bip21.parse("bitcoin:TB1Q7K6GYXYM0A29USLPRNHT5AY7JXNTG6Y8N37260?lightning=LNTB1P55SDDTPP5UYELAKCK8988777Y7P5M6FZ9Z3TMX5Z6J4AKG2CQ6EM9VUQFR6HSDQQCQZZSXQRRSSSP5RD6L30DTVJ3CVE9TXU64UZ4Q065KZ0HN55VGYLAHLEPUP0H0MEKS9QXPQYSGQ54QEXC3KW06ZX08UX6PHQUP828XML4EEVK29SSKE52P5L6VJEHWNUV67K2SXPMXTDZT2UKP98AAUG2KYKWH27EGT397GLKAYELWS9MSQ2ZT2JD");
    result.match(
      (res) => {
        expect(res.address).toBe("TB1Q7K6GYXYM0A29USLPRNHT5AY7JXNTG6Y8N37260");
        expect(res.options.lightning).toBeDefined();
      },
      (err) => {
        throw err;
      }
    );
  });
});
