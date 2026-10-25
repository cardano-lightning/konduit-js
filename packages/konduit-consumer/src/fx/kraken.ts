import * as codec from "@konduit/codec";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import type { JsonCodec } from "@konduit/codec/json/codecs";
import { NonNegativeInt } from "@konduit/codec/integers/smallish";
import { NonNegativeBigInt } from "@konduit/codec/integers/big";
import { Result, err, ok } from "neverthrow";
import {
  mkGetStaticEndpoint,
  ResponseDeserialiser,
  type HttpEndpointError,
} from "../http";
import { ValidDate } from "../time/absolute";
import {
  type CurrencyUnit,
  type Fx,
  ExchangeRate,
} from "./core";
import { NonNegativeDecimal, PositiveDecimal } from "@konduit/codec/decimals";
import { unwrapOrPanic } from "../neverthrow";

export type AdaPairTicker =
  | "ADAAUD"
  | "ADAEUR"
  | "ADAGBP"
  | "ADAUSD";

export type BtcPairTicker =
  | "XBTCHF"
  | "XXBTZEUR"
  | "XXBTZGBP"
  | "XXBTZJPY"
  | "XXBTZUSD";

export type BridgePairTicker =
  | "EURCHF"
  | "ZUSDZJPY";

export type KrakenPairTicker = AdaPairTicker | BtcPairTicker | BridgePairTicker;

export const mkNullFallbackCodec = <T>(codec: JsonCodec<T>): JsonCodec<T | null> => {
  return {
    deserialise: (json) => {
      return codec.deserialise(json).orElse(() => ok(null)) as Result<T | null, jsonCodecs.JsonError>
    },
    serialise: (v) => {
      if(v == null) return null;
      return codec.serialise(v);
    }
  }
}

const json2PositiveDecimalOrNullFallback = mkNullFallbackCodec(PositiveDecimal.jsonCodec);

// `null` were introduced to non critical
// properties which can from time to time
// be empty.
export type KrakenTicker = {
  ask: {
    price: PositiveDecimal;
    wholeLotVolume: NonNegativeBigInt;
    lotVolume: PositiveDecimal;
  };
  bid: {
    price: PositiveDecimal;
    wholeLotVolume: NonNegativeBigInt;
    lotVolume: PositiveDecimal;
  };
  high: {
    today: PositiveDecimal | null;
    last24h: PositiveDecimal | null;
  };
  lastTradeClosed: {
    price: PositiveDecimal;
    lotVolume: PositiveDecimal;
  };
  low: {
    today: PositiveDecimal | null;
    last24h: PositiveDecimal | null;
  };
  open: PositiveDecimal;
  priceVolumeWeightedAverage: {
    today: PositiveDecimal | null;
    last24h: PositiveDecimal | null;
  };
  trades: {
    today: NonNegativeInt;
    last24h: NonNegativeInt;
  };
  volume: {
    today: NonNegativeDecimal,
    last24h: NonNegativeDecimal
  };
};

// Asset Ticker Info
// a string[]
// Ask [<price>, <whole lot volume>, <lot volume>]
//
// b string[]
// Bid [<price>, <whole lot volume>, <lot volume>]
//
// c string[]
// Last trade closed [<price>, <lot volume>]
//
// v string[]
// Volume [<today>, <last 24 hours>]
//
// p string[]
// Volume weighted average price [<today>, <last 24 hours>]
//
// t integer[]
// Number of trades [<today>, <last 24 hours>]
//
// l string[]
// Low [<today>, <last 24 hours>]
//
// h string[]
// High [<today>, <last 24 hours>]
//
// o
// string
// Today's opening price
//
// Example:
// $ curl 'https://api.kraken.com/0/public/Ticker?pair=ADAAUD'
// {"error":[],"result":{"ADAAUD":{"a":["0.368020","3280","3280.000"],"b":["0.363440","6082","6082.000"],"c":["0.368570","366.88193500"],"v":["100953.04067299","116364.74662461"],"p":["0.359870","0.359622"],"t":[26,49],"l":["0.357300","0.353930"],"h":["0.368570","0.368570"],"o":"0.357310"}}}

