import type { Result } from "neverthrow";
import { ok, err } from "neverthrow";
import type { JsonCodec, JsonError } from "@konduit/codec/json/codecs";
import { json2AdaptorUrlCodec, mkAdaptorChannelClient } from "./adaptorClient";
import type { AdaptorUrl, SquashResponse } from "./adaptorClient";
import * as codec from "@konduit/codec";
import { json2L1ChannelCodec, L1Channel } from "./channel/l1Channel";
import type { OpenTx } from "./channel/l1Channel";
import { type ConsumerEd25519VerificationKey } from "./channel/core";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { LockedCheque, json2LockedChequeCodec, json2SquashCodec, Squash, VerifiedLockedCheque, VerifiedSquash, UnlockedCheque, VerifiedUnlockedCheque, json2UnlockedChequeCodec, Index, LockedChequeBody, UnlockedChequeBody, SquashBody, AnyCheque, json2SquashBodyCodec } from "./channel/squash";
import { json2AbortedErrorCodec, json2DeserialisationErrorCodec, json2HttpErrorCodec, json2NetworkErrorCodec, type AbortedError, type HttpEndpointError, type HttpError, type NetworkError } from "./http";
import { mkJson2PollingInfoCodec, PollingInfo } from "./polling";
import { mkJson2SquashResponseCodec } from "./adaptorClient/squash";
import type { ChannelTag } from "./channel/core";
import { HtlcLock, json2InvoiceCodec, type Invoice } from "./bitcoin/bolt11";
import { Ada, Lovelace } from "./cardano";
import { json2ValidDateCodec, ValidDate } from "./time/absolute";
import type { Ed25519SigningKey } from "@konduit/cardano-keys";
import { unwrapOrPanic, unwrapOrPanicWith } from "./neverthrow";
import { AdaAmount, AmountFx, BitcoinAmount, type CryptoAmount } from "./amounts";
import { Fx } from "./fx";
import { Millisatoshi } from "./bitcoin";
import type { AnyAmount, AnyAmountSymbol, Sign } from "./amounts/core";
import { NonNegativeDecimal } from "@konduit/codec/decimals";
import { BitcoinDecimal } from "./bitcoin/asset";
import { stringify } from "@konduit/codec/json";

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
    error: { info, type },
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
  | AbortedError
  | NetworkError
  | AdaptorRejection
  | CriticalError

export namespace ImmediatePaymentError {
  export const isNetworkError = (error: ImmediatePaymentError): error is NetworkError =>
    error.type === "NetworkError";
  export const fromHttpEndpointError = (error: HttpEndpointError): ImmediatePaymentError => {
    switch(error.type) {
      case "NetworkError":
        return error;
      case "HttpError":
        return {
          type: "AdaptorRejection",
          message: "Payment was rejected by the adaptor. The reason could be BLN routing failure.",
          error
        };
      case "DeserialisationError":
        return CriticalError.make("UnexpectedAdaptorResponse", json2DeserialisationErrorCodec.serialise(error));
      case "AbortedError":
        return error;
    }
  }
}

export const json2ImmediatePaymentErrorCodec: JsonCodec<ImmediatePaymentError> = jsonCodecs.altJsonCodecs(
  [ json2NetworkErrorCodec, json2AdaptorRejectionCodec, json2CriticalErrorCodec, json2AbortedErrorCodec ],
  (serNetwork, serAdaptorRejection, serCritical, serAborted) => (data) => {
    switch(data.type) {
      case "NetworkError": return serNetwork(data);
      case "AdaptorRejection": return serAdaptorRejection(data);
      case "CriticalError": return serCritical(data);
      case "AbortedError": return serAborted(data);
    }
  }
);

export type FailedPayment = {
  cheque: LockedCheque;
  createdAt: ValidDate;
  error: ImmediatePaymentError | null;
  invoice: Invoice | null;
};
export namespace FailedPayment {
  export const jsonCodec: JsonCodec<FailedPayment> = jsonCodecs.objectOf({
    cheque: json2LockedChequeCodec,
    createdAt: json2ValidDateCodec,
    error: jsonCodecs.nullable(json2ImmediatePaymentErrorCodec),
    invoice: jsonCodecs.nullable(json2InvoiceCodec),
  });
}

