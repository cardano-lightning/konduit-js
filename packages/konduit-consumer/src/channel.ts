import type { Result } from "neverthrow";
import { ok, err } from "neverthrow";
import type { JsonCodec, JsonError } from "@konduit/codec/json/codecs";
import { json2AdaptorUrlCodec, mkAdaptorChannelClient } from "./adaptorClient";
import type { AdaptorUrl, SquashResponse } from "./adaptorClient";
import * as codec from "@konduit/codec";
import { json2L1ChannelCodec, L1Channel } from "./channel/l1Channel";
import type { ConsumerEd25519VerificationKey, OpenTx } from "./channel/l1Channel";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { LockedCheque, json2LockedChequeCodec, json2SquashCodec, Squash, VerifiedLockedCheque, VerifiedSquash, UnlockedCheque, VerifiedUnlockedCheque, json2UnlockedChequeCodec, Index, LockedChequeBody, UnlockedChequeBody, SquashBody, AnyCheque } from "./channel/squash";
import { json2DeserialisationErrorCodec, json2HttpErrorCodec, json2NetworkErrorCodec, type HttpEndpointError, type HttpError, type NetworkError } from "./http";
import { mkJson2PollingInfoCodec, PollingInfo } from "./polling";
import { mkJson2SquashResponseCodec } from "./adaptorClient/squash";
import type { ChannelTag } from "./channel/core";
import { json2InvoiceCodec, type Invoice } from "./bitcoin/bolt11";
import { Lovelace } from "./cardano";
import { ValidDate } from "./time/absolute";
import type { Ed25519SigningKey } from "@konduit/cardano-keys";
import { unwrapOrPanic, unwrapOrPanicWith } from "./neverthrow";
import { stringify, type Json } from "@konduit/codec/json";

export * from "./channel/l1Channel";
export * from "./channel/core";

export type SquashingInfo = PollingInfo<{ squash: Squash; response: SquashResponse }>;
export const SquashingInfo = PollingInfo;

export const mkJson2SquashingInfoCodec = (tag: ChannelTag, vKey: ConsumerEd25519VerificationKey): JsonCodec<SquashingInfo> => mkJson2PollingInfoCodec(jsonCodecs.objectOf({
  squash: json2SquashCodec,
  response: mkJson2SquashResponseCodec(tag, vKey),
}));

export type SquashingError =
  | { type: "FailedToSubmitSquash"; error: HttpEndpointError }

// TODO: Probably we should attach some additional info about the
// submission status.
export type PendingPayment = {
  cheque: LockedCheque;
  invoice: Invoice;
};

export const json2PendingPayment = jsonCodecs.objectOf({
  cheque: json2LockedChequeCodec,
  invoice: json2InvoiceCodec,
});

export type ConfirmedPayment = {
  cheque: UnlockedCheque;
  // If we recover payments from the adaptor
  // we won't get the full invoice back.
  // We don't not yet implement that flow.
  invoice: Invoice | null;
};

export const json2ConfirmedPayment: JsonCodec<ConfirmedPayment> = jsonCodecs.objectOf({
  cheque: json2UnlockedChequeCodec,
  invoice: jsonCodecs.nullable(json2InvoiceCodec),
});

export type FailedPayment = {
  cheque: LockedCheque;
  error: ImmediatePaymentError;
  invoice: Invoice;
};

export type AnyPayment = PendingPayment | ConfirmedPayment | FailedPayment;
export namespace AnyPayment {
  export const isConfirmed = (payment: AnyPayment): payment is ConfirmedPayment => AnyCheque.isUnlocked(payment.cheque);
  export const isFailed = (payment: AnyPayment): payment is FailedPayment => "error" in payment;
  export const isPending = (payment: AnyPayment): payment is PendingPayment => !isConfirmed(payment) && !isFailed(payment);
};

type ChequeIssuingError =
  | { type: "OverspendsChannel", message: "Total sum of the cheques will exceed the channel capacity" }
  | { type: "TimeoutInThePast"; message: "Cheque timeout has to be in the future" }

