import type { Result } from "neverthrow";
import { ok, err } from "neverthrow";
import type { JsonCodec, JsonError } from "@konduit/codec/json/codecs";
import { json2AdaptorUrlCodec, mkAdaptorChannelClient } from "./adaptorClient";
import type { AdaptorUrl, SquashResponse } from "./adaptorClient";
import * as codec from "@konduit/codec";
import { json2L1ChannelCodec, L1Channel } from "./channel/l1Channel";
import type { OpenTx } from "./channel/l1Channel";
import type { ConsumerEd25519VerificationKey } from "./channel/core";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { LockedCheque, json2LockedChequeCodec, json2SquashCodec, Squash, VerifiedLockedCheque, VerifiedSquash, UnlockedCheque, VerifiedUnlockedCheque, json2UnlockedChequeCodec, Index, LockedChequeBody, UnlockedChequeBody, SquashBody, AnyCheque, json2SquashBodyCodec } from "./channel/squash";
import { json2DeserialisationErrorCodec, json2HttpErrorCodec, json2NetworkErrorCodec, type HttpEndpointError, type HttpError, type NetworkError } from "./http";
import { mkJson2PollingInfoCodec, PollingInfo } from "./polling";
import { mkJson2SquashResponseCodec } from "./adaptorClient/squash";
import type { ChannelTag } from "./channel/core";
import { json2InvoiceCodec, type Invoice } from "./bitcoin/bolt11";
import { Lovelace } from "./cardano";
import { json2ValidDateCodec, ValidDate } from "./time/absolute";
import type { Ed25519SigningKey } from "@konduit/cardano-keys";
import { unwrapOrPanic, unwrapOrPanicWith } from "./neverthrow";

export * from "./channel/l1Channel";
export * from "./channel/core";

export type SquashingInfo = PollingInfo<{ squash: Squash; response: SquashResponse }>;
export const SquashingInfo = PollingInfo;

export const mkJson2SquashingInfoCodec = (tag: ChannelTag, vKey: ConsumerEd25519VerificationKey): JsonCodec<SquashingInfo> => mkJson2PollingInfoCodec(jsonCodecs.objectOf({
  squash: json2SquashCodec,
  response: mkJson2SquashResponseCodec(tag, vKey),
}));

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

// We construct cheques and send them "atomically"
// so we either transtion to this `PendingPayment` with failure or
// to `ConfirmedPayment`.
//
// On the other hand we allow loading the channel state
// solely from the adaptor which means that the 
export type PendingPayment = {
  cheque: LockedCheque;
  info: {
    error: ImmediatePaymentError | null;
    invoice: Invoice;
  } | null;
};

export const json2PendingPayment: JsonCodec<PendingPayment> = jsonCodecs.objectOf({
  cheque: json2LockedChequeCodec,
  info: jsonCodecs.nullable(jsonCodecs.objectOf({
    error: jsonCodecs.nullable(json2ImmediatePaymentErrorCodec),
    invoice: json2InvoiceCodec,
  })),
});

export type SquashingError =
  | { type: "FailedToSubmitSquash"; error: HttpEndpointError }

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

// Expired either through real expiration or through mutual
// agreement and squash.
export type ExpiredPayment = {
  cheque: LockedCheque;
  expiredAt: ValidDate;
  info: ({
    error: ImmediatePaymentError;
    invoice: Invoice;
  });
}

export const json2ExpiredPayment: JsonCodec<ExpiredPayment> = jsonCodecs.objectOf({
  cheque: json2LockedChequeCodec,
  expiredAt: json2ValidDateCodec,
  info: jsonCodecs.objectOf({
    error: json2ImmediatePaymentErrorCodec,
    invoice: json2InvoiceCodec,
  }),
});