export type SquashingError =
  | { type: "FailedToSubmitSquash"; error: HttpEndpointError }

export type ConfirmedPayment = {
  cheque: UnlockedCheque;
  createdAt: ValidDate;
  // If we recover payments from the adaptor
  // we won't get the full invoice back.
  // We don't not yet implement that flow.
  invoice: Invoice | null;
};

export const json2ConfirmedPayment: JsonCodec<ConfirmedPayment> = jsonCodecs.objectOf({
  cheque: json2UnlockedChequeCodec,
  createdAt: json2ValidDateCodec,
  invoice: jsonCodecs.nullable(json2InvoiceCodec),
});

// Expired either through real expiration or through mutual
// agreement and squash.
export type ExpiredPayment = {
  cheque: LockedCheque;
  createdAt: ValidDate;
  expiredAt: ValidDate;
  error: ImmediatePaymentError;
  invoice: Invoice;
}

export const json2ExpiredPayment: JsonCodec<ExpiredPayment> = jsonCodecs.objectOf({
  cheque: json2LockedChequeCodec,
  createdAt: json2ValidDateCodec,
  expiredAt: json2ValidDateCodec,
  error: json2ImmediatePaymentErrorCodec,
  invoice: json2InvoiceCodec,
});

export type AnyPayment = FailedPayment | ConfirmedPayment | ExpiredPayment;
export type PaymentBreakdown<T> = {
  total: T;
  invoice: T;
  fee: T;
};
export namespace PaymentBreakdown {
  export const map = <A, B>(breakdown: PaymentBreakdown<A>, f: (c: A) => B): PaymentBreakdown<B> => ({
    total: f(breakdown.total),
    invoice: f(breakdown.invoice),
    fee: f(breakdown.fee),
  });
  export const traverse = <A, B, E>(
    breakdown: PaymentBreakdown<A>,
    f: (c: A) => Result<B, E>
  ): Result<
      PaymentBreakdown<B>,
      { total: E | null; invoice: E | null; fee: E | null }
    > => {
    const totalResult = f(breakdown.total);
    const invoiceResult = f(breakdown.invoice);
    const feeResult = f(breakdown.fee);
    if(totalResult.isOk() && invoiceResult.isOk() && feeResult.isOk())
      return ok({ total: totalResult.value, invoice: invoiceResult.value, fee: feeResult.value });
    return err({
      total: totalResult.isErr() ? totalResult.error : null,
      invoice: invoiceResult.isErr() ? invoiceResult.error : null,
      fee: feeResult.isErr() ? feeResult.error : null,
    });
  }
}

export namespace AnyPayment {
  export const isConfirmed = (payment: AnyPayment): payment is ConfirmedPayment => AnyCheque.isUnlocked(payment.cheque);
  export const isExpired = (payment: AnyPayment): payment is ExpiredPayment => "expiredAt" in payment;
  export const isFailed = (payment: AnyPayment): payment is FailedPayment => !isConfirmed(payment) && !isExpired(payment);

  export const getLock = (payment: AnyPayment): HtlcLock => {
    if(payment.invoice)
      return payment.invoice.paymentHash;
    return AnyCheque.getLock(payment.cheque);
  }

  export const breakItDownInAda = (
    invoiceAmount: Lovelace,
    total: Lovelace,
  ): PaymentBreakdown<AdaAmount> => {
    const feeInLovelace = Lovelace.subtractAbs(total, invoiceAmount);
    const feeSign: Sign = Lovelace.ord.isGreaterThanOrEqual(total, invoiceAmount) ?
      "positive"
      : "negative";
    return {
      fee: AdaAmount.fromLovelace(feeInLovelace, feeSign),
      invoice: AdaAmount.fromLovelace(invoiceAmount),
      total: AdaAmount.fromLovelace(total),
    };
  }

  export const breakItDownInBtc = (
    invoiceAmount: Millisatoshi,
    totalInMsat: Millisatoshi,
  ): PaymentBreakdown<BitcoinAmount> => {
    const feeInMsat = Millisatoshi.subtractAbs(totalInMsat, invoiceAmount);
    const feeSign: Sign = Millisatoshi.ord.isGreaterThanOrEqual(totalInMsat, invoiceAmount) ?
      "positive"
      : "negative";
    return {
      fee: BitcoinAmount.fromMillisatoshi(feeInMsat, feeSign),
      invoice: BitcoinAmount.fromMillisatoshi(invoiceAmount),
      total: BitcoinAmount.fromMillisatoshi(totalInMsat),
    };
  }

