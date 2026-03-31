import { Ada, Lovelace } from "../cardano";
import { Millisatoshi, type Satoshi } from '../bitcoin';
import { EuroMillicent, BritishMillipenny, UsMillicent, UsCent } from "../fx/fiat";
import { Result, ok, err } from "neverthrow";

export type Sign = "positive" | "negative";

export type AdaAmount = { symbol: "ADA"; value: Lovelace; sign: Sign }

export namespace AdaAmount {
  export const fromLovelace = (value: Lovelace, sign: Sign = "positive"): AdaAmount =>
    ({ symbol: "ADA", value, sign });

  export const fromAda = (ada: Ada, sign: Sign = "positive"): AdaAmount =>
    fromLovelace(Lovelace.fromAda(ada), sign);

  export const areEqual = (a: AdaAmount, b: AdaAmount): boolean =>
    Lovelace.ord.areEqual(a.value, b.value);

  export const difference = (a: AdaAmount, b: AdaAmount): Result<AdaAmount, string> => {
    const aVal = a.value;
    const bVal = b.value;
    const diff = Lovelace.subtractAbs(aVal, bVal);
    const sign: Sign = aVal >= bVal ? "positive" : "negative";
    return ok({ symbol: "ADA", value: diff, sign });
  };
}

export type BitcoinAmount = { symbol: "BTC", value: Millisatoshi, sign: Sign };
export namespace BitcoinAmount {
  export const fromMillisatoshi = (value: Millisatoshi, sign: Sign = "positive"): BitcoinAmount =>
    ({ symbol: "BTC", value, sign });
  export const fromSatoshi = (value: Satoshi, sign: Sign = "positive"): CryptoAmount =>
    ({ symbol: "BTC", value: Millisatoshi.fromSatoshi(value), sign });

  export const areEqual = (a: BitcoinAmount, b: BitcoinAmount): boolean =>
    Millisatoshi.ord.areEqual(a.value, b.value);

  export const difference = (a: BitcoinAmount, b: BitcoinAmount): Result<BitcoinAmount, string> => {
    const aMsat = a.value;
    const bMsat = b.value;
    const diff = Millisatoshi.subtractAbs(aMsat, bMsat);
    const sign: Sign = aMsat >= bMsat ? "positive" : "negative";
    return ok({ symbol: "BTC", value: diff, sign });
  };
}

export type CryptoAmount = AdaAmount | BitcoinAmount;

export namespace CryptoAmount {
  export const isAdaAmount = (amount: CryptoAmount): amount is AdaAmount =>
    amount.symbol === "ADA";

  export const isBitcoinAmount = (amount: CryptoAmount): amount is BitcoinAmount =>
    amount.symbol === "BTC";

  export const areEqual = (a: CryptoAmount, b: CryptoAmount): boolean | "unknown" => {
    if (a.symbol === "ADA" && b.symbol === "ADA")
      return AdaAmount.areEqual(a, b);
    if (a.symbol === "BTC" && b.symbol === "BTC")
      return BitcoinAmount.areEqual(a, b);
    return "unknown";
  };

  export const difference = (a: CryptoAmount, b: CryptoAmount): Result<CryptoAmount, string> => {
    if (a.symbol === "ADA" && b.symbol === "ADA")
      return AdaAmount.difference(a, b);
    if (a.symbol === "BTC" && b.symbol === "BTC")
      return BitcoinAmount.difference(a, b);
    return err("Cannot subtract amounts of different currencies");
  };
}

export type EuroAmount = { symbol: "EUR", value: EuroMillicent, sign: Sign };

export namespace EuroAmount {
  export const fromEuroMillicent = (value: EuroMillicent, sign: Sign = "positive"): EuroAmount =>
    ({ symbol: "EUR", value, sign });

  export const areEqual = (a: EuroAmount, b: EuroAmount): boolean =>
    EuroMillicent.ord.areEqual(a.value, b.value);

  export const difference = (a: EuroAmount, b: EuroAmount): Result<EuroAmount, string> => {
    const aVal = a.value;
    const bVal = b.value;
    const diff = EuroMillicent.subtractAbs(aVal, bVal);
    const sign: Sign = aVal >= bVal ? "positive" : "negative";
    return ok({ symbol: "EUR", value: diff, sign });
  };
}

export type BritishPoundAmount = { symbol: "GBP", value: BritishMillipenny, sign: Sign };

export namespace BritishPoundAmount {
  export const fromBritishMillipenny = (value: BritishMillipenny, sign: Sign = "positive"): BritishPoundAmount =>
    ({ symbol: "GBP", value, sign });

