// import { AdaptorUrl } from "./adaptor";
import { AdaptorUrl } from "./adaptorClient";
import { L1Channel, OpenTx } from "./channel/l1Channel";
// import { CardanoConnectorWallet } from "./wallets/embedded";

// import type { Tagged } from "type-fest";
// import { ok, Result } from "neverthrow";
// import { VKey } from "@konduit/cardano-keys";
// import { Adaptor, AdaptorInfo } from "./adaptor";
// import { randomBytes } from "@noble/hashes/utils.js";
// 
// // import type { MissingProp, PropParseError } from "./parsing";
// // import { parseRequired } from "./parsing";
// // import { AdaptorInfo } from "./adaptorInfo";
// // import { L1Channel } from "./l1Channel";
// // import { parseEd25519VKey, type Ed25519VKey } from "./cardano";
// // import { parseUint8ArrayAs } from "./hexString";
// // import type { HexDecodingError } from "./hexString";
// // import * as hexString from "./hexString";
// 
// // TODO: Implement these types when their modules are ready
// type MixedReceipt = any;
// // type Squash = any;
// // type Cheque = any;
// // type ChequeBody = any;
// // type Adaptor = any;
// // type QuoteResponse = any;

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

//   vKey: VKey;
//   tag: ChannelTag;
//   adaptor: Adaptor;
//   // l1: L1Channel;
//   // l2: MixedReceipt;
// 
//   constructor(
//     vKey: VKey,
//     tag: ChannelTag,
//     adaptor: Adaptor,
//     // l1: L1Channel,
//     // l2: MixedReceipt,
//   ) {
//     this.vKey = vKey;
//     this.tag = tag;
//     this.adaptor = adaptor;
//     // this.l1 = l1;
//     // this.l2 = l2;
//   }
// 
//   serialise(): {
//     key: string;
//     tag: string;
//     adaptor_info: ReturnType<AdaptorInfo["serialise"]>;
//     l1: ReturnType<L1Channel["serialise"]>;
//     l2: any;
//   } {
//     return {
//       key: hexString.fromUint8Array(this.key),
//       tag: hexString.fromUint8Array(this.tag),
//       adaptor_info: this.adaptorInfo.serialise(),
//       l1: this.l1.serialise(),
//       l2: this.l2.serialise(),
//     };
//   }
// 
//   static deserialise(data: unknown): Result<Channel, string | PropParseError<string | HexDecodingError | PropParseError<string | HexDecodingError> | MissingProp> | MissingProp> {
//     const parseTag = (data: any): Result<ChannelTag, string | HexDecodingError> => {
//       return parseUint8ArrayAs(data, undefined, "ChannelTag");
//     };
// 
//     const parseAdaptorInfo = (data: any): Result<AdaptorInfo, PropParseError<string | HexDecodingError> | MissingProp> => {
//       return AdaptorInfo.deserialise(data);
//     };
// 
//     const parseL1Channel = (data: any): Result<L1Channel, PropParseError<string | HexDecodingError> | MissingProp> => {
//       return L1Channel.deserialise(data);
//     };
// 
//     const parseMixedReceipt = (data: any): Result<MixedReceipt, string> => {
//       // TODO: Implement when MixedReceipt.deserialise() is available
//       return ok(data as MixedReceipt);
//     };
// 
//     return Result.combine([
//       parseRequired<Ed25519VKey, string | HexDecodingError>(data, "key", parseEd25519VKey),
//       parseRequired<ChannelTag, string | HexDecodingError>(data, "tag", parseTag),
//       parseRequired<AdaptorInfo, PropParseError<string | HexDecodingError> | MissingProp>(data, "adaptor_info", parseAdaptorInfo),
//       parseRequired<L1Channel, PropParseError<string | HexDecodingError> | MissingProp>(data, "l1", parseL1Channel),
//       parseRequired<MixedReceipt, string>(data, "l2", parseMixedReceipt),
//     ]).map(([key, tag, adaptorInfo, l1, l2]) => {
//       return new Channel(key, tag, adaptorInfo, l1, l2);
//     });
// 
//   // static open(
//   //   verificationKey: Ed25519VKey,
//   //   tag: ChannelTag,
//   //   adaptorInfo: AdaptorInfo,
//   //   l1: L1Channel,
//   //   squash: Squash,
//   // ): Channel {
//   //   // TODO: Implement MixedReceipt constructor
//   //   const mixedReceipt = { squash, cheques: [] } as MixedReceipt;
//   //   return new Channel(verificationKey, tag, adaptorInfo, l1, mixedReceipt);
//   // }
// 
//   // squash() {
//   //   // TODO: Implement when Adaptor is available
//   //   return this.adaptor().chSquash(this.l2.squash);
//   // }
// 
//   // sync() {
//   //   return Promise.all([this.squash()]);
//   // }
// 
//   // adaptor(): Adaptor {
//   //   throw new Error("Adaptor not yet implemented");
//   // }
// 
//   // makeChequeBody(_amount: number, _timeout: number, _lock: Uint8Array): ChequeBody {
//   //   throw new Error("Not yet implemented");
//   // }
// 
//   // insertCheque(_cheque: Cheque): void {
//   //   // TODO: Implement when MixedReceipt.insert() is available
//   //   throw new Error("Not yet implemented");
//   // }
// 
//   // updateFromL1(_l1s: L1Channel[]): void {
//   //   throw new Error("Not yet implemented");
//   // }
// 
//   // updateL2(l2: MixedReceipt): MixedReceipt {
//   //   // TODO: Implement when MixedReceipt.verify() is available
//   //   if (l2.verify(this.key, this.tag)) {
//   //     this.l2 = l2;
//   //     return l2;
//   //   } else {
//   //     throw new Error("L2 verification failed");
//   //   }
//   // }
// 
//   // async quote(amount_msat: number, payee: Uint8Array): Promise<QuoteResponse> {
//   //   // TODO: Implement when Adaptor.chQuote() is available
//   //   return this.adaptor().chQuote(amount_msat, payee);
//   // }
// 
//   // pay(
//   //   cheque: Cheque,
//   //   invoiceDetails: {
//   //     payee: any;
//   //     amount: any;
//   //     paymentSecret: any;
//   //     finalCltvDelta: any;
//   //   },
//   // ) {
//   //   this.insertCheque(cheque);
//   //   // TODO: Implement when Adaptor.chPay() is available
//   //   return this.adaptor().chPay({
//   //     cheque,
//   //     payee: invoiceDetails.payee,
//   //     amount_msat: invoiceDetails.amount,
//   //     payment_secret: invoiceDetails.paymentSecret,
//   //     final_cltv_delta: invoiceDetails.finalCltvDelta,
//   //   });
//   // }
// 
//   // available(): Lovelace {
//   //   const l1 = this.l1;
//   //   const l2 = this.l2;
//   //   if (l1 && l2 && l1.stage === "Opened") {
//   //     // TODO: Implement when MixedReceipt.committed() is available
//   //     return (l1.amount - l2.committed()) as Lovelace;
//   //   } else {
//   //     return BigInt(0) as Lovelace;
//   //   }
//   // }
// 
//   // unresolvedCommitment(): Lovelace {
//   //   // TODO: Implement when MixedReceipt.cheques() is available
//   //   return this.l2
//   //     .cheques()
//   //     .reduce((acc: bigint, curr: any) => acc + curr.cheque_body.amount, BigInt(0)) as Lovelace;
//   // }
//   }
}
