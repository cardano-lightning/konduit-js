import {
  Fx,
  ExchangeRate,
  euro2EuroCent,
  euroCent2EuroMillicent,
  britishPound2BritishPenny,
  britishPenny2BritishMillipenny,
  ada2Lovelace,
  usDollar2UsCent,
  usCent2UsMillicent,
  bitcoin2Satoshi,
  satoshi2Millisatoshi,
} from "../fx/core";
import { Lovelace } from "../cardano/assets";
import { Millisatoshi } from "../bitcoin/asset";
import { AdaAmount, AnyAmount, BitcoinAmount, CryptoAmount } from "./core";
import { ok, Result } from "neverthrow";
import { FiatAmount, UsDollarAmount, EuroAmount, BritishPoundAmount } from "./core";
import { EuroMillicent, BritishMillipenny, UsMillicent } from "../fx/fiat";
import { NonNegativeBigInt } from "@konduit/codec/integers/big";

export namespace AmountFx {
  export const crypto2Fiat = (
    fx: Fx,
    amount: CryptoAmount,
    targetCurrency: FiatAmount["symbol"],
  ): FiatAmount => {
    switch (amount.symbol) {
      case "ADA": {
        switch (targetCurrency) {
          case "USD": {
            // Lovelace -> Ada -> USD -> US cent -> US millicent
            const lovelace2UsMillicents = ExchangeRate.pipe(
              ExchangeRate.pipe(ExchangeRate.reverse(ada2Lovelace), fx.ada2UsDollar),
              ExchangeRate.pipe(usDollar2UsCent, usCent2UsMillicent),
            );
            const millicents = ExchangeRate.convertSafe(
              lovelace2UsMillicents,
              amount.value as Lovelace,
              (dec) => {
                const nonNegativeBigInt = NonNegativeBigInt.fromNonNegativeDecimalFloor(dec);
                return UsMillicent.fromNonNegativeBigInt(nonNegativeBigInt);
              },
            );
            return UsDollarAmount.fromUsMillicent(millicents, amount.sign);
          }

          case "EUR": {
            // Lovelace -> Ada -> Euro -> Euro cent -> Euro millicent
            const lovelace2EuroMillicents = ExchangeRate.pipe(
              ExchangeRate.pipe(ExchangeRate.reverse(ada2Lovelace), fx.ada2Euro),
              ExchangeRate.pipe(euro2EuroCent, euroCent2EuroMillicent),
            );
            const millicents = ExchangeRate.convertSafe(
              lovelace2EuroMillicents,
              amount.value as Lovelace,
              (dec) => {
                const nonNegativeBigInt = NonNegativeBigInt.fromNonNegativeDecimalFloor(dec);
                return EuroMillicent.fromNonNegativeBigInt(nonNegativeBigInt);
              },
            );
            return EuroAmount.fromEuroMillicent(millicents, amount.sign);
          }
          case "GBP": {
            // Lovelace -> Ada -> GBP -> penny -> millipenny
            const lovelace2GbpMillipennies = ExchangeRate.pipe(
              ExchangeRate.pipe(ExchangeRate.reverse(ada2Lovelace), fx.ada2BritishPound),
              ExchangeRate.pipe(
                britishPound2BritishPenny,
                britishPenny2BritishMillipenny,
              ),
            );
            const milli = ExchangeRate.convertSafe(
              lovelace2GbpMillipennies,
              amount.value as Lovelace,
              (dec) => {
                const nonNegativeBigInt = NonNegativeBigInt.fromNonNegativeDecimalFloor(dec);
                return BritishMillipenny.fromNonNegativeBigInt(nonNegativeBigInt);
              },
            );
            return BritishPoundAmount.fromBritishMillipenny(milli, amount.sign);
          }
        }
      }
      case "BTC": {
        // BTC internal representation is Millisatoshi
        switch (targetCurrency) {
          case "USD": {
            // msat -> sat -> BTC -> USD -> US cent -> US millicent
            const msat2Bitcoin = ExchangeRate.pipe(
              ExchangeRate.reverse(satoshi2Millisatoshi),
              ExchangeRate.reverse(bitcoin2Satoshi),
            );
            const bitcoin2UsMillicent = ExchangeRate.pipe(
              ExchangeRate.pipe(fx.bitcoin2UsDollar, usDollar2UsCent),
              usCent2UsMillicent,
            );
            const millicents = ExchangeRate.convertSafe(
              ExchangeRate.pipe(msat2Bitcoin, bitcoin2UsMillicent),
              amount.value as Millisatoshi,
              (dec) => {
                const nonNegativeBigInt = NonNegativeBigInt.fromNonNegativeDecimalFloor(dec);
                return UsMillicent.fromNonNegativeBigInt(nonNegativeBigInt);
              },
            );
            return UsDollarAmount.fromUsMillicent(millicents, amount.sign);
          }
          case "EUR": {
            // msat -> sat -> BTC -> EUR -> euro cent -> euro millicent
            const msat2Bitcoin = ExchangeRate.pipe(
              ExchangeRate.reverse(satoshi2Millisatoshi),
              ExchangeRate.reverse(bitcoin2Satoshi),
            );
            const bitcoin2EuroMillicent = ExchangeRate.pipe(
              ExchangeRate.pipe(fx.bitcoin2Euro, euro2EuroCent),
              euroCent2EuroMillicent,
            );
            const millicents = ExchangeRate.convertSafe(
              ExchangeRate.pipe(msat2Bitcoin, bitcoin2EuroMillicent),
              amount.value as Millisatoshi,
              (dec) => {
                const nonNegativeBigInt = NonNegativeBigInt.fromNonNegativeDecimalFloor(dec);
                return EuroMillicent.fromNonNegativeBigInt(nonNegativeBigInt);
              },
            );
            return EuroAmount.fromEuroMillicent(millicents, amount.sign);
          }
          case "GBP": {
            // msat -> sat -> BTC -> GBP -> penny -> millipenny
            const msat2Bitcoin = ExchangeRate.pipe(
              ExchangeRate.reverse(satoshi2Millisatoshi),
              ExchangeRate.reverse(bitcoin2Satoshi),
            );
            const bitcoin2GbpMilli = ExchangeRate.pipe(
              ExchangeRate.pipe(
                fx.bitcoin2BritishPound,
                britishPound2BritishPenny,
              ),
              britishPenny2BritishMillipenny,
            );
            const milli = ExchangeRate.convertSafe(
              ExchangeRate.pipe(msat2Bitcoin, bitcoin2GbpMilli),
              amount.value as Millisatoshi,
              (dec) => {
                const nonNegativeBigInt = NonNegativeBigInt.fromNonNegativeDecimalFloor(dec);
                return BritishMillipenny.fromNonNegativeBigInt(nonNegativeBigInt);
              },
            );
            return BritishPoundAmount.fromBritishMillipenny(milli, amount.sign);
          }
        }
      }
    }
  };

  export const crypto2Crypto = (
    fx: Fx,
    amount: CryptoAmount,
    targetCurrency: CryptoAmount["symbol"],
  ): Result<CryptoAmount, string> => {
    switch (amount.symbol) {
      case "ADA": {
        switch (targetCurrency) {
          case "BTC":
            return Fx.lovelace2Msat(fx, amount.value).map(msat =>
              BitcoinAmount.fromMillisatoshi(msat, amount.sign)
            );
          case "ADA": return ok(amount);
        }
      }

      case "BTC": {
        switch (targetCurrency) {
          case "ADA":
            return Fx.msat2Lovelace(fx, amount.value).map(lovelace =>
              AdaAmount.fromLovelace(lovelace, amount.sign)
            );
          case "BTC": return ok(amount);
        }
      }
    }
  };
  export const crypto2Any = (
    fx: Fx,
    amount: CryptoAmount,
    targetCurrency: CryptoAmount["symbol"] | FiatAmount["symbol"],
  ): Result<AnyAmount, string> => {
    if(targetCurrency === "ADA" || targetCurrency === "BTC") {
      return crypto2Crypto(fx, amount, targetCurrency);
    } else {
      return ok(crypto2Fiat(fx, amount, targetCurrency));
    }
  }
}
