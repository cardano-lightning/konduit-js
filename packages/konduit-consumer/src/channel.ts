import type { Result } from "neverthrow";
import { ok, err } from "neverthrow";
import type { JsonCodec, JsonError } from "@konduit/codec/json/codecs";
import { json2AdaptorUrlCodec, mkAdaptorChannelClient } from "./adaptorClient";
import type { AdaptorUrl, SquashResponse } from "./adaptorClient";
import * as codec from "@konduit/codec";
import { json2L1ChannelCodec, L1Channel } from "./channel/l1Channel";
import type { ConsumerEd25519VerificationKey, OpenTx } from "./channel/l1Channel";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { Cheque, json2ChequeCodec, json2SquashCodec, Squash, SquashBody } from "./channel/squash";
import { Ed25519SigningKey } from "@konduit/cardano-keys";
import type { HttpEndpointError } from "./http";
import { mkJson2PollingInfoCodec, PollingInfo } from "./polling";
import { json2SquashResponseCodec } from "./adaptorClient/squash";

export * from "./channel/l1Channel";
export * from "./channel/core";

export type SquashingInfo = PollingInfo<{ squash: Squash; response: SquashResponse }>;
export const SquashingInfo = PollingInfo;

export const json2SquashingInfoCodec: JsonCodec<SquashingInfo> = mkJson2PollingInfoCodec(jsonCodecs.objectOf({
  squash: json2SquashCodec,
  response: json2SquashResponseCodec,
}));

export class Channel {
  public readonly l1: L1Channel;
  public readonly adaptorUrl: AdaptorUrl;

  public readonly squashes: Squash[];
  public squashingInfo: PollingInfo<{ squash: Squash; response: SquashResponse }>;
  public readonly cheques: Cheque[];

  private constructor(l1: L1Channel, cheques: Cheque[], squashes: Squash[], adaptorUrl: AdaptorUrl, squashingInfo?: PollingInfo<{ squash: Squash; response: SquashResponse }>) {
    this.l1 = l1;
    this.cheques = cheques;
    this.adaptorUrl = adaptorUrl;
    this.squashes = squashes;
    this.squashingInfo = squashingInfo || new PollingInfo(null);
  }

  public static load(l1: L1Channel, cheques: Cheque[], squashes: Squash[], adaptorUrl: AdaptorUrl, squashingInfo: PollingInfo<{ squash: Squash; response: SquashResponse }>): Result<Channel, JsonError> {
    let vKey = l1.consumerVerificationKey;
    for(const cheque of cheques) {
      if(!Cheque.verifySignature(cheque, vKey))
        return err(`Cheque with index ${cheque.body.index} failed verification with consumer verification key ${vKey}`);
    }
    // TODO: validate squashes signatures as well
    return ok(new Channel(l1, cheques, squashes, adaptorUrl, squashingInfo));
  }

  public static open(openTx: OpenTx, adaptorUrl: AdaptorUrl): Channel {
    const l1Channel = L1Channel.open(openTx);
    return new Channel(l1Channel, [], [], adaptorUrl);
  }

  get channelTag() { return this.l1.channelTag; }

  get consumerVerificationKey(): ConsumerEd25519VerificationKey { return this.l1.consumerVerificationKey; }

  public get adaptorClient() {
    return mkAdaptorChannelClient(
      this.adaptorUrl,
      this.l1.consumerVerificationKey,
      this.l1.channelTag
    );
  }

  public mkSquash() {
    // TODO: This is obviously just a stub.
    return SquashBody.empty;
  }

  public async doSquash(sKey: Ed25519SigningKey): Promise<null | Result<SquashResponse , HttpEndpointError>> {
    if(this.isFullySquashed) return null;
    const squash = Squash.fromBodySigning(sKey, this.channelTag, this.mkSquash());
    const result = await this.adaptorClient.chSquash(squash);
    result.match(
      (response) => {
        this.squashes.push(squash);
        this.squashingInfo = SquashingInfo.mkNew(ok({ squash, response }));
      },
      (_error) => {
        this.squashingInfo = SquashingInfo.mkNew(err("Failed to submit squash"));
      }
    );
    return result;
  }

  public get isOperational() {
    // Non empty squashes means that the channel was synchronised
    // with the adaptor.
    return this.l1.openTx != null && this.squashes.length !== 0;
  }

  public get lastSquash() {
    if(this.squashes.length === 0) return null;
    return this.squashes[this.squashes.length - 1];
  }

  public get isFullySquashed() {
    return this.lastSquash?.body.amount === this.mkSquash().amount;
  }

  get isAwaitingAdaptorApproval(): boolean {
    return !this.l1.openTx.adaptorApproved;
  }
}

export const json2ChannelCodec: JsonCodec<Channel> = codec.pipe(
  jsonCodecs.objectOf({
    adaptor_url: json2AdaptorUrlCodec,
    cheques: jsonCodecs.arrayOf(json2ChequeCodec),
    l1_channel: json2L1ChannelCodec,
    squashes: jsonCodecs.arrayOf(json2SquashCodec),
    squashing_info: json2SquashingInfoCodec,
  }), {
    deserialise: (r) => Channel.load(r.l1_channel, r.cheques, r.squashes, r.adaptor_url, r.squashing_info),
    serialise: (channel: Channel) => ({
        adaptor_url: channel.adaptorUrl,
        cheques: channel.cheques,
        l1_channel: channel.l1,
        squashes: channel.squashes,
        squashing_info: channel.squashingInfo,
    })
  }
);