export namespace KrakenTicker {
  export const jsonCodec: JsonCodec<KrakenTicker> = codec.rmap(
    jsonCodecs.objectOf({
      a: jsonCodecs.tupleOf(
        PositiveDecimal.jsonCodec,
        NonNegativeBigInt.jsonThroughStringCodec,
        PositiveDecimal.jsonCodec,
      ),
      b: jsonCodecs.tupleOf(
        PositiveDecimal.jsonCodec,
        NonNegativeBigInt.jsonThroughStringCodec,
        PositiveDecimal.jsonCodec,
      ),
      h: jsonCodecs.tupleOf(
        json2PositiveDecimalOrNullFallback,
        json2PositiveDecimalOrNullFallback,
      ),
      // last trade closed
      c: jsonCodecs.tupleOf(
        PositiveDecimal.jsonCodec,
        PositiveDecimal.jsonCodec,
      ),
      l: jsonCodecs.tupleOf(
        json2PositiveDecimalOrNullFallback,
        json2PositiveDecimalOrNullFallback
      ),
      o: PositiveDecimal.jsonCodec,
      p: jsonCodecs.tupleOf(
        json2PositiveDecimalOrNullFallback,
        json2PositiveDecimalOrNullFallback
      ),
      t: jsonCodecs.tupleOf(
        NonNegativeInt.jsonCodec,
        NonNegativeInt.jsonCodec,
      ),
      v: jsonCodecs.tupleOf(
        NonNegativeDecimal.jsonCodec,
        NonNegativeDecimal.jsonCodec,
      ),
    }),
    (raw) => {
      const [aPrice, aWholeLot, aLot] = raw.a;
      const [bPrice, bWholeLot, bLot] = raw.b;
      const [cPrice, cLot] = raw.c;
      const [vToday, v24h] = raw.v;
      const [pToday, p24h] = raw.p;
      const [tToday, t24h] = raw.t;
      const [lToday, l24h] = raw.l;
      const [hToday, h24h] = raw.h;

      return {
        ask: {
          price: aPrice,
          wholeLotVolume: aWholeLot,
          lotVolume: aLot,
        },
        bid: {
          price: bPrice,
          wholeLotVolume: bWholeLot,
          lotVolume: bLot,
        },
        lastTradeClosed: {
          price: cPrice,
          lotVolume: cLot,
        },
        volume: {
          today: vToday,
          last24h: v24h,
        },
        priceVolumeWeightedAverage: {
          today: pToday,
          last24h: p24h,
        },
        trades: {
          today: tToday,
          last24h: t24h,
        },
        low: {
          today: lToday,
          last24h: l24h,
        },
        high: {
          today: hToday,
          last24h: h24h,
        },
        open: raw.o,
      };
    },
    (t) => ({
      a: [
        t.ask.price,
        t.ask.wholeLotVolume,
        t.ask.lotVolume,
      ] as [PositiveDecimal, NonNegativeBigInt, PositiveDecimal],
      b: [
        t.bid.price,
        t.bid.wholeLotVolume,
        t.bid.lotVolume,
      ] as [PositiveDecimal, NonNegativeBigInt, PositiveDecimal],
      h: [
        t.high.today,
        t.high.last24h,
      ] as [PositiveDecimal | null, PositiveDecimal | null],
      c: [
        t.lastTradeClosed.price,
        t.lastTradeClosed.lotVolume,
      ] as [PositiveDecimal, PositiveDecimal],
      l: [
        t.low.today,
        t.low.last24h,
      ] as [PositiveDecimal | null, PositiveDecimal | null],
      o: t.open,
      p: [
        t.priceVolumeWeightedAverage.today,
        t.priceVolumeWeightedAverage.last24h,
      ] as [PositiveDecimal | null, PositiveDecimal | null],
      t: [
        t.trades.today,
        t.trades.last24h,
      ] as [NonNegativeInt, NonNegativeInt],
      v: [
        t.volume.today,
        t.volume.last24h,
      ] as [NonNegativeDecimal, NonNegativeDecimal]
    }),
  );
}

export type KrakenTickersResponse = Record<KrakenPairTicker, KrakenTicker>;
export namespace KrakenTickersResponse {
  export const jsonCodec: JsonCodec<KrakenTickersResponse> = jsonCodecs.objectOf({
    ADAAUD: KrakenTicker.jsonCodec,
    ADAEUR: KrakenTicker.jsonCodec,
    ADAGBP: KrakenTicker.jsonCodec,
    ADAUSD: KrakenTicker.jsonCodec,
    EURCHF: KrakenTicker.jsonCodec,
    XBTCHF: KrakenTicker.jsonCodec,
    XXBTZEUR: KrakenTicker.jsonCodec,
    XXBTZGBP: KrakenTicker.jsonCodec,
    XXBTZJPY: KrakenTicker.jsonCodec,
    XXBTZUSD: KrakenTicker.jsonCodec,
    ZUSDZJPY: KrakenTicker.jsonCodec,
  })
}
export type KrakenTickersResponseRecord = {
  readonly error: string[];
  readonly result: Record<KrakenPairTicker, KrakenTicker>;
};
export namespace KrakenTickersResponseRecord {
  export const jsonCodec: JsonCodec<KrakenTickersResponseRecord> = jsonCodecs.objectOf({
    error: jsonCodecs.arrayOf(jsonCodecs.json2StringCodec),
    result: KrakenTickersResponse.jsonCodec,
  });
}