  export const DEFAULT_FEE_MULTIPLIER = NonNegativeDecimal.fromDigits(1, '.', 0, 2);
  export const estimateBreakdownInBtc = (
    invoiceAmount: Millisatoshi,
  ): Result<PaymentBreakdown<BitcoinAmount>, string> => {
    const possibleTotal = BitcoinDecimal.scale(BitcoinDecimal.fromMillisatoshi(invoiceAmount), AnyPayment.DEFAULT_FEE_MULTIPLIER);
    return possibleTotal.map((total) => breakItDownInBtc(invoiceAmount, Millisatoshi.fromBitcoinDecimalFloor(total)));
  }

  // Defailed on the destination currency we want to use different conversions strategy:
  // * The original invoice is in BTC
  // * The real total at some point is provided in Lovelace
  // * BUT when we are presenting in BTC we want to show the original invoice amount.
  // * Otherwise we convert invoice amount to ADA.
  export const breakItDown = (
    invoiceAmount: Millisatoshi,
    total: Lovelace,
    fx: Fx,
    destCurrency: AnyAmountSymbol
  ): Result<PaymentBreakdown<AnyAmount>, string> => {
    const breakdownInCrypto: Result<PaymentBreakdown<CryptoAmount>, string> = (() => {
      switch(destCurrency) {
        case "BTC":
          return Fx.lovelace2Msat(fx, total)
            .map(totalInMsat => breakItDownInBtc(invoiceAmount, totalInMsat));
        default:
          return Fx.msat2Lovelace(fx, invoiceAmount)
            .map(invoiceInLovelace => breakItDownInAda(invoiceInLovelace, total));
      }
    })();
    return breakdownInCrypto.andThen((breakdown) =>
      PaymentBreakdown.traverse(breakdown, (amount) =>
        AmountFx.crypto2Any(fx, amount, destCurrency)).mapErr(
          // The original error is a map - possible error per field
          // TODO: We should flatten it better.
          detailedError => stringify(detailedError)
        )
    )
  }
};

export type ChequeIssuingError =
  | { type: "ChannelNotOperational", message: "The channel is not operational" }
  | { type: "OverspendsChannel", message: "Total sum of the cheques will exceed the channel capacity" }
  | { type: "TimeoutInThePast"; message: "Cheque timeout has to be in the future" }

// Invariants:
// * `confirmed` contains the full payment history as `secrets` represent transfer confirmation,
// * `failed` contains the cheques which are not included in the squash hence we squash
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
// * Given the above the squash body together with failed cheques (failed + faieldFailed)
//  should represent the current L2 state. The `confirmed` can be considered to be only
//  informational.
// * We eagerly update the squash whenever we have opportunity to sign.
// * We eagerly sync the squash with the backend but the difference between
// the current `squashBody` vs `squash` vs `squashingInfo.lastValue` should
// give us full picture about the state of the channel and sychronisation.
export class Channel {
  public readonly l1: L1Channel;
  public readonly adaptorUrl: AdaptorUrl;

  public failed: FailedPayment[];
  public confirmed: ConfirmedPayment[];
  public expired: ExpiredPayment[];

  public squashBody: SquashBody;
  public squash: Squash | null;
  public squashingInfo: PollingInfo<{ squash: Squash; response: SquashResponse }>;

  private constructor(
    l1: L1Channel,
    failed: FailedPayment[],
    confirmed: ConfirmedPayment[],
    expired: ExpiredPayment[],
    squashBody: SquashBody,
    squash: Squash | null,
    adaptorUrl: AdaptorUrl,
    squashingInfo?: PollingInfo<{ squash: Squash; response: SquashResponse }>
  ) {
    this.l1 = l1;
    this.failed = failed;
    this.confirmed = confirmed;
    this.expired = expired;
    this.adaptorUrl = adaptorUrl;
    this.squashBody = squashBody;
    this.squash = squash;
    this.squashingInfo = squashingInfo || new PollingInfo(null);
  }

