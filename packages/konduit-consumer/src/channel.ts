import { JsonCodec } from "@konduit/codec/json/codecs";
import { AdaptorUrl, json2AdaptorUrlCodec, mkAdaptorChannelClient } from "./adaptorClient";
import * as codec from "@konduit/codec";
import { json2L1ChannelCodec, L1Channel, OpenTx } from "./channel/l1Channel";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { Squash, SquashBody } from "./channel/squash";

export * from "./channel/l1Channel";
export * from "./channel/core";

export class Channel {
  public readonly l1: L1Channel;
  public readonly adaptorUrl: AdaptorUrl;

  constructor(l1: L1Channel, adaptorUrl: AdaptorUrl) {
    this.l1 = l1;
    this.adaptorUrl = adaptorUrl;
  }

  public static create(openTx: OpenTx, adaptorUrl: AdaptorUrl): Channel {
    const l1Channel = L1Channel.create(openTx);
    return new Channel(l1Channel, adaptorUrl);
  }

  private get adaptorClient() { return mkAdaptorChannelClient(this.adaptorUrl, this.l1.consumerVerificationKey, this.l1.channelTag); }

  // FIXME: We are introducing more and more realism
  // into the channel management. The current phase
  // is to at least sync the opened state.
  // squash() {
  //   this.adaptorClient.chSquash(SquashBody.empty)

  get isAwaitingAdaptorApproval(): boolean {
    return !this.l1.openTx.adaptorApproved;
  }

  get isOperational(): boolean {
    return !this.l1.isClosed && this.l1.openTx.adaptorApproved;
  }

  get channelTag() { return this.l1.channelTag; }
}

export const json2ChannelCodec: JsonCodec<Channel> = codec.rmap(
  jsonCodecs.objectOf({
    adaptor_url: json2AdaptorUrlCodec,
    l1_channel: json2L1ChannelCodec,
  }),
  (r) => (new Channel(r.l1_channel, r.adaptor_url)),
  (channel: Channel) => ({
      adaptor_url: channel.adaptorUrl,
      l1_channel: channel.l1,
  })
);
