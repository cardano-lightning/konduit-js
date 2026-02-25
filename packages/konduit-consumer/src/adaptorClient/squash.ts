import * as codec from "@konduit/codec";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import type { JsonCodec } from "@konduit/codec/json/codecs";
import { json2IndexCodec, type Index } from "../channel/squash";
import { json2MillisatoshiCodec, type Millisatoshi } from "../bitcoin/asset";

export type SquashProposal = {
  index: Index;
  routingFee: Millisatoshi;
};

export type SquashResponse = "Complete" | SquashProposal;

export const isCompleteSquashResponse = (resp: SquashResponse): resp is "Complete" => resp === "Complete";

export const isIncompleteSquashResponse = (resp: SquashResponse): resp is SquashProposal => !isCompleteSquashResponse(resp);

export const json2SquashResponseDeserialiser: jsonCodecs.JsonDeserialiser<SquashResponse> = (() => {
  const json2SquashProposalCodec: JsonCodec<{ index: Index; routing_fee: Millisatoshi }> =
    jsonCodecs.objectOf({
      index: json2IndexCodec,
      routing_fee: json2MillisatoshiCodec,
    });

  const json2SquashResRecordCodec =
    jsonCodecs.altJsonCodecs(
      [
        jsonCodecs.constant("Complete" as const),
        jsonCodecs.objectOf({ Incomplete: json2SquashProposalCodec }),
      ],
      (completeSer, incompleteSer) => (res) => {
        if (res === "Complete") {
          return completeSer(res);
        } else {
          return incompleteSer(res);
        }
      }
    );
  return codec.rmapDeserialiser(
    json2SquashResRecordCodec.deserialise,
    (j): SquashResponse => {
      if ("Complete" === j) {
        return j;
      } else {
        return {
          index: j.Incomplete.index,
          routingFee: j.Incomplete.routing_fee,
        };
      }
    },
  );
})();

export const json2SquashResponseCodec: JsonCodec<SquashResponse> = {
  deserialise: json2SquashResponseDeserialiser,
  serialise: (resp) => {
    if (isCompleteSquashResponse(resp)) {
      return "Complete";
    } else {
      return { Incomplete: { index: resp.index, routing_fee: resp.routingFee } };
    }
  },
};


