import type { Tagged } from "type-fest";
import type { Result } from "neverthrow";
import { ok } from "neverthrow";
import { AdaptorInfo, json2AdaptorInfoCodec } from "./adaptorClient/adaptorInfo";
import { HttpEndpointError, mkGetEndpoint, mkPostEndpoint } from "./http";
import { hexString2KeyTagCodec, KeyTag, type ChannelTag } from "./channel/core";
import type { Squash } from "./channel/squash";
import { cbor2SquashCodec } from "./channel/squash";
import { ConsumerVKey } from "./channel/l1Channel";

export { AdaptorInfo } from "./adaptorClient/adaptorInfo";

export type AdaptorUrl = Tagged<string, "AdaptorUrl">;

const mkInfoEndpoint = (baseUrl: AdaptorUrl) =>
  mkGetEndpoint(`${baseUrl}/info`, { type: "json", deserialiser: json2AdaptorInfoCodec.deserialise });

export type AdaptorFullInfo = Tagged<[AdaptorUrl, AdaptorInfo], "AdaptorFullInfo">;
export namespace AdaptorFullInfo {
  export const fromString = async (url: string): Promise<Result<AdaptorFullInfo, HttpEndpointError>> => {
    const normalisedUrl = url.endsWith("/") ? (url.slice(0, -1) as AdaptorUrl) : (url as AdaptorUrl);
    const infoEndpoint = mkInfoEndpoint(normalisedUrl);
    const possibleAdaptorInfo = await infoEndpoint();
    return possibleAdaptorInfo.map((adaptorInfo) => [normalisedUrl, adaptorInfo] as AdaptorFullInfo);
  };
}

export const mkAdaptorClient = (baseUrl: AdaptorUrl) => {
  const chSquashEndpoint = mkPostEndpoint(
    `${baseUrl}/ch/squash`,
    { type: "cbor", serialiser: cbor2SquashCodec.serialise },
    { type: "json", deserialiser: (json) => ok(json) },
  );
  return {
    info: mkInfoEndpoint(baseUrl),
    chSquash: (keyTag: KeyTag, squash: Squash) => chSquashEndpoint(squash, [["KONDUIT", hexString2KeyTagCodec.serialise(keyTag)]])
  };
}

// Make client version scoped to a specific channel.
export const mkAdaptorChannelClient = (adaptorUrl: AdaptorUrl, consumerVKey: ConsumerVKey, channelTag: ChannelTag) => {
  const keyTag = KeyTag.fromKeyAndTag(consumerVKey, channelTag);
  const keyTagHex = hexString2KeyTagCodec.serialise(keyTag);
  const adaptorClient = mkAdaptorClient(adaptorUrl);
  return {
    chSquash: (squash: Squash) => adaptorClient.chSquash(keyTag, squash),
    info: () => adaptorClient.info(),
    keyTagHex,
  }
}