export type AnyPayment = PendingPayment | ConfirmedPayment | ExpiredPayment;
export namespace AnyPayment {
  export const isConfirmed = (payment: AnyPayment): payment is ConfirmedPayment => AnyCheque.isUnlocked(payment.cheque);
  export const isExpired = (payment: AnyPayment): payment is ExpiredPayment => "expiredAt" in payment;
  export const isPending = (payment: AnyPayment): payment is PendingPayment => !isConfirmed(payment) && !isExpired(payment);
};

export type ChequeIssuingError =
  | { type: "ChannelNotOperational", message: "The channel is not operational" }
  | { type: "OverspendsChannel", message: "Total sum of the cheques will exceed the channel capacity" }
  | { type: "TimeoutInThePast"; message: "Cheque timeout has to be in the future" }

// Invariants:
// * `confirmed` contains the full payment history as `secrets` represent transfer confirmation,
// * `pending` contains the cheques which are not included in the squash hence we squash
//  eagerly whenever unlocked are added.
// * We play honestly here so we issue cheques only if the L1 capacity is sufficient.
//
// Conventions:
// * All internal state mutating methods start with `do*` prefix
//
//
// More notes :-)
// failure during payment we can derail a bit.
// The value is not necessarily synced with the adaptor yet.
// TODO: expose public accessors and turn those into `private`.
// State invariant:
// * `squashBody ≥ squash.body ≥ squashingInfo.lastValue.body` where `≥` means successor squash body
// Reasoning:
// * We try eagerly squash into the squashBody and not squash as we do not sKey at hand.
// * Given the above the squash body together with pending cheques (pending + faieldPending)
//  should represent the current L2 state. The `confirmed` can be considered to be only
//  informational.
// * We eagerly update the squash whenever we have opportunity to sign.
// * We eagerly sync the squash with the backend but the difference between
// the current `squashBody` vs `squash` vs `squashingInfo.lastValue` should
// give us full picture about the state of the channel and sychronisation.
export class Channel {
  public readonly l1: L1Channel;
  public readonly adaptorUrl: AdaptorUrl;

  public pending: PendingPayment[];
  public confirmed: ConfirmedPayment[];
  public expired: ExpiredPayment[];

  public squashBody: SquashBody;
  public squash: Squash | null;
  public squashingInfo: PollingInfo<{ squash: Squash; response: SquashResponse }>;

  private constructor(
    l1: L1Channel,
    pending: PendingPayment[],
    confirmed: ConfirmedPayment[],
    expired: ExpiredPayment[],
    squashBody: SquashBody,
    squash: Squash | null,
    adaptorUrl: AdaptorUrl,
    squashingInfo?: PollingInfo<{ squash: Squash; response: SquashResponse }>
  ) {
    this.l1 = l1;
    this.pending = pending;
    this.confirmed = confirmed;
    this.expired = expired;
    this.adaptorUrl = adaptorUrl;
    this.squashBody = squashBody;
    this.squash = squash;
    this.squashingInfo = squashingInfo || new PollingInfo(null);
  }

  public static load(
    l1: L1Channel,
    pending: PendingPayment[],
    confirmed: ConfirmedPayment[],
    expired: ExpiredPayment[],
    squashBody: SquashBody,
    squash: Squash | null,
    adaptorUrl: AdaptorUrl,
    squashingInfo?: PollingInfo<{ squash: Squash; response: SquashResponse }>
  ): Result<Channel, JsonError> {
    const vKey = l1.consumerVerificationKey;
    for(const { cheque } of [...pending]) {
      if(VerifiedLockedCheque.fromVerification(l1.channelTag, vKey, cheque).isErr()) {
        return err(`Cheque with index ${cheque.body.index} failed verification with consumer verification key ${vKey}`);
      }
    }
    for(const { cheque } of confirmed) {
      if(VerifiedUnlockedCheque.fromVerification(l1.channelTag, vKey, cheque).isErr()) {
        return err(`Unlocked cheque with index ${cheque.body.index} failed verification with consumer verification key ${vKey}`);
      }
    }
    if(squash && VerifiedSquash.fromVerification(l1.channelTag, vKey, squash).isErr()) {
      return err(`Provided squash failed verification with consumer verification key ${vKey}`);
    }
    // TODO: Validate consistency of the squash vs the cheques and squashBody vs cheques
    return ok(new Channel(l1, pending, confirmed, expired, squashBody, squash, adaptorUrl, squashingInfo));
  }