// TODO: This error should be probably split into more specific ones
// when the server side is cleaned up.
// An interesting question is if the payment can actually be routed
// successfully after unsuccessful attemt.
export type AdaptorRejection = {
  type: "AdaptorRejection";
  message: string;
  error: HttpError
}
export const json2AdaptorRejectionCodec: JsonCodec<AdaptorRejection> = jsonCodecs.objectOf({
  type: jsonCodecs.constant("AdaptorRejection"),
  message: jsonCodecs.json2StringCodec,
  error: json2HttpErrorCodec,
});
// Response decoding error etc. Should be reported as a bug.
export type CriticalError = {
  type: "CriticalError";
  message:
    "Failed to process the payment due to an unexpected error. This might indicate a bug in the client or the adaptor.";
  error: JsonError;
}
export namespace CriticalError {
  export const make = (type: string, info: JsonError): CriticalError => ({
    type: "CriticalError",
    message: "Failed to process the payment due to an unexpected error. This might indicate a bug in the client or the adaptor.",
    error: { info, type } as JsonError,
  });
}


export const json2CriticalErrorCodec: JsonCodec<CriticalError> = jsonCodecs.objectOf({
  type: jsonCodecs.constant("CriticalError"),
  message: jsonCodecs.constant("Failed to process the payment due to an unexpected error. This might indicate a bug in the client or the adaptor."),
  error: jsonCodecs.identityCodec,
});

// The error which happens during the payment processing.
export type ImmediatePaymentError =
  | NetworkError
  | AdaptorRejection
  | CriticalError

export namespace ImmediatePaymentError {
  export const isNetworkError = (error: ImmediatePaymentError): error is NetworkError =>
    error.type === "NetworkError";
  export const fromHttpEndpointError = (error: HttpEndpointError): ImmediatePaymentError => {
    switch(error.type) {
      case "NetworkError":
        return error as ImmediatePaymentError;
      case "HttpError":
        return {
          type: "AdaptorRejection",
          message: "Payment was rejected by the adaptor. The reason could be BLN routing failure.",
          error
        };
      case "DeserialisationError":
        return CriticalError.make("UnexpectedAdaptorResponse", json2DeserialisationErrorCodec.serialise(error));
    }
  }
}

export const json2ImmediatePaymentErrorCodec: JsonCodec<ImmediatePaymentError> = jsonCodecs.altJsonCodecs(
  [ json2NetworkErrorCodec, json2AdaptorRejectionCodec, json2CriticalErrorCodec ],
  (serNetwork, serAdaptorRejection, serCritical) => (data) => {
    switch(data.type) {
      case "NetworkError": return serNetwork(data);
      case "AdaptorRejection": return serAdaptorRejection(data);
      case "CriticalError": return serCritical(data);
    }
  }
);

export const json2FailedPayment: JsonCodec<FailedPayment> = jsonCodecs.objectOf({
  cheque: json2LockedChequeCodec,
  error: json2ImmediatePaymentErrorCodec,
  invoice: json2InvoiceCodec,
});

// Invariants:
// * `confirmed` contains the full payment history as `secrets` represent transfer confirmation,
// * `pending` contains the cheques which are not included in the squash hence we squash
//  eagerly whenever unlocked are added.
// * We play honestly here so we issue cheques only if the L1 capacity is sufficient.
//
// Mechanics:
// * The synchronisation loop decides what to do based on the latest squash and the squashing info log.
export class Channel {
  public readonly l1: L1Channel;
  public readonly adaptorUrl: AdaptorUrl;

  // Sorted list of pending cheques
  public pending: PendingPayment[];
  // Network failures are recoverable
  public failed: FailedPayment[];
  public confirmed: ConfirmedPayment[];

  // TODO:
  // public expired: ExpiredPayment[];

  // We try to eagerly squash but in the case of network
  // failure during payment we can derail a bit.
  // The value is not necessarily synced with the adaptor yet.
  // TODO: expose public accessors and turn those into `private`.
  public squash: Squash;
  public squashingInfo: PollingInfo<{ squash: Squash; response: SquashResponse }>;

  private constructor(
    l1: L1Channel,
    pending: PendingPayment[],
    confirmed: ConfirmedPayment[],
    failed: FailedPayment[],
    squash: Squash,
    adaptorUrl: AdaptorUrl,
    squashingInfo?: PollingInfo<{ squash: Squash; response: SquashResponse }>
  ) {
    this.l1 = l1;
    this.pending = pending;
    this.confirmed = confirmed;
    this.failed = failed;
    this.adaptorUrl = adaptorUrl;
    this.squash = squash;
    this.squashingInfo = squashingInfo || new PollingInfo(null);
  }