export type TickerError =
  | HttpEndpointError
  | { readonly type: "ApiError"; readonly error: string[] }

export type KrakenClient = {
  readonly baseUrl: string;
  getTicker: (pair: KrakenPairTicker) => Promise<Result<KrakenTicker, TickerError>>;
  getTickers: () => Promise<Result<KrakenTickersResponse, TickerError>>;
};

export const mkKrakenClient = (baseUrl: string = "https://api.kraken.com"): KrakenClient => {
  const normalisedBase = baseUrl.replace(/\/+$/, "");

  const getTicker = async (pair: KrakenPairTicker): Promise<Result<KrakenTicker, TickerError>> => {
    const endpoint = mkGetStaticEndpoint(
      normalisedBase,
      `/0/public/Ticker?pair=${encodeURIComponent(pair)}`,
      ResponseDeserialiser.fromJsonDeserialiser(jsonCodecs.objectOf({
        error: jsonCodecs.arrayOf(jsonCodecs.json2StringCodec),
        result: jsonCodecs.dictOf(KrakenTicker.jsonCodec)
      }).deserialise),
    );
    return (await endpoint()).match(
      (resp) =>  {
        if(resp.error.length > 0) return err({ type: "ApiError", error: resp.error });
        const ticker = resp.result[pair] ?? null;
        if (!ticker)
          return err({ type: "ApiError", error: [`Ticker data for pair ${pair} is missing in response`] });
        return ok(ticker);
      },
      (error) => err(error)
    );
  };

  const getTickers = async (): Promise<Result<KrakenTickersResponse, TickerError>> => {
    const endpoint = mkGetStaticEndpoint(
      normalisedBase,
      `/0/public/Ticker`,
      ResponseDeserialiser.fromJsonDeserialiser(KrakenTickersResponseRecord.jsonCodec.deserialise),
    );
    return (await endpoint()).match(
      (resp) =>  {
        if(resp.error.length > 0) return err({ type: "ApiError", error: resp.error });
        return ok(resp.result);
      },
      (error) => err(error)
    );
  };

  return {
    baseUrl: normalisedBase,
    getTicker,
    getTickers,
  };
};

// "mid-price": (ask + bid) / 2
export type PriceDerivationStrategy = "last-trade-closed" | "mid-price";

export const mkKrakenFxFromTickers = (
  tickers: KrakenTickersResponse,
  strategy: PriceDerivationStrategy = "mid-price",
): Fx => {
  const now = ValidDate.now();

  const mkExchangeRateFromTickerPrice = <U1 extends CurrencyUnit, U2 extends CurrencyUnit>(
    price: PositiveDecimal,
  ): ExchangeRate<U1, U2> =>
    ExchangeRate.fromPositiveDecimal(price) as ExchangeRate<U1, U2>;


  const getPrice = (ticker: KrakenTicker): PositiveDecimal => {
    if (strategy === "last-trade-closed") {
      return ticker.lastTradeClosed.price;
    }
    return unwrapOrPanic(
      PositiveDecimal.divide(
        PositiveDecimal.add(ticker.ask.price, ticker.bid.price),
        PositiveDecimal.fromDigits(2),
      ),
      `Kraken mid-price calculation failed!`
    );
  };

  const ada2UsdPrice = getPrice(tickers.ADAUSD);
  const ada2GbpPrice = getPrice(tickers.ADAGBP);
  const ada2EurPrice = getPrice(tickers.ADAEUR);

  const btc2UsdPrice = getPrice(tickers.XXBTZUSD);
  const btc2GbpPrice = getPrice(tickers.XXBTZGBP);
  const btc2EurPrice = getPrice(tickers.XXBTZEUR);

  return {
    createdAt: now,
    ada2UsDollar: mkExchangeRateFromTickerPrice(ada2UsdPrice),
    ada2BritishPound: mkExchangeRateFromTickerPrice(ada2GbpPrice),
    ada2Euro: mkExchangeRateFromTickerPrice(ada2EurPrice),
    bitcoin2UsDollar: mkExchangeRateFromTickerPrice(btc2UsdPrice),
    bitcoin2BritishPound: mkExchangeRateFromTickerPrice(btc2GbpPrice),
    bitcoin2Euro: mkExchangeRateFromTickerPrice(btc2EurPrice),
  };
};

export const mkKrakenFx = async (
  strategy: PriceDerivationStrategy = "mid-price",
  baseUrl: string = "https://api.kraken.com",
): Promise<Result<Fx, TickerError>> => {
  const client = mkKrakenClient(baseUrl);
  const tickersResult = await client.getTickers();
  return tickersResult.map((tickers) => mkKrakenFxFromTickers(tickers, strategy));
}