  export const areEqual = (a: BritishPoundAmount, b: BritishPoundAmount): boolean =>
    BritishMillipenny.ord.areEqual(a.value, b.value);

  export const difference = (a: BritishPoundAmount, b: BritishPoundAmount): Result<BritishPoundAmount, string> => {
    const aVal = a.value;
    const bVal = b.value;
    const diff = BritishMillipenny.subtractAbs(aVal, bVal);
    const sign: Sign = aVal >= bVal ? "positive" : "negative";
    return ok({ symbol: "GBP", value: diff, sign });
  };
}

export type UsDollarAmount = { symbol: "USD", value: UsMillicent, sign: Sign };

export namespace UsDollarAmount {
  export const fromUsCent = (value: UsCent, sign: Sign = "positive"): UsDollarAmount =>
    fromUsMillicent(UsMillicent.fromUsCent(value), sign);

  export const fromUsMillicent = (value: UsMillicent, sign: Sign = "positive"): UsDollarAmount =>
    ({ symbol: "USD", value, sign });

  export const areEqual = (a: UsDollarAmount, b: UsDollarAmount): boolean =>
    a.value === b.value;

  export const difference = (a: UsDollarAmount, b: UsDollarAmount): Result<UsDollarAmount, string> => {
    const aVal = a.value;
    const bVal = b.value;
    const diff = UsMillicent.subtractAbs(aVal, bVal);
    const sign: Sign = aVal >= bVal ? "positive" : "negative";
    return ok({ symbol: "USD", value: diff, sign });
  };
}

export type FiatAmount = UsDollarAmount | EuroAmount | BritishPoundAmount;

export namespace FiatAmount {
  export const isEuroAmount = (amount: FiatAmount): amount is EuroAmount =>
    amount.symbol === "EUR";

  export const isBritishPoundAmount = (amount: FiatAmount): amount is BritishPoundAmount =>
    amount.symbol === "GBP";

  export const isUsDollarAmount = (amount: FiatAmount): amount is UsDollarAmount =>
    amount.symbol === "USD";

  export const areEqual = (a: FiatAmount, b: FiatAmount): boolean | "unknown" => {
    if (a.symbol !== b.symbol) return "unknown";
    // FIXME: I prefer `switch` because it checks for partiality
    // but I'm not able to avoid casting `b` :-(
    switch (a.symbol) {
      case "EUR":
        return EuroAmount.areEqual(a, b as EuroAmount);
      case "GBP":
        return BritishPoundAmount.areEqual(a, b as BritishPoundAmount);
      case "USD":
        return UsDollarAmount.areEqual(a, b as UsDollarAmount);
    }
  };

  export const difference = (a: FiatAmount, b: FiatAmount): Result<FiatAmount, string> => {
    if (a.symbol !== b.symbol) {
      return err("Cannot subtract amounts of different currencies");
    }
    switch (a.symbol) {
      case "EUR":
        return EuroAmount.difference(a, b as EuroAmount);
      case "GBP":
        return BritishPoundAmount.difference(a, b as BritishPoundAmount);
      case "USD":
        return UsDollarAmount.difference(a, b as UsDollarAmount);
    }
  };
}

export type AnyAmount = FiatAmount | CryptoAmount;
export type AnyAmountSymbol = AnyAmount["symbol"];

export namespace AnyAmount {
  export const isFiatAmount = (amount: AnyAmount): amount is FiatAmount =>
    amount.symbol === "EUR" ||
    amount.symbol === "GBP" ||
    amount.symbol === "USD";

  export const isCryptoAmount = (amount: AnyAmount): amount is CryptoAmount =>
    amount.symbol === "ADA" || amount.symbol === "BTC";

  export const areEqual = (a: AnyAmount, b: AnyAmount): boolean | "unknown" => {
    if (isCryptoAmount(a) && isCryptoAmount(b)) {
      return CryptoAmount.areEqual(a, b);
    }
    if (isFiatAmount(a) && isFiatAmount(b)) {
      return FiatAmount.areEqual(a, b);
    }
    return "unknown";
  };

  export const difference = (a: AnyAmount, b: AnyAmount): Result<AnyAmount, string> => {
    if (isCryptoAmount(a) && isCryptoAmount(b)) {
      return CryptoAmount.difference(a, b);
    }
    if (isFiatAmount(a) && isFiatAmount(b)) {
      return FiatAmount.difference(a, b);
    }
    return err("Cannot subtract amounts of different currencies");
  };
}
