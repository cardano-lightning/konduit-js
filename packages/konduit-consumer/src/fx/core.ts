import * as codec from "@konduit/codec";
import { Decimal } from "decimal.js";
import { Result } from "neverthrow";
import { NonNegativeDecimal, PositiveDecimal } from "@konduit/codec/decimals";
import { ValidDate } from "../time/absolute";
import {
  Euro,
  EuroCent,
  EuroMillicent,
  UsDollar,
  UsCent,
  UsMillicent,
  BritishPenny,
  BritishMillipenny,
  BritishPound,
  type FiatCurrencyUnit,
} from "./fiat";
import { Lovelace, type Ada } from "../cardano/assets";
import { Millisatoshi, type Satoshi, type Bitcoin } from "../bitcoin/asset";
import type { Tagged } from "type-fest";
import { unwrapOrPanic } from "../neverthrow";

export type BTCUnit = Bitcoin | Millisatoshi | Satoshi;
export type ADAUnit = Ada | Lovelace;

type CryptoCurrencyUnit = ADAUnit | BTCUnit;

// WARNING! Exchange rate relies on the assumption that the unit internally
// contains non-negative value which can be used to construct the Decimal
// directly.
// TS checks the second part of the above assumption but not the first one.
// And we do not want to overcomplicate the typing here.
export type CurrencyUnit = FiatCurrencyUnit | CryptoCurrencyUnit;

export type ExchangeRateBody = { numerator: PositiveDecimal; denominator: PositiveDecimal };
export type ExchangeRate<U1 extends CurrencyUnit, U2 extends CurrencyUnit> = Tagged<
  ExchangeRateBody,
  "ExchangeRate",
  { unit1: U1; unit2: U2 }
>;

export namespace ExchangeRate {
  export const cast = <U1 extends CurrencyUnit, U2 extends CurrencyUnit>(body: ExchangeRateBody): ExchangeRate<U1, U2> => body as any as ExchangeRate<U1, U2>;
  export const fromPositiveDecimal = <U1 extends CurrencyUnit, U2 extends CurrencyUnit>(
    decimal: PositiveDecimal,
  ): ExchangeRate<U1, U2> => {
    return  cast<U1, U2>({ numerator: decimal, denominator: PositiveDecimal.one });
  }
  export const jsonCodec = codec.rmap(
    PositiveDecimal.jsonCodec,
    p => fromPositiveDecimal(p),
    er => er.numerator.div(er.denominator) as PositiveDecimal
  )
  export const reverse = <U1 extends CurrencyUnit, U2 extends CurrencyUnit>(
    rate: ExchangeRate<U1, U2>,
  ): ExchangeRate<U2, U1> => {
    return cast<U2, U1>({ numerator: rate.denominator, denominator: rate.numerator, });
  }
  export const pipe = <
    U1 extends CurrencyUnit,
    U2 extends CurrencyUnit,
    U3 extends CurrencyUnit,
  >(
    price1: ExchangeRate<U1, U2>,
    price2: ExchangeRate<U2, U3>,
  ) => {
    const numerator: Decimal = price1.numerator.mul(price2.numerator);
    const denominator: Decimal = price1.denominator.mul(price2.denominator);
    return ExchangeRate.cast<U1, U3>({
      numerator: numerator as PositiveDecimal,
      denominator: denominator as PositiveDecimal
    });
  }
  export const convert2Any = <
    U1 extends CurrencyUnit,
    U2 extends CurrencyUnit,
    T,
  >(
    rate: ExchangeRate<U1, U2>,
    amount: U1,
    constructor: (value: NonNegativeDecimal) => T,
  ): T => {
    const result = Decimal(amount).mul(rate.numerator).div(rate.denominator) as NonNegativeDecimal;
    return constructor(result);
  }
  // WARNING! `CurrencyUnit` fullfils a "non-negative" base for `Decimal` invariant.
  export const convert = <
    U1 extends CurrencyUnit,
    U2 extends CurrencyUnit,
  >(
    rate: ExchangeRate<U1, U2>,
    amount: U1,
    constructor: (value: NonNegativeDecimal) => Result<U2, string>,
  ): Result<U2, string> => convert2Any(rate, amount, constructor);
  // A version of `convert` where the provided constructor is expected to never fail.
  export const convertSafe = <
    U1 extends CurrencyUnit,
    U2 extends CurrencyUnit,
  >(
    rate: ExchangeRate<U1, U2>,
    amount: U1,
    constructor: (value: NonNegativeDecimal) => U2,
  ): U2 => convert2Any(rate, amount, constructor);
}
const hundred = PositiveDecimal.fromDigits(1, 0, 0);
const tousand = PositiveDecimal.fromDigits(1, 0, 0, 0);
const million = PositiveDecimal.multiply(tousand, tousand);
export const usDollar2UsCent = ExchangeRate.fromPositiveDecimal<UsDollar, UsCent>(hundred);
export const usCent2UsMillicent = ExchangeRate.fromPositiveDecimal<UsCent, UsMillicent>(tousand);
export const euro2EuroCent = ExchangeRate.fromPositiveDecimal<Euro, EuroCent>(hundred);
export const euroCent2EuroMillicent = ExchangeRate.fromPositiveDecimal<EuroCent, EuroMillicent>(tousand);
export const britishPound2BritishPenny = ExchangeRate.fromPositiveDecimal<BritishPound, BritishPenny>(hundred);
export const britishPenny2BritishMillipenny = ExchangeRate.fromPositiveDecimal<BritishPenny, BritishMillipenny>(tousand);
export const bitcoin2Satoshi = ExchangeRate.fromPositiveDecimal<Bitcoin, Satoshi>(
  PositiveDecimal.multiply(hundred, million)
);
export const satoshi2Millisatoshi = ExchangeRate.fromPositiveDecimal<Satoshi, Millisatoshi>(tousand);
export const ada2Lovelace = ExchangeRate.fromPositiveDecimal<Ada, Lovelace>(million);

