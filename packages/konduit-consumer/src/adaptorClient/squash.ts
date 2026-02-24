import * as codec from "@konduit/codec";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import type { JsonCodec } from "@konduit/codec/json/codecs";
import { json2SquashBodyCodec, json2SquashCodec, mkJson2VerifiedUnlockedCodec, VerifiedSquash, VerifiedUnlockedCheque, type SquashBody } from "../channel/squash";
import type { ChannelTag, ConsumerEd25519VerificationKey } from "../channel";

export type SquashProposal = {
  proposal: SquashBody;
  current: VerifiedSquash;
  unlockeds: VerifiedUnlockedCheque[];
};

export type SquashResponse = "Complete" | SquashProposal;

export const isCompleteSquashResponse = (resp: SquashResponse): resp is "Complete" => resp === "Complete";

export const isIncompleteSquashResponse = (resp: SquashResponse): resp is SquashProposal => !isCompleteSquashResponse(resp);

export const mkJson2SquashProposalCodec = (tag: ChannelTag, vKey: ConsumerEd25519VerificationKey): JsonCodec<SquashProposal> => {
  const dataCodec = jsonCodecs.objectOf({
    proposal: json2SquashBodyCodec,
    current: json2SquashCodec,
    unlockeds: jsonCodecs.arrayOf(mkJson2VerifiedUnlockedCodec(tag, vKey)),
  });
  return codec.pipe(
    dataCodec, {
      deserialise: (res) => VerifiedSquash.fromVerification(tag, vKey, res.current).map((current) => {
        return {
          proposal: res.proposal,
          current,
          unlockeds: res.unlockeds,
        };
      }),
      serialise: (res) => {
        return {
          proposal: res.proposal,
          current: res.current.squash,
          unlockeds: res.unlockeds,
        };
      }
    }
  );
};

export const mkJson2SquashResponseCodec = (tag: ChannelTag, vKey: ConsumerEd25519VerificationKey):jsonCodecs.JsonCodec<SquashResponse> => {
  const json2SquashResRecordCodec =
    jsonCodecs.altJsonCodecs(
      [
        jsonCodecs.constant("Complete" as const),
        jsonCodecs.objectOf({ Incomplete: mkJson2SquashProposalCodec(tag, vKey) }),
      ],
      (completeSer, incompleteSer) => (res: "Complete" | { Incomplete: SquashProposal }) => {
        if (res === "Complete") {
          return completeSer(res);
        }
        return incompleteSer(res);
      }
    );
  return codec.rmap(
    json2SquashResRecordCodec,
    (j: "Complete" | { Incomplete: SquashProposal }): SquashResponse => {
      if (j === "Complete") {
        return "Complete";
      }
      return j.Incomplete;
    },
    (resp: SquashResponse): { Incomplete: SquashProposal } | "Complete" => {
      if (isCompleteSquashResponse(resp)) {
        return "Complete";
      }
      return { Incomplete: resp };
    }
  );
};