  public static load(
    l1: L1Channel,
    pending: PendingPayment[],
    confirmed: ConfirmedPayment[],
    failed: FailedPayment[],
    squash: Squash,
    adaptorUrl: AdaptorUrl,
    squashingInfo: PollingInfo<{ squash: Squash; response: SquashResponse }>
  ): Result<Channel, JsonError> {
    const vKey = l1.consumerVerificationKey;
    for(const { cheque } of [...pending, ...failed]) {
      if(VerifiedLockedCheque.fromVerification(l1.channelTag, vKey, cheque).isErr()) {
        return err(`Cheque with index ${cheque.body.index} failed verification with consumer verification key ${vKey}`);
      }
    }
    for(const { cheque } of confirmed) {
      if(VerifiedUnlockedCheque.fromVerification(l1.channelTag, vKey, cheque).isErr()) {
        return err(`Unlocked cheque with index ${cheque.body.index} failed verification with consumer verification key ${vKey}`);
      }
    }
    if(VerifiedSquash.fromVerification(l1.channelTag, vKey, squash).isErr()) {
      return err(`Provided squash failed verification with consumer verification key ${vKey}`);
    }
    // TODO: Validate consistency of the squash vs the cheques - all indices in the cheques should be larger than the index of the last squash unless they are excluded.
    return ok(new Channel(l1, pending, confirmed, failed, squash, adaptorUrl, squashingInfo));
  }