export type Fx = {
  createdAt: ValidDate;

  ada2UsDollar: ExchangeRate<Ada, UsDollar>;
  ada2BritishPound: ExchangeRate<Ada, BritishPound>;
  ada2Euro: ExchangeRate<Ada, Euro>;

  bitcoin2UsDollar: ExchangeRate<Bitcoin, UsDollar>;
  bitcoin2BritishPound: ExchangeRate<Bitcoin, BritishPound>;
  bitcoin2Euro: ExchangeRate<Bitcoin, Euro>;
};

export namespace Fx {
  const mkMsat2LovelaceExchangeRate = (fx: Fx): ExchangeRate<Millisatoshi, Lovelace> => {
    const bitcoin2Ada: ExchangeRate<Bitcoin, Ada> = ExchangeRate.reverse(ExchangeRate.pipe(fx.ada2UsDollar, ExchangeRate.reverse(fx.bitcoin2UsDollar)));
    const millisatoshi2Bitcoin =
      ExchangeRate.pipe(
        ExchangeRate.reverse(satoshi2Millisatoshi),
        ExchangeRate.reverse(bitcoin2Satoshi),
      )
    return ExchangeRate.pipe(millisatoshi2Bitcoin, ExchangeRate.pipe(bitcoin2Ada, ada2Lovelace));
  }
  export const msat2Lovelace = (fx: Fx, amountMsat: Millisatoshi): Result<Lovelace, string> => {
    const msat2Lovelace = mkMsat2LovelaceExchangeRate(fx);
    return ExchangeRate.convert(msat2Lovelace, amountMsat, (d) => Lovelace.fromBigInt(BigInt(d.trunc().toString())));
  }
  export const lovelace2Msat = (fx: Fx, amountLovelace: Lovelace): Result<Millisatoshi, string> => {
    const lovelace2Msat = ExchangeRate.reverse(mkMsat2LovelaceExchangeRate(fx));
    return ExchangeRate.convert(lovelace2Msat, amountLovelace, (d) => Millisatoshi.fromBigInt(BigInt(d.trunc().toString())));
  }
  export const lovelace2UsMillicent = (fx: Fx, lovelace: Lovelace): UsMillicent => {
    const lovelace2UsMillicent = ExchangeRate.pipe(
      ExchangeRate.pipe(ExchangeRate.reverse(ada2Lovelace), fx.ada2UsDollar),
      ExchangeRate.pipe(usDollar2UsCent, usCent2UsMillicent)
    );
    // FIXME: This unarapping not 100% correct as we don't have invariant PositiveDecimal invariant in place...
    return unwrapOrPanic(
      ExchangeRate.convert(lovelace2UsMillicent, lovelace, (d) =>
        UsMillicent.fromBigInt(BigInt(d.trunc().toString())),
      ),
      `Failed to convert Lovelace to UsMillicent`
    )
  }
}
