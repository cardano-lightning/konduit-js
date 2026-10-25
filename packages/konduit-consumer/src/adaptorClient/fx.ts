import { Decimal } from "decimal.js";
import * as codec from "@konduit/codec";
import type { Result } from "neverthrow";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import type { JsonCodec } from "@konduit/codec/json/codecs";
import { POSIXMilliseconds } from "../time/absolute";
import { Millisatoshi } from "../bitcoin";
import { Lovelace } from "../cardano";

// This is fx info exposed by the adaptor. It is not complient with our Fx API.
export type AdaptorFx = {
  createdAt: POSIXMilliseconds;
  base: "eur" | "usd";
  ada: Decimal;
  bitcoin: Decimal;
};

export namespace AdaptorFx {
  export const msatToLovelace = (fx: AdaptorFx, amountMsat: Millisatoshi): Result<Lovelace, string> => {
    const dividend =  fx.bitcoin.mul(amountMsat);
    const divisor = fx.ada.mul(100_000);
    const lovelace = BigInt(dividend.div(divisor).trunc().toString());
    return Lovelace.fromBigInt(lovelace);
  };

  export const lovelaceToMsat = (fx: AdaptorFx, amountLovelace: Lovelace): Result<Millisatoshi, string> => {
    const dividend = fx.ada.mul(amountLovelace).mul(100_000);
    const msat = BigInt(dividend.div(fx.bitcoin).trunc().toString());
    return Millisatoshi.fromBigInt(msat);
  };

  export const jsonCodec: JsonCodec<AdaptorFx> = codec.rmap(
    jsonCodecs.objectOf({
      created_at: POSIXMilliseconds.jsonCodec,
      base: jsonCodecs.altJsonCodecs(
        [jsonCodecs.constant("usd" as const), jsonCodecs.constant("eur" as const)],
        (adaSer, btcSer) => (b: "usd" | "eur") => (b === "usd" ? adaSer("usd") : btcSer("eur")),
      ),
      ada: jsonCodecs.json2NumberCodec,
      bitcoin: jsonCodecs.json2NumberCodec,
    }),
    (obj) => ({
      createdAt: obj.created_at,
      base: obj.base,
      ada: new Decimal(obj.ada),
      bitcoin: new Decimal(obj.bitcoin),
    }),
    (fx) => ({
      created_at: fx.createdAt,
      base: fx.base,
      ada: fx.ada.toNumber(),
      bitcoin: fx.bitcoin.toNumber(),
    })
  );
}