  public static open(sKey: Ed25519SigningKey, openTx: OpenTx, adaptorUrl: AdaptorUrl): Channel {
    const emptySquash = Squash.fromBodySigning(openTx.tag, sKey, SquashBody.empty);
    const l1Channel = L1Channel.open(openTx);
    return new Channel(l1Channel, [], [], [], emptySquash, adaptorUrl);
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

  // We use a rather conservative approach - every signed
  // cheque is considered "published" even if immediate
  // payment failed due to networking issue etc.
  private issueCheque = (
    amount: Lovelace,
    timeout: ValidDate,
    invoice: Invoice,
    sKey: Ed25519SigningKey,
  ): Result<LockedCheque, ChequeIssuingError> => {
    const index = this.pending.reduce(
      (currMax, { cheque }) => (Index.ord.max(currMax, cheque.body.index)),
      this.squash.body.index
    );
    if(ValidDate.ord.isLessThan(timeout, ValidDate.now()))
      return err({ type: "TimeoutInThePast", message: "Cheque timeout has to be in the future" });
    const currentTotal = this.pending.reduce(
      (currSum, { cheque }) => currSum + cheque.body.amount,
      this.squash.body.amount as bigint
    );
    if(currentTotal + amount > this.l1.totalChannelFunds)
      return err({ type: "OverspendsChannel", message: "Total sum of the cheques will exceed the channel capacity" });
    const chequeBody = { amount, index: Index.successor(index), lock: invoice.paymentHash, timeout } as LockedChequeBody;
    const cheque = LockedCheque.fromSigning(this.l1.channelTag, sKey, chequeBody);
    this.pending.push({ cheque, invoice });
    return ok(cheque);
  }

  // TODO: Ignore most errors?
  // Currently we report all the failures and reject
  // processing if anything is incorrect. This is probably
  // a good debug mode approach but in general we could
  // probably mostly ignore the errors as consumer resources
  // are not in real danger here.
  private doUnlock(unlockedCheques: UnlockedCheque[]): Result<null, string> {
    // A helper which allows us to apply unlocked over pending or failed payments.
    const unlockPayment = <T extends PendingPayment | FailedPayment>(
      unlocked: UnlockedCheque,
      payments: T[]
    ): Result<{ confirmedPayment: ConfirmedPayment; remaining: T[] } | null, string> => {
      const payment = payments.find(({ cheque: locked }) => Index.ord.areEqual(locked.body.index, unlocked.body.index));
      if(payment == null) return ok(null);
      if(!LockedChequeBody.areMatching(unlocked.body, payment.cheque.body))
        return err(`Unlocked cheque with index ${unlocked.body.index} does not match the pending cheque with the same index`);
      const remaining = payments.filter(({ cheque }) => cheque.body.index !== unlocked.body.index);
      const confirmedPayment = { cheque: unlocked, invoice: payment.invoice };
      return ok({ confirmedPayment, remaining });
    }
    const unlockSingle = (
      unlocked: UnlockedCheque,
      pending: PendingPayment[],
      failed: FailedPayment[],
      confirmed: ConfirmedPayment[]
    ) => {
      const unlockPendingResult = unlockPayment(unlocked, pending);
      return unlockPendingResult.andThen(
        (possibleUnlock) => {
          if(possibleUnlock != null) {
            const { confirmedPayment, remaining } = possibleUnlock;
            return ok({
              pending: remaining,
              failed,
              confirmed: [...confirmed, confirmedPayment]
            });
          }
          const unlockFailedResult = unlockPayment(unlocked, failed);
          return unlockFailedResult.andThen(
            (possibleUnlockFailed) => {
              if(possibleUnlockFailed != null) {
                const { confirmedPayment, remaining } = possibleUnlockFailed;
                return ok({
                  pending,
                  failed: remaining,
                  confirmed: [...confirmed, confirmedPayment]
                });
              }
              const possiblyConfirmed = confirmed.find(({ cheque }) =>
                Index.ord.areEqual(cheque.body.index, unlocked.body.index));
              // This is recovery scenario. Adaptor sent us previously confirmed cheque.
              if(possiblyConfirmed == null) {
                return err(`Unlocked cheque with index ${unlocked.body.index} does not match any pending or failed cheque and there is no confirmed cheque with the same index`);
              }
              if(!UnlockedChequeBody.areEqual(possiblyConfirmed.cheque.body, unlocked.body))
                return err(`Unlocked cheque with index ${unlocked.body.index} does not match the confirmed cheque with the same index`);
              // TODO: Send signals from here.
              return ok({ pending, failed, confirmed });
            }
          );
        }
      );
    }
    let curr = { pending: this.pending, failed: this.failed, confirmed: this.confirmed };
    for(const u of unlockedCheques) {
      const result = unlockSingle(u, curr.pending, curr.failed, curr.confirmed);
      if(result.isErr()) return err(result.error);
      curr = result.value;
    }
    this.pending = curr.pending;
    this.failed = curr.failed;
    this.confirmed = curr.confirmed;
    return ok(null);
  }

  // TODO: should we consider more relaxed error handling approach here
  // as well (please check comment above)?
  // This function returns "failures" on two levels:
  // * directly which indicates that the payment was not created at all
  // * somewhat indirectly through `FailedPayment` which can indicate
  // recoverable errors.
  public pay = async (
    amount: Lovelace,
    timeout: ValidDate,
    invoice: Invoice,
    sKey: Ed25519SigningKey,
  ): Promise<Result<ConfirmedPayment | FailedPayment, ChequeIssuingError>> => {
    return this.issueCheque(amount, timeout, invoice, sKey).match(
      async (cheque) => {
        const response =  await this.adaptorClient.chPay(cheque, invoice);
        return response.match(
          (payResponse) => {
            const paymentFailed = (error: ImmediatePaymentError) => {
              this.failed.push({ cheque, invoice, error });
              return ok({ cheque, invoice, error });
            };
            if(payResponse === "Complete") return paymentFailed(CriticalError.make(
                "UnexpectedAdaptorResponse",
                "Received 'Complete' response from the adaptor in chPay endpoint"
            ));

            const unlockingResult = this.doUnlock(payResponse.unlockeds.map(({ unlocked }) => unlocked));
            if(unlockingResult.isErr()) return paymentFailed(CriticalError.make(
              "UnexpectedAdaptorResponse",
              `Failed to process the unlockeds from the adaptor response: ${unlockingResult.error}`
            ));
            this.doMakeSquash(sKey);

            // Check if between unlockeds we received a cheque corresponding to the one we just issued.
            const confirmedPayment = this.confirmed.find(({ cheque }) => Index.ord.areEqual(cheque.body.index, cheque.body.index));
            if(confirmedPayment == null) return paymentFailed(CriticalError.make(
              "UnexpectedAdaptorResponse",
              "Received a squash proposal without the corresponding unlocked cheque in the unlockeds list"
            ));
            return ok(confirmedPayment);
          },
          (httpEndpointError) => {
            const paymentError = ImmediatePaymentError.fromHttpEndpointError(httpEndpointError);
            this.failed.push({ cheque, invoice, error: paymentError });
            return ok({ cheque, invoice, error: paymentError });
          }
        );
      },
      async (error) => err(error)
    );
  }

  public sync = async (sKey: Ed25519SigningKey, _recCounter: number = 10): Promise<Result<null, HttpEndpointError | string>> => {
    if(this.isFullySynced && this.squashingInfo.lastValue != null) return ok(null);
    if(!this.isFullySquashed)
      this.doMakeSquash(sKey);
    const response = await this.adaptorClient.chSquash(this.squash);
    return response.match(
      (squashResponse) => {
        if(squashResponse == "Complete") {
          this.squashingInfo = this.squashingInfo.mkSuccessor(ok({ squash: this.squash, response: "Complete" }));
          return ok(null);
        }
        const unlockingResult = this.doUnlock(squashResponse.unlockeds.map(({ unlocked }) => unlocked));
        if(unlockingResult.isErr())
          return err(`Failed to process the unlockeds from the adaptor response: ${unlockingResult.error}`);
        if(_recCounter <= 0) {
          return err(`Failed to sync the channel after 10 attempts. Last error: Received a squash proposal without the corresponding unlocked cheque in the unlockeds list`);
        }
        return this.sync(sKey, _recCounter - 1);
      },
      (httpEndpointError) => err(httpEndpointError)
    );
  }

  // Current assumption: full channel knowledge.
  // Current mechanics: stupid simple - full folds.
  private mkSquashBody(): SquashBody {
    // Index should be the maximum of unlockeds or the one from previous squash.
    const index = this.confirmed.reduce(
      (currMax, { cheque }) => Index.ord.max(currMax, cheque.body.index),
      Index.zero
    );
    const amount = (() => {
      const value = Lovelace.fromBigInt(this.confirmed.reduce(
        (currSum, { cheque }) => {
          if(cheque.body.index <= index)
            return currSum + cheque.body.amount;
          return currSum;
        },
        0n
      ));
      return unwrapOrPanic(value, "Failed to calculate the total amount for the squash proposal");
    })();
    const exclude = [...this.pending, ...this.failed]
      .map(({ cheque }) => cheque)
      .filter(({ body }) => body.index < index)
      .map((cheque) => cheque.body.index);
    const squashBody = unwrapOrPanicWith(
      SquashBody.load(index, amount, exclude),
      (error) => `Failed to create the squash proposal body: ${error}`
    );
    return squashBody;
  }

  // This does not actually submit the squash proposal.
  // It will be handled by the submission loop on its own.
  public doMakeSquash(sKey: Ed25519SigningKey): void {
    const squashBody = this.mkSquashBody();
    this.squash = Squash.fromBodySigning(this.channelTag, sKey, squashBody);
  }

  public get isOperational() {
    // This channel was approved by the adaptor.
    return this.squashingInfo.lastValue != null;
  }

  public get arePaymentsFullyConfirmed() {
    return this.pending.length === 0 && this.failed.length === 0;
  }

  public get isFullySquashed() {
    return SquashBody.areEqual(this.squash.body, this.mkSquashBody());
  }

  public get isFullySynced() {
    return (
      this.arePaymentsFullyConfirmed
      && this.isFullySquashed
      && this.squashingInfo.lastValue != null
      && SquashBody.areEqual(this.squash.body, this.squashingInfo.lastValue.squash.body)
    );
  }
}

export const json2ChannelCodec: JsonCodec<Channel> = codec.pipe(
  jsonCodecs.objectOf({
    adaptor_url: json2AdaptorUrlCodec,
    confirmed: jsonCodecs.arrayOf(json2ConfirmedPayment),
    failed: jsonCodecs.arrayOf(json2FailedPayment),
    l1_channel: json2L1ChannelCodec,
    pending: jsonCodecs.arrayOf(json2PendingPayment),
    squash: json2SquashCodec,
    squashing_info: jsonCodecs.identityCodec,
  }), {
    deserialise: (r) => {
      const json2SquashingInfo = mkJson2SquashingInfoCodec(r.l1_channel.channelTag, r.l1_channel.consumerVerificationKey);
      return json2SquashingInfo.deserialise(r.squashing_info).andThen((squashingInfo) =>
        Channel.load(r.l1_channel, r.pending, r.confirmed, r.failed, r.squash, r.adaptor_url, squashingInfo)
      );
    },
    serialise: (channel: Channel) => {
      const json2SquashingInfo = mkJson2SquashingInfoCodec(channel.channelTag, channel.consumerVerificationKey);
      return {
        adaptor_url: channel.adaptorUrl,
        confirmed: channel.confirmed,
        failed: channel.failed,
        l1_channel: channel.l1,
        pending: channel.pending,
        squash: channel.squash,
        squashing_info: json2SquashingInfo.serialise(channel.squashingInfo),
      };
    }
  }
);
