import { describe, it, expect } from "vitest";
import { CurrencyFormat } from "../src/index.js";
import Decimal from "decimal.js-i18n";

describe("CurrencyFormat", () => {
  it("formats USD with symbol", () => {
    const formatter = new CurrencyFormat("en-US", {
      currency: "USD",
    });

    const result = formatter.format(new Decimal("1234.56"));
    expect(result).toBe("$1,234.56");
  });

  it("formats USD with different amounts", () => {
    const formatter = new CurrencyFormat("en-US", {
      currency: "USD",
    });

    expect(formatter.format(new Decimal("0.99"))).toBe("$0.99");
    expect(formatter.format(new Decimal("1000000"))).toBe("$1,000,000.00");
  });

  it("formats XYZ without custom symbol", () => {
    const formatter = new CurrencyFormat("en-US", {
      currency: "XYZ",
    });

    const result = formatter.format(new Decimal("1234.56"));
    expect(result).toBe("XYZ 1,234.56");
  });

  it("formats BTC with symbol", () => {
    const formatter = new CurrencyFormat("en-US", {
      currency: "BTC",
    });

    const result = formatter.format(new Decimal("1.23456789"));
    expect(result).toBe("₿1.23456789");
  });

  it("formats BTC with different amounts", () => {
    const formatter = new CurrencyFormat("en-US", {
      currency: "BTC",
    });

    expect(formatter.format(new Decimal("0.00000001"))).toBe("₿0.00000001");
    expect(formatter.format(new Decimal("21"))).toBe("₿21.00");
    expect(formatter.format(new Decimal("0.5"))).toBe("₿0.50");
  });

  it("formats BTC in sats when below threshold", () => {
    const formatter = new CurrencyFormat("en-US", {
      currency: {
        code: "BTC",
        unit: "btc",
        satDisplayThreshold: new Decimal("0.0001"), // 10,000 sat
      },
    });

    // Below threshold: should display in sats
    expect(formatter.format(new Decimal("0.00005"))).toBe("5,000 sat");
    expect(formatter.format(new Decimal("0.00000001"))).toBe("1 sat");
  });

  it("formats BTC in sat when above threshold", () => {
    const formatter = new CurrencyFormat("en-US", {
      currency: {
        code: "BTC",
        unit: "sat",
        satDisplayThreshold: new Decimal("0.0001"), // 10,000 sats
      },
    });

    // Above threshold: should display in BTC
    expect(formatter.format(new Decimal("100000"))).toBe("₿0.001");
    expect(formatter.format(new Decimal("1.5"))).toBe("1.5 sat");
  });

  it("formats ADA correctly when amount expressed in ADA", () => {
    const formatter = new CurrencyFormat("en-US", {
      currency: {
        code: "ADA",
        unit: "ada",
        lovelaceDisplayThreshold: new Decimal("0.1"), // 100,000 lovelace
      },
    });

    // Below threshold: should display in lovelace
    expect(formatter.format(new Decimal("0.05"))).toBe("50,000 lovelace");
    expect(formatter.format(new Decimal("0.000001"))).toBe("1 lovelace");
  });

  it("formats ADA correctly when amount expressed in lovelace", () => {
    const formatter = new CurrencyFormat("en-US", {
      currency: {
        code: "ADA",
        unit: "lovelace",
        lovelaceDisplayThreshold: new Decimal("0.1"), // 100,000 lovelace
      },
    });

    // Above threshold: should display in ADA
    expect(formatter.format(new Decimal("1000000"))).toBe("₳1.00");
    // Below threshold when using lovelace as unit
    expect(formatter.format(new Decimal("1"))).toBe("1 lovelace");
  });

  it("formats ADA with symbol for different locale", () => {
    const usformatter = new CurrencyFormat("en-US", {
      currency: "ADA",
    });

    expect(usformatter.format(new Decimal("0.000001"))).toBe("₳0.000001");
    expect(usformatter.format(new Decimal("1000"))).toBe("₳1,000.00");
    expect(usformatter.format(new Decimal("0.5"))).toBe("₳0.50");

    const plformatter = new CurrencyFormat("pl-PL", {
      currency: "ADA",
      currencyDisplay: "symbol",
    });

    expect(plformatter.format(new Decimal("0.000001"))).toBe("0,000001 ₳");
    expect(plformatter.format(new Decimal("1000"))).toBe("1000,00 ₳");
    expect(plformatter.format(new Decimal("0.5"))).toBe("0,50 ₳");
  });
});