  public static open(openTx: OpenTx, adaptorUrl: AdaptorUrl): Channel {
    const l1Channel = L1Channel.open(openTx);
    return new Channel(l1Channel, [], [], [], SquashBody.empty, null, adaptorUrl);
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

  public get totalSubmittedCapacity(): Lovelace | null {
    return this.l1.totalSubmittedCapacity;
  }

  public get totalApprovedCapacity(): Lovelace | null {
    return this.l1.totalApprovedCapacity;
  }

  public get usedCapacity(): Lovelace {
    const used = this.pending.reduce(
      (currSum, { cheque }) => currSum + cheque.body.amount,
      this.squashBody.amount as bigint
    );
    return unwrapOrPanic(
      Lovelace.fromBigInt(used),
      `PANIC: Invalid Lovelace amount calculated for used capacity: ${used}`
    );
  }

  public get availableApprovedCapacity(): Lovelace | null {
    const total = this.totalApprovedCapacity;
    if(total === null) return null;
    return unwrapOrPanic(
      Lovelace.subtract(total, this.usedCapacity),
      `PANIC: Used capacity channel capacity (${this.usedCapacity}) exceeds total L2 capacity (${total})`
    );
  }

  // Pure cheque construction.
  private mkCheque = (
    amount: Lovelace,
    timeout: ValidDate,
    invoice: Invoice,
    sKey: Ed25519SigningKey,
  ): Result<LockedCheque, ChequeIssuingError> => {
    const index = Index.successor(this.squashBody.index);
    if(ValidDate.ord.isLessThan(timeout, ValidDate.now()))
      return err({ type: "TimeoutInThePast", message: "Cheque timeout has to be in the future" });

    if(this.availableApprovedCapacity == null)
      return err({ type: "ChannelNotOperational", message: "The channel is not operational" });

    if(this.availableApprovedCapacity < amount)
      return err({ type: "OverspendsChannel", message: "Total sum of the cheques will exceed the channel capacity" });

    const chequeBody = { amount, index: Index.successor(index), lock: invoice.paymentHash, timeout } as LockedChequeBody;
    const cheque = LockedCheque.fromSigning(this.l1.channelTag, sKey, chequeBody);
    return ok(cheque);
  }

  // FIXME?: Ignore most errors?
  //
  // Currently we report all the failures and reject
  // processing if anything is incorrect. This is probably
  // a good debug mode approach but in general we could
  // probably mostly ignore the errors as consumer resources
  // are not in real danger here.
  private doUnlock(unlockedCheques: UnlockedCheque[]): Result<null, string> {
    const unlockPayment = <T extends PendingPayment>(
      unlocked: UnlockedCheque,
      payments: T[]
    ): Result<{ confirmedPayment: ConfirmedPayment; remaining: T[] } | null, string> => {
      const payment = payments.find(({ cheque: locked }) => Index.ord.areEqual(locked.body.index, unlocked.body.index));
      if(payment == null) return ok(null);
      if(!LockedChequeBody.areMatching(unlocked.body, payment.cheque.body))
        return err(`Unlocked cheque with index ${unlocked.body.index} does not match the pending cheque with the same index`);
      const remaining = payments.filter(({ cheque }) => cheque.body.index !== unlocked.body.index);
      const confirmedPayment = {
        cheque: unlocked,
        invoice: payment.info?.invoice|| null
      } as ConfirmedPayment;
      return ok({ confirmedPayment, remaining });
    }

    const unlockSingle = (
      unlocked: UnlockedCheque,
      pending: PendingPayment[],
      confirmed: ConfirmedPayment[]
    ) => {
      const unlockPendingResult = unlockPayment(unlocked, pending);
      return unlockPendingResult.andThen(
        (possibleUnlock) => {
          if(possibleUnlock != null) {
            const { confirmedPayment, remaining } = possibleUnlock;
            return ok({
              pending: remaining,
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
          return ok({ pending, confirmed });
        }
      );
    }
    let curr = { pending: this.pending, confirmed: this.confirmed };
    for(const u of unlockedCheques) {
      const result = unlockSingle(u, curr.pending, curr.confirmed);
      if(result.isErr()) return err(result.error);
      curr = result.value;
    }

    this.squashBody = Channel.mkSquashBody(
      this.squashBody,
      curr.confirmed,
      curr.pending
    );
    this.pending = curr.pending;
    this.confirmed = curr.confirmed;
    return ok(null);
  }

  public doL2Sync = async (sKey: Ed25519SigningKey, _recCounter: number = 10): Promise<Result<null, HttpEndpointError | string>> => {
    // `this.squash` is not null because after this signing:
    if(!this.isFullySquashed)
      this.doSignSquash(sKey);
    const response = await this.adaptorClient.chSquash(this.squash!);
    return response.match(
      (squashResponse) => {
        if(squashResponse == "Complete") {
          this.squashingInfo = this.squashingInfo.mkSuccessor(ok({
            squash: this.squash!,
            response: "Complete"
          }));
          return ok(null);
        }
        const unlockingResult = this.doUnlock(squashResponse.unlockeds.map(({ unlocked }) => unlocked));
        if(unlockingResult.isErr())
          return err(`Failed to process the unlockeds from the adaptor response: ${unlockingResult.error}`);
        if(_recCounter <= 0) {
          return err(`Failed to sync the channel after 10 attempts. Last error: Received a squash proposal without the corresponding unlocked cheque in the unlockeds list`);
        }
        return this.doL2Sync(sKey, _recCounter - 1);
      },
      (httpEndpointError) => err(httpEndpointError)
    );
  }

  // TODO: should we consider more relaxed error handling approach here
  // as well (please check comment above)?
  // This function returns "failures" on two levels:
  // * directly which indicates that the payment was not created at all
  // * somewhat indirectly through `FailedPayment` which can indicate
  // recoverable errors.
  public doPay = async (
    amount: Lovelace,
    timeout: ValidDate,
    invoice: Invoice,
    sKey: Ed25519SigningKey,
  ): Promise<Result<ConfirmedPayment | PendingPayment, ChequeIssuingError>> => {
    return this.mkCheque(amount, timeout, invoice, sKey).match(
      async (cheque) => {
        // We push this internal object right away
        // to the pending queue but we update
        // its info as we process the payment.
        const payment = {
          cheque,
          info: { error: null, invoice }
        } as PendingPayment;
        this.pending.push(payment);

        const response =  await this.adaptorClient.chPay(cheque, invoice);
        return response.match(
          (payResponse) => {
            const paymentFailed = (error: ImmediatePaymentError) => {
              // We are mutating here the payment
              // which we already pushed into the pending.
              payment.info = { error, invoice };
              // Return a fresh object
              return ok({ cheque, info: { error, invoice } } as PendingPayment);
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
            this.doSignSquash(sKey);

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
            payment.info = { error: paymentError, invoice };
            return ok({
              cheque,
              info: { error: paymentError, invoice }
            });
          }
        );
      },
      async (error) => err(error)
    );
  }

  // Pure helper. We want to keep it pure
  // because the state transition should be
  // internal "atomic":
  // * `squashBody` assignment then `confirmed` and `pending` update.
  private static mkSquashBody(
    prevSquashBody: SquashBody,
    confirmed: ConfirmedPayment[],
    pending: PendingPayment[]
  ): SquashBody {
    const newIndex = confirmed.reduce(
      (currMax, { cheque }) => Index.ord.max(currMax, cheque.body.index),
      prevSquashBody.index
    );
    const newAmount: Lovelace = (() => {
      const value = Lovelace.fromBigInt(confirmed.reduce(
        // We use bigint here as we are careful what we
        // add up and compare.
        (currSum: bigint, { cheque }) => {
          if(cheque.body.index > prevSquashBody.index)
            return currSum + cheque.body.amount;
          return currSum;
        },
        prevSquashBody.amount
      ));
      return unwrapOrPanic(
        value,
        "Failed to calculate the total amount for the squash proposal"
      );
    })();
    const exclude = pending
      .map(({ cheque }) => cheque)
      .filter(({ body }) => body.index < newIndex)
      .map((cheque) => cheque.body.index)
      .sort();
    const squashBody = unwrapOrPanicWith(
      SquashBody.load(newIndex, newAmount, exclude),
      (error) => `Failed to create the squash proposal body: ${error}`
    );
    return squashBody;
  }

  // This does not actually submit the squash proposal.
  // It will be handled by the submission loop on its own.
  // As state is always eagerly squashed into `squashBody`
  // we don't have to compute anything here.
  public doSignSquash(sKey: Ed25519SigningKey): void {
    this.squash = Squash.fromBodySigning(
      this.channelTag,
      sKey,
      this.squashBody
    );
  }

  public get wasApproved() {
    // This channel was approved by the adaptor.
    return this.squashingInfo.lastValue != null
  }

  // FIXME: Handle closure
  public get isOperational() {
    return this.wasApproved;
  }

  public get arePaymentsFullyConfirmed() {
    return this.pending.length === 0;
  }

  // We have all the time fully squashed `squashBody`
  // but not necessarily the `squash`.
  public get isFullySquashed() {
    return (
      this.squash != null &&
      SquashBody.areEqual(this.squashBody, this.squash.body)
    );
  }

  public get isFullySubmitted() {
    return (
      this.isFullySquashed &&
      this.squash != null &&
      this.squashingInfo.lastValue != null &&
      SquashBody.areEqual(this.squash.body, this.squashingInfo.lastValue.squash.body)
    );
  }
}

export const json2ChannelCodec: JsonCodec<Channel> = codec.pipe(
  jsonCodecs.objectOf({
    adaptor_url: json2AdaptorUrlCodec,
    confirmed: jsonCodecs.arrayOf(json2ConfirmedPayment),
    expired: jsonCodecs.arrayOf(json2ExpiredPayment),
    l1_channel: json2L1ChannelCodec,
    pending: jsonCodecs.arrayOf(json2PendingPayment),
    squash_body: json2SquashBodyCodec,
    squash: jsonCodecs.nullable(json2SquashCodec),
    squashing_info: jsonCodecs.identityCodec,
  }), {
    deserialise: (r) => {
      const json2SquashingInfo = mkJson2SquashingInfoCodec(r.l1_channel.channelTag, r.l1_channel.consumerVerificationKey);
      return json2SquashingInfo.deserialise(r.squashing_info).andThen((squashingInfo) =>
        Channel.load(r.l1_channel, r.pending, r.confirmed, r.expired, r.squash_body, r.squash, r.adaptor_url, squashingInfo)
      );
    },
    serialise: (channel: Channel) => {
      const json2SquashingInfo = mkJson2SquashingInfoCodec(channel.channelTag, channel.consumerVerificationKey);
      return {
        adaptor_url: channel.adaptorUrl,
        confirmed: channel.confirmed,
        expired: channel.expired,
        l1_channel: channel.l1,
        pending: channel.pending,
        squash_body: channel.squashBody,
        squash: channel.squash,
        squashing_info: json2SquashingInfo.serialise(channel.squashingInfo),
      };
    }
  }
);