  public static load(
    l1: L1Channel,
    failed: FailedPayment[],
    confirmed: ConfirmedPayment[],
    expired: ExpiredPayment[],
    squashBody: SquashBody,
    squash: Squash | null,
    adaptorUrl: AdaptorUrl,
    squashingInfo?: PollingInfo<{ squash: Squash; response: SquashResponse }>
  ): Result<Channel, JsonError> {
    const vKey = l1.consumerVerificationKey;
    for(const { cheque } of [...failed]) {
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
    return ok(new Channel(l1, failed, confirmed, expired, squashBody, squash, adaptorUrl, squashingInfo));
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

  public MIN_ADA = Lovelace.fromAda(Ada.fromDigits(2));

  public get totalEffectiveSubmittedCapacity(): Lovelace | null {
    if(this.totalSubmittedCapacity == null) return null;
    return Lovelace.subtractAbs(this.totalSubmittedCapacity, this.MIN_ADA);
  }

  public get totalApprovedCapacity(): Lovelace | null {
    // FIXME: This is ugly shortcut. Fix this.
    if(!this.isFullySquashed) return Lovelace.zero;
    return Lovelace.subtract(this.l1.totalApprovedCapacity, this.MIN_ADA)
      .match(
        (capacity) => capacity,
        (_error) => null
      );
  }

  public get usedCapacity(): Lovelace {
    const used = this.failed.reduce(
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

  // FIXME?: Swallow some errors?
  // * Currently we short-circuiting on the first error.
  // * We have a rather restrictive strategy of validation which could
  // be revised - for example: if provided unlocked does not match
  // anything in our failed/pending queue we reject the whole batch.
  //
  // ADR: This method does not accept a signing key. The assumption
  // is that the it could be used in the context where the key vault
  // is locked.
  // This means that on the call site where the key is available a
  // separate call to `doSignSquash` should be made!
  private doUnlock(unlockedCheques: UnlockedCheque[]): Result<null, string> {
    const unlockPayment = <T extends FailedPayment>(
      unlocked: UnlockedCheque,
      payments: T[]
    ): Result<{ confirmedPayment: ConfirmedPayment; remaining: T[] } | null, string> => {
      const payment = payments.find(({ cheque: locked }) => Index.ord.areEqual(locked.body.index, unlocked.body.index));
      if(payment == null) return ok(null);
      if(!LockedChequeBody.areMatching(unlocked.body, payment.cheque.body))
        return err(`Unlocked cheque with index ${unlocked.body.index} does not match the failed cheque with the same index`);
      const remaining = payments.filter(({ cheque }) => cheque.body.index !== unlocked.body.index);
      const confirmedPayment = {
        cheque: unlocked,
        invoice: payment.invoice|| null
      } as ConfirmedPayment;
      return ok({ confirmedPayment, remaining });
    }

    const unlockSingle = (
      unlocked: UnlockedCheque,
      failed: FailedPayment[],
      confirmed: ConfirmedPayment[]
    ) => {
      const unlockFailedResult = unlockPayment(unlocked, failed);
      return unlockFailedResult.andThen(
        (possibleUnlock) => {
          if(possibleUnlock != null) {
            const { confirmedPayment, remaining } = possibleUnlock;
            return ok({
              failed: remaining,
              confirmed: [...confirmed, confirmedPayment]
            });
          }
          const possiblyConfirmed = confirmed.find(({ cheque }) =>
            Index.ord.areEqual(cheque.body.index, unlocked.body.index));
          // This is recovery scenario. Adaptor sent us previously confirmed cheque.
          if(possiblyConfirmed == null) {
            return err(`Unlocked cheque with index ${unlocked.body.index} does not match any failed or failed cheque and there is no confirmed cheque with the same index`);
          }
          if(!UnlockedChequeBody.areEqual(possiblyConfirmed.cheque.body, unlocked.body))
            return err(`Unlocked cheque with index ${unlocked.body.index} does not match the confirmed cheque with the same index`);
          return ok({ failed, confirmed });
        }
      );
    }
    let curr = { failed: this.failed, confirmed: this.confirmed };
    for(const u of unlockedCheques) {
      const result = unlockSingle(u, curr.failed, curr.confirmed);
      if(result.isErr()) return err(result.error);
      curr = result.value;
    }

    this.squashBody = Channel.mkSquashBody(
      this.squashBody,
      curr.confirmed,
      curr.failed
    );
    this.failed = curr.failed;
    this.confirmed = curr.confirmed;
    return ok(null);
  }

  public doL2Sync = async (sKey: Ed25519SigningKey, _recCounter: number = 10): Promise<Result<null, HttpEndpointError | string>> => {
    if(!this.isFullySquashed)
      this.doSignSquash(sKey);
    // `this.squash` can not be null because of the above squashing.
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
          const json = mkJson2SquashResponseCodec(
            this.l1.channelTag,
            this.l1.consumerVerificationKey
          ).serialise(squashResponse);
          return err(`Failed to sync the channel after 10 attempts. Last response: ${stringify(json, undefined, 2)}`);
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
  ): Promise<Result<ConfirmedPayment | FailedPayment, ChequeIssuingError>> => {
    const createdAt = ValidDate.now();
    return this.mkCheque(amount, timeout, invoice, sKey).match(
      async (cheque) => {
        // We push this internal object right away
        // to the pending queue as the next step pushes
        // it to the partner. If if the subsequent
        // `fetch` fails we can not really assume
        // that the message was not delivered.
        const payment: FailedPayment = {
          cheque,
          createdAt,
          error: null,
          invoice
        } as FailedPayment;
        this.failed.push(payment);

        const response =  await this.adaptorClient.chPay(cheque, invoice);
        return response.match(
          (payResponse) => {
            const paymentFailed = (error: ImmediatePaymentError) => {
              // We are mutating here the payment
              // which we already pushed into the failed.
              payment.error = error;
              payment.invoice = invoice;
              // Return a fresh object
              return ok({ cheque, createdAt, error, invoice });
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
            // If the cheque was unlocked we can squash it.
            this.doSignSquash(sKey);

            // Check if between unlockeds we received a cheque corresponding to the one we just issued.
            const confirmedPayment = this.confirmed.find(({ cheque }) =>
              Index.ord.areEqual(cheque.body.index, cheque.body.index)
            );
            if(confirmedPayment == null) return paymentFailed(CriticalError.make(
              "UnexpectedAdaptorResponse",
              "Received a squash proposal without the corresponding unlocked cheque in the unlockeds list"
            ));
            return ok(confirmedPayment);
          },
          (httpEndpointError) => {
            const paymentError = ImmediatePaymentError.fromHttpEndpointError(httpEndpointError);
            payment.invoice = invoice;
            payment.error = paymentError;
            return ok({
              cheque,
              createdAt,
              error: paymentError,
              invoice
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
  // * `squashBody` assignment then `confirmed` and `failed` update.
  private static mkSquashBody(
    prevSquashBody: SquashBody,
    confirmed: ConfirmedPayment[],
    failed: FailedPayment[]
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
    const exclude = failed
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

  public get createdAt(): ValidDate {
    return this.l1.openTx.created;
  }

  public get allPayments(): AnyPayment[] {
    return [...this.failed, ...this.confirmed, ...this.expired];
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
    return this.failed.length === 0;
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
    failed: jsonCodecs.arrayOf(FailedPayment.jsonCodec),
    squash_body: json2SquashBodyCodec,
    squash: jsonCodecs.nullable(json2SquashCodec),
    squashing_info: jsonCodecs.identityCodec,
  }), {
    deserialise: (r) => {
      const json2SquashingInfo = mkJson2SquashingInfoCodec(r.l1_channel.channelTag, r.l1_channel.consumerVerificationKey);
      return json2SquashingInfo.deserialise(r.squashing_info).andThen((squashingInfo) =>
        Channel.load(r.l1_channel, r.failed, r.confirmed, r.expired, r.squash_body, r.squash, r.adaptor_url, squashingInfo)
      );
    },
    serialise: (channel: Channel) => {
      const json2SquashingInfo = mkJson2SquashingInfoCodec(channel.channelTag, channel.consumerVerificationKey);
      return {
        adaptor_url: channel.adaptorUrl,
        confirmed: channel.confirmed,
        expired: channel.expired,
        l1_channel: channel.l1,
        failed: channel.failed,
        squash_body: channel.squashBody,
        squash: channel.squash,
        squashing_info: json2SquashingInfo.serialise(channel.squashingInfo),
      };
    }
  }
);
