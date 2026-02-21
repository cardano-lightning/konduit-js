import { Result } from "neverthrow";
import type { HttpEndpointError } from "../http";
import {
  mkGetEndpoint,
  mkPostEndpoint,
  RequestSerialiser,
  ResponseDeserialiser,
} from "../http";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import {
  json2StringCodec,
  type JsonDeserialiser,
  type JsonError,
  json2BooleanCodec,
  type JsonCodec,
} from "@konduit/codec/json/codecs";
import {
  json2MillisatoshiCodec,
  type Millisatoshi,
} from "./asset";
import * as codec from "@konduit/codec";
import * as uint8Array from "@konduit/codec/uint8Array";
import { string2NumberCodec } from "@konduit/codec/urlquery/codecs/sync";
import {
  int2NonNegativeIntCodec,
  json2NonNegativeIntCodec,
  NonNegativeInt,
  number2IntCodec,
} from "@konduit/codec/integers/smallish";
import { json2NonNegativeBigIntCodec, json2NonNegativeBigIntThroughStringCodec, NonNegativeBigInt } from "@konduit/codec/integers/big";
import {
  decodedInvoice2InvoiceDeserialiser,
  type Invoice,
} from "./bolt11";
import { bolt11 } from "@konduit/bln";
import type { Json } from "@konduit/codec/json";
import { string2UrlQueryCodec, type UrlQuery } from "../../../codec/dist/urlquery/ast";

export type LndConfig = {
  baseUrl: string;
  macaroon: string;
};

export type AddInvoiceResponse = {
  addIndex: NonNegativeInt;
  paymentAddr: Uint8Array;
  invoice: Invoice;
  rHash: Uint8Array;
};

export type GetInfoChain = {
  chain: string;
  network: string;
};

export type GetInfoFeature = {
  name: string;
  is_required: boolean;
  is_known: boolean;
};

export type GetInfoResponse = {
  version: string;
  commit_hash: string;
  identity_pubkey: string;
  alias: string;
  color: string;
  num_pending_channels: NonNegativeInt;
  num_active_channels: NonNegativeInt;
  num_inactive_channels: NonNegativeInt;
  num_peers: NonNegativeInt;
  block_height: NonNegativeInt;
  block_hash: string;
  best_header_timestamp: NonNegativeBigInt;
  synced_to_chain: boolean;
  synced_to_graph: boolean;
  testnet: boolean;
  chains: GetInfoChain[];
  uris: string[];
  // features: Record<number, GetInfoFeature>;
};

export type GraphRoutesHop = {
  amt_to_forward: NonNegativeBigInt;
  amt_to_forward_msat: NonNegativeBigInt;
  blinding_point: Uint8Array;
  encrypted_data: Uint8Array;
  metadata: Uint8Array;
  chan_capacity: NonNegativeBigInt;
  chan_id: NonNegativeBigInt;
  expiry: NonNegativeBigInt;
  fee: NonNegativeBigInt;
  fee_msat: NonNegativeBigInt;
  pub_key: Uint8Array; // 33 bytes
  tlv_payload: boolean;
  total_amt_msat: NonNegativeBigInt;
};

export const json2GraphRoutesHopCodec: JsonCodec<GraphRoutesHop> = jsonCodecs.objectOf({
  amt_to_forward: json2NonNegativeBigIntCodec,
  amt_to_forward_msat: json2NonNegativeBigIntCodec,
  blinding_point: uint8Array.json2Uint8ArrayThroughBase64Codec,
  encrypted_data: uint8Array.json2Uint8ArrayThroughBase64Codec,
  metadata: uint8Array.json2Uint8ArrayThroughBase64Codec,
  chan_capacity: json2NonNegativeBigIntCodec,
  chan_id: json2NonNegativeBigIntCodec,
  expiry: json2NonNegativeBigIntCodec,
  fee: json2NonNegativeBigIntCodec,
  fee_msat: json2NonNegativeBigIntCodec,
  pub_key: uint8Array.jsonCodec,
  tlv_payload: json2BooleanCodec,
  total_amt_msat: json2NonNegativeBigIntCodec,
});

export type GraphRoutesRoute = {
  custom_channel_data: string;
  first_hop_amount_msat: NonNegativeBigInt;
  hops: GraphRoutesHop[];
  total_amt: NonNegativeBigInt;
  total_amt_msat: NonNegativeBigInt;
  total_fees: NonNegativeBigInt;
  total_fees_msat: NonNegativeBigInt;
  total_time_lock: NonNegativeBigInt;
};

const json2GraphRouteCodec: JsonCodec<GraphRoutesRoute> = jsonCodecs.objectOf({
  custom_channel_data: json2StringCodec,
  first_hop_amount_msat: json2NonNegativeBigIntCodec,
  hops: jsonCodecs.arrayOf(json2GraphRoutesHopCodec),
  total_amt: json2NonNegativeBigIntCodec,
  total_amt_msat: json2NonNegativeBigIntCodec,
  total_fees: json2NonNegativeBigIntCodec,
  total_fees_msat: json2NonNegativeBigIntCodec,
  total_time_lock: json2NonNegativeBigIntCodec,
});

export type GraphRoutesResponse = {
  routes: GraphRoutesRoute[];
};

const json2GraphRoutesCodec: JsonCodec<GraphRoutesResponse> = jsonCodecs.objectOf({
  routes: jsonCodecs.arrayOf(json2GraphRouteCodec),
});

export type PaymentsFailureChannelUpdate = {
  base_fee: NonNegativeInt;
  chain_hash: string;
  chan_id: NonNegativeBigInt;
  channel_flags: NonNegativeInt;
  fee_rate: NonNegativeInt;
  htlc_maximum_msat: NonNegativeBigInt;
  htlc_minimum_msat: NonNegativeBigInt;
  message_flags: NonNegativeInt;
  signature: string;
  time_lock_delta: NonNegativeInt;
  timestamp: NonNegativeInt;
};

export const json2PaymentsFailureChannelUpdateCodec: JsonCodec<PaymentsFailureChannelUpdate> = jsonCodecs.objectOf({
  base_fee: json2NonNegativeIntCodec,
  chain_hash: json2StringCodec,
  chan_id: json2NonNegativeBigIntThroughStringCodec,
  channel_flags: json2NonNegativeIntCodec,
  fee_rate: json2NonNegativeIntCodec,
  htlc_maximum_msat: json2NonNegativeBigIntThroughStringCodec,
  htlc_minimum_msat: json2NonNegativeBigIntThroughStringCodec,
  message_flags: json2NonNegativeIntCodec,
  signature: json2StringCodec,
  time_lock_delta: json2NonNegativeIntCodec,
  timestamp: json2NonNegativeIntCodec,
});

export type PaymentsFailure = {
  code: string;
  channel_update: PaymentsFailureChannelUpdate | undefined;
  htlc_msat: string;
  onion_sha_256: string;
  cltv_expiry: NonNegativeInt;
  index: NonNegativeInt;
};

export const json2PaymentsFailureCodec: JsonCodec<PaymentsFailure> = jsonCodecs.objectOf({
  code: json2StringCodec,
  channel_update: jsonCodecs.optional(json2PaymentsFailureChannelUpdateCodec),
  htlc_msat: json2StringCodec,
  onion_sha_256: json2StringCodec,
  cltv_expiry: json2NonNegativeIntCodec,
  index: json2NonNegativeIntCodec,
});

export type PaymentsMppRecord = {
  payment_addr: Uint8Array;
  total_amt_msat: NonNegativeBigInt;
};

export const json2PaymentsMppRecordCodec: JsonCodec<PaymentsMppRecord> = jsonCodecs.objectOf({
  payment_addr: uint8Array.json2Uint8ArrayThroughBase64Codec,
  total_amt_msat: json2NonNegativeBigIntThroughStringCodec,
})

export type PaymentsAmpRecord = {
  root_share: Uint8Array;
  set_id: Uint8Array;
  child_index: NonNegativeInt;
};

const json2PaymentsAmpRecordCodec: JsonCodec<PaymentsAmpRecord> = jsonCodecs.objectOf({
  root_share: uint8Array.json2Uint8ArrayThroughBase64Codec,
  set_id: uint8Array.json2Uint8ArrayThroughBase64Codec,
  child_index: json2NonNegativeIntCodec,
});

export type PaymentsHop = {
  amp_record: PaymentsAmpRecord | undefined;
  amt_to_forward: NonNegativeBigInt;
  amt_to_forward_msat: NonNegativeBigInt;
  chan_capacity: NonNegativeBigInt;
  chan_id: NonNegativeBigInt;
  custom_records: Json; // Record<string, string>;
  expiry: NonNegativeInt;
  fee: NonNegativeBigInt;
  fee_msat: NonNegativeBigInt;
  mpp_record: PaymentsMppRecord | undefined;
  pub_key: Uint8Array; // 33 bytes
  tlv_payload: boolean;
};

const json2PaymentsHopCodec: JsonCodec<PaymentsHop> = jsonCodecs.objectOf({
  amp_record: jsonCodecs.optional(json2PaymentsAmpRecordCodec),
  amt_to_forward: json2NonNegativeBigIntThroughStringCodec,
  amt_to_forward_msat: json2NonNegativeBigIntThroughStringCodec,
  chan_capacity: json2NonNegativeBigIntThroughStringCodec,
  chan_id: json2NonNegativeBigIntThroughStringCodec,
  custom_records: codec.mkIdentityCodec(),
  expiry: json2NonNegativeIntCodec,
  fee: json2NonNegativeBigIntThroughStringCodec,
  fee_msat: json2NonNegativeBigIntThroughStringCodec,
  mpp_record: jsonCodecs.optional(json2PaymentsMppRecordCodec),
  pub_key: uint8Array.jsonCodec,
  tlv_payload: json2BooleanCodec,
});

export type PaymentsRoute = {
  hops: PaymentsHop[];
  total_amt: NonNegativeBigInt;
  total_amt_msat: NonNegativeBigInt;
  total_fees: NonNegativeBigInt;
  total_fees_msat: NonNegativeBigInt;
  total_time_lock: NonNegativeInt;
};

export const json2PaymentsRouteCodec: JsonCodec<PaymentsRoute> = jsonCodecs.objectOf({
  total_time_lock: json2NonNegativeIntCodec,
  total_fees: json2NonNegativeBigIntThroughStringCodec,
  total_amt: json2NonNegativeBigIntThroughStringCodec,
  total_fees_msat: json2NonNegativeBigIntThroughStringCodec,
  total_amt_msat: json2NonNegativeBigIntThroughStringCodec,
  hops: jsonCodecs.arrayOf(json2PaymentsHopCodec)
});

export type PaymentsHtlcAttempt = {
  attempt_id: NonNegativeBigInt,
  attempt_time_ns: NonNegativeBigInt
  failure: PaymentsFailure | undefined;
  preimage: Uint8Array | undefined;
  resolve_time_ns: NonNegativeBigInt;
  route: PaymentsRoute;
  status: string; // FIXME: This should be probably something similar to send status
};

export const json2PaymentsHtlcAttemptCodec: JsonCodec<PaymentsHtlcAttempt> = jsonCodecs.objectOf({
  attempt_id: json2NonNegativeBigIntThroughStringCodec,
  attempt_time_ns: json2NonNegativeBigIntThroughStringCodec,
  failure: jsonCodecs.optional(json2PaymentsFailureCodec),
  preimage: jsonCodecs.optional(uint8Array.json2Uint8ArrayThroughBase64Codec),
  resolve_time_ns: json2NonNegativeBigIntThroughStringCodec,
  route: json2PaymentsRouteCodec,
  status: json2StringCodec,
});

export type Payment = {
  creation_time_ns: NonNegativeBigInt;
  failure_reason: string;
  fee_msat: NonNegativeBigInt;
  fee_sat: NonNegativeBigInt;
  htlcs: PaymentsHtlcAttempt[];
  payment_hash: Uint8Array; // 32 bytes
  payment_index: NonNegativeBigInt;
  payment_preimage: Uint8Array | undefined; // 32 bytes if present
  payment_request: string;
  status: string;
  value_msat: NonNegativeBigInt;
  value_sat: NonNegativeBigInt;
};

export const json2PaymentCodec: JsonCodec<Payment> = jsonCodecs.objectOf({
  creation_time_ns: json2NonNegativeBigIntThroughStringCodec,
  failure_reason: json2StringCodec,
  fee_msat: json2NonNegativeBigIntThroughStringCodec,
  fee_sat: json2NonNegativeBigIntThroughStringCodec,
  htlcs: jsonCodecs.arrayOf(json2PaymentsHtlcAttemptCodec),
  payment_hash: uint8Array.jsonCodec,
  payment_index: json2NonNegativeBigIntThroughStringCodec,
  payment_preimage: jsonCodecs.optional(uint8Array.jsonCodec),
  payment_request: json2StringCodec,
  status: json2StringCodec,
  value_msat: json2NonNegativeBigIntThroughStringCodec,
  value_sat: json2NonNegativeBigIntThroughStringCodec,
})

export type PaymentsResponse = {
  payments: Payment[];
  first_index_offset: NonNegativeBigInt;
  last_index_offset: NonNegativeBigInt;
  total_num_payments: NonNegativeBigInt;
};

const json2PaymentsResponseCodec: JsonCodec<PaymentsResponse> = jsonCodecs.objectOf({
  payments: jsonCodecs.arrayOf(json2PaymentCodec),
  first_index_offset: json2NonNegativeBigIntThroughStringCodec,
  last_index_offset: json2NonNegativeBigIntThroughStringCodec,
  total_num_payments: json2NonNegativeBigIntThroughStringCodec,
});


export type PaymentsQuery = {
  includeIncomplete: boolean;
  indexOffset?: bigint;
  maxPayments?: bigint;
  reversed: boolean;
  countTotalPayments: boolean;
  creationDateStart?: bigint;
  creationDateEnd?: bigint;
};

const json2AddInvoiceResponseDeserialiser: JsonDeserialiser<AddInvoiceResponse> =
  codec.pipeDeserialisers(
    jsonCodecs
      .objectOf({
        add_index: codec.pipe(
          codec.pipe(json2StringCodec, string2NumberCodec),
          codec.pipe(number2IntCodec, int2NonNegativeIntCodec)
        ),
        payment_addr: uint8Array.json2Uint8ArrayThroughBase64Codec,
        payment_request: json2StringCodec,
        r_hash: uint8Array.json2Uint8ArrayThroughBase64Codec,
      })
      .deserialise,
    (obj) => {
      return bolt11
        .parse(obj.payment_request)
        .mapErr((err) => err as JsonError)
        .andThen(decodedInvoice2InvoiceDeserialiser)
        .map((invoice: Invoice) => {
          return {
            addIndex: obj.add_index,
            paymentAddr: obj.payment_addr,
            invoice,
            rHash: obj.r_hash,
          } as AddInvoiceResponse;
        });
    }
  );

const json2GetInfoCodec: JsonCodec<GetInfoResponse> = jsonCodecs.objectOf({
  alias: json2StringCodec,
  best_header_timestamp: json2NonNegativeBigIntThroughStringCodec,
  block_hash: json2StringCodec,
  block_height: json2NonNegativeIntCodec,
  chains: jsonCodecs.arrayOf(
    jsonCodecs.objectOf({
      chain: json2StringCodec,
      network: json2StringCodec,
    })
  ),
  color: json2StringCodec,
  commit_hash: json2StringCodec,
  identity_pubkey: json2StringCodec,
  num_active_channels: json2NonNegativeIntCodec,
  num_inactive_channels: json2NonNegativeIntCodec,
  num_peers: json2NonNegativeIntCodec,
  num_pending_channels: json2NonNegativeIntCodec,
  synced_to_chain: json2BooleanCodec,
  synced_to_graph: json2BooleanCodec,
  testnet: json2BooleanCodec,
  uris: jsonCodecs.arrayOf(json2StringCodec),
  version: json2StringCodec,
  // features: jsonCodecs.recordOf(
  //   jsonCodecs.string,
  //   jsonCodecs.objectOf({
  //     name: json2StringCodec,
  //     is_required: json2BooleanCodec,
  //     is_known: json2BooleanCodec,
  //   })
  // ),
});

export type RouterSendDestinationCustomRecords = Json; // Record<string, string>;

export type RouterSendDestination = {
  custom_records: RouterSendDestinationCustomRecords | undefined;
  pubkey: Uint8Array | undefined;
};

const json2RouterSendDestinationCodec: JsonCodec<RouterSendDestination> = jsonCodecs.objectOf({
  custom_records: jsonCodecs.optional(jsonCodecs.identityCodec),
  pubkey: jsonCodecs.optional(uint8Array.jsonCodec),
})

export type RouterSendAmpRecord = {
  child_index: NonNegativeBigInt;
  root_share: Uint8Array;
  set_id: Uint8Array;
};

const json2RouterSendAmpRecordCodec: JsonCodec<RouterSendAmpRecord> = jsonCodecs.objectOf({
  child_index: json2NonNegativeBigIntCodec,
  root_share: uint8Array.json2Uint8ArrayThroughBase64Codec,
  set_id: uint8Array.json2Uint8ArrayThroughBase64Codec,
});

export type RouterSendRequest = {
  allow_self_payment: boolean | undefined;
  amp: RouterSendAmpRecord | undefined;
  amt_msat: NonNegativeBigInt | undefined;
  dest: RouterSendDestination | undefined;
  fee_limit_msat: NonNegativeBigInt | undefined;
  last_hop_pubkey: Uint8Array | undefined;
  outgoing_chan_ids: NonNegativeBigInt[] | undefined;
  payment_request: string | undefined;
  timeout_seconds: NonNegativeInt | undefined;
};

export const json2RouterSendRequestCodec: JsonCodec<RouterSendRequest> = jsonCodecs.objectOf({
  allow_self_payment: jsonCodecs.optional(json2BooleanCodec),
  amp: jsonCodecs.optional(json2RouterSendAmpRecordCodec),
  amt_msat: jsonCodecs.optional(json2NonNegativeBigIntThroughStringCodec),
  dest: jsonCodecs.optional(json2RouterSendDestinationCodec),
  fee_limit_msat: jsonCodecs.optional(json2NonNegativeBigIntThroughStringCodec),
  last_hop_pubkey: jsonCodecs.optional(uint8Array.jsonCodec),
  outgoing_chan_ids: jsonCodecs.optional(
    jsonCodecs.arrayOf(json2NonNegativeBigIntThroughStringCodec)
  ),
  payment_request: jsonCodecs.optional(json2StringCodec),
  timeout_seconds: jsonCodecs.optional(json2NonNegativeIntCodec),
});

export type RouterSendFailureReason =
  | "FAILURE_REASON_ERROR"
  | "FAILURE_REASON_NONE"
  | "FAILURE_REASON_NO_ROUTE"
  | "FAILURE_REASON_TIMEOUT"

export const json2RouterSendFailureReasonCodec: JsonCodec<RouterSendFailureReason> = jsonCodecs.altJsonCodecs(
  [ jsonCodecs.constant("FAILURE_REASON_ERROR" as RouterSendFailureReason),
    jsonCodecs.constant("FAILURE_REASON_NONE" as RouterSendFailureReason),
    jsonCodecs.constant("FAILURE_REASON_NO_ROUTE" as RouterSendFailureReason),
    jsonCodecs.constant("FAILURE_REASON_TIMEOUT" as RouterSendFailureReason),
  ],
  (serError, serNone, serNoRoute, serTimeout) => (reason: RouterSendFailureReason) => {
    switch (reason) {
      case "FAILURE_REASON_ERROR":
        return serError(reason);
      case "FAILURE_REASON_NONE":
        return serNone(reason);
      case "FAILURE_REASON_NO_ROUTE":
        return serNoRoute(reason);
      case "FAILURE_REASON_TIMEOUT":
        return serTimeout(reason);
    }
  }
);

export type RouterSendStatus = "IN_FLIGHT" | "SUCCEEDED" | "FAILED";

export const json2RouterSendStatusCodec: JsonCodec<RouterSendStatus> = jsonCodecs.altJsonCodecs(
  [ jsonCodecs.constant("IN_FLIGHT" as RouterSendStatus),
    jsonCodecs.constant("SUCCEEDED" as RouterSendStatus),
    jsonCodecs.constant("FAILED" as RouterSendStatus),
  ],
  (serInFlight, serSucceeded, serFailed) => (status: RouterSendStatus) => {
    switch (status) {
      case "IN_FLIGHT":
        return serInFlight(status);
      case "SUCCEEDED":
        return serSucceeded(status);
      case "FAILED":
        return serFailed(status);
    }
  }
);


export type RouterSendHtlcHop = {
  chan_id: NonNegativeBigInt;
  chan_capacity: NonNegativeBigInt;
  amt_to_forward: NonNegativeBigInt;
  fee: NonNegativeBigInt;
  expiry: NonNegativeInt;
  amt_to_forward_msat: NonNegativeBigInt;
  fee_msat: NonNegativeBigInt;
  pub_key: Uint8Array;
  tlv_payload: boolean;
  custom_records: Json;
  mpp_record: PaymentsMppRecord | undefined;
  amp_record: PaymentsAmpRecord | undefined;
  metadata: string;
  blinding_point: string;
  encrypted_data: string;
  total_amt_msat: NonNegativeBigInt;
};

const json2RouterSendHtlcHopCodec: JsonCodec<RouterSendHtlcHop> =
  jsonCodecs.objectOf({
    chan_id: json2NonNegativeBigIntThroughStringCodec,
    chan_capacity: json2NonNegativeBigIntThroughStringCodec,
    amt_to_forward: json2NonNegativeBigIntThroughStringCodec,
    fee: json2NonNegativeBigIntThroughStringCodec,
    expiry: json2NonNegativeIntCodec,
    amt_to_forward_msat: json2NonNegativeBigIntThroughStringCodec,
    fee_msat: json2NonNegativeBigIntThroughStringCodec,
    pub_key: uint8Array.jsonCodec,
    tlv_payload: json2BooleanCodec,
    mpp_record: jsonCodecs.optional(json2PaymentsMppRecordCodec),
    amp_record: jsonCodecs.optional(json2PaymentsAmpRecordCodec),
    custom_records: codec.mkIdentityCodec(),
    metadata: json2StringCodec,
    blinding_point: json2StringCodec,
    encrypted_data: json2StringCodec,
    total_amt_msat: json2NonNegativeBigIntThroughStringCodec,
  });

export type RouterSendRoute = {
  total_time_lock: NonNegativeInt;
  total_fees: NonNegativeBigInt;
  total_amt: NonNegativeBigInt;
  hops: RouterSendHtlcHop[];
  total_fees_msat: NonNegativeBigInt;
  total_amt_msat: NonNegativeBigInt;
  first_hop_amount_msat: NonNegativeBigInt;
  custom_channel_data: string;
};

const json2RouterSendRouteCodec: JsonCodec<RouterSendRoute> = jsonCodecs.objectOf({
  total_time_lock: json2NonNegativeIntCodec,
  total_fees: json2NonNegativeBigIntThroughStringCodec,
  total_amt: json2NonNegativeBigIntThroughStringCodec,
  hops: jsonCodecs.arrayOf(json2RouterSendHtlcHopCodec),
  total_fees_msat: json2NonNegativeBigIntThroughStringCodec,
  total_amt_msat: json2NonNegativeBigIntThroughStringCodec,
  first_hop_amount_msat: json2NonNegativeBigIntThroughStringCodec,
  custom_channel_data: json2StringCodec,
});

export type RouterSendHtlcAttempt = {
  attempt_id: NonNegativeBigInt;
  attempt_time_ns: NonNegativeBigInt;
  failure: PaymentsFailure | undefined;
  preimage: Uint8Array;
  resolve_time_ns: NonNegativeBigInt;
  route: RouterSendRoute;
  status: RouterSendStatus;
};

const json2RouterSendHtlcAttemptCodec: JsonCodec<RouterSendHtlcAttempt> = jsonCodecs.objectOf({
  attempt_id: json2NonNegativeBigIntThroughStringCodec,
  attempt_time_ns: json2NonNegativeBigIntThroughStringCodec,
  failure: jsonCodecs.optional(json2PaymentsFailureCodec),
  preimage: uint8Array.json2Uint8ArrayThroughBase64Codec,
  resolve_time_ns: json2NonNegativeBigIntThroughStringCodec,
  route: json2RouterSendRouteCodec,
  status: json2RouterSendStatusCodec,
});

export type RouterSendPayment = {
  payment_hash: Uint8Array;
  value: NonNegativeBigInt;
  creation_date: NonNegativeBigInt;
  fee: NonNegativeBigInt;
  payment_preimage: Uint8Array;
  value_sat: NonNegativeBigInt;
  value_msat: NonNegativeBigInt;
  payment_request: string;
  status: RouterSendStatus;
  fee_sat: NonNegativeBigInt;
  fee_msat: NonNegativeBigInt;
  creation_time_ns: NonNegativeBigInt;
  htlcs: RouterSendHtlcAttempt[];
  payment_index: NonNegativeBigInt;
  failure_reason: RouterSendFailureReason;
  first_hop_custom_records: Json;
};

export const json2RouterSendPaymentCodec: JsonCodec<RouterSendPayment> = jsonCodecs.objectOf({
  payment_hash: uint8Array.jsonCodec,
  value: json2NonNegativeBigIntThroughStringCodec,
  creation_date: json2NonNegativeBigIntThroughStringCodec,
  fee: json2NonNegativeBigIntThroughStringCodec,
  payment_preimage: uint8Array.jsonCodec,
  value_sat: json2NonNegativeBigIntThroughStringCodec,
  value_msat: json2NonNegativeBigIntThroughStringCodec,
  payment_request: json2StringCodec,
  status: json2RouterSendStatusCodec,
  fee_sat: json2NonNegativeBigIntThroughStringCodec,
  fee_msat: json2NonNegativeBigIntThroughStringCodec,
  creation_time_ns: json2NonNegativeBigIntThroughStringCodec,
  htlcs: jsonCodecs.arrayOf(json2RouterSendHtlcAttemptCodec),
  payment_index: json2NonNegativeBigIntThroughStringCodec,
  failure_reason: json2RouterSendFailureReasonCodec,
  first_hop_custom_records: codec.mkIdentityCodec(),
})

export type RouterSendResponse = {
  payments: RouterSendPayment[];
};

const json2RouterSendResponseCodec: JsonCodec<RouterSendResponse> = codec.rmap(
  jsonCodecs.arrayOf(
    jsonCodecs.objectOf({
      result: json2RouterSendPaymentCodec,
    })
  ),
  (arr) => ({
    payments: arr.map((item) => item.result),
  }),
  (arr) => arr.payments.map((payment) => ({ result: payment }))
);

export type LndClient = {
  addLndInvoice: (
    msat: Millisatoshi,
    memo: string
  ) => Promise<Result<AddInvoiceResponse, HttpEndpointError>>;

  getInfo: () => Promise<Result<GetInfoResponse, HttpEndpointError>>;

  graphRoutes: (
    payeePubkey: Uint8Array, // 33 bytes
    amountMsat: Millisatoshi
  ) => Promise<Result<GraphRoutesResponse, HttpEndpointError>>;

  listPayments: (
    query: PaymentsQuery
  ) => Promise<Result<PaymentsResponse, HttpEndpointError>>;

  v2RouterSend: (
    body: RouterSendRequest
  ) => Promise<Result<RouterSendResponse, HttpEndpointError>>;
};

export const mkLndClient = (config: LndConfig): LndClient => {
  const addInvoiceEndpoint = mkPostEndpoint(
    `${config.baseUrl}/v1/invoices`,
    RequestSerialiser.fromJsonSerialiser(
      (body: { amount: Millisatoshi; memo: string }) => ({
        value_msat: json2MillisatoshiCodec.serialise(body.amount),
        memo: body.memo,
      })
    ),
    ResponseDeserialiser.fromJsonDeserialiser(
      json2AddInvoiceResponseDeserialiser
    )
  );

  const getInfoEndpoint = mkGetEndpoint(
    `${config.baseUrl}`,
    () => `/v1/getinfo`,
    ResponseDeserialiser.fromJsonDeserialiser(json2GetInfoCodec.deserialise),
  );

  const graphRoutesEndpoint = mkPostEndpoint(
    `${config.baseUrl}/v1/graph/routes`,
    RequestSerialiser.fromJsonSerialiser(
      (body: { payee: Uint8Array; amountMsat: Millisatoshi }) => ({
        // Rust uses /v1/graph/routes/{payee}/{amount_sat}
        // JSON body variant here; adjust path/body if your REST needs URL params instead.
        payee: uint8Array.jsonCodec.serialise(
          body.payee
        ),
        amount_msat: json2MillisatoshiCodec.serialise(body.amountMsat),
      })
    ),
    ResponseDeserialiser.fromJsonDeserialiser(json2GraphRoutesCodec.deserialise)
  );

  const paymentsEndpoint = mkGetEndpoint(
    `${config.baseUrl}`,
    (query: PaymentsQuery) => {
      const bool2Value = (b: boolean) => (b ? "true" : "false");
      const paramsRaw: Record<string, string | undefined> = {
        include_incomplete: bool2Value(query.includeIncomplete),
        index_offset:
          query.indexOffset !== undefined
            ? query.indexOffset.toString()
            : undefined,
        max_payments:
          query.maxPayments !== undefined
            ? query.maxPayments.toString()
            : undefined,
        reversed: bool2Value(query.reversed),
        count_total_payments: bool2Value(query.countTotalPayments),
        creation_date_start:
          query.creationDateStart !== undefined
            ? query.creationDateStart.toString()
            : undefined,
        creation_date_end:
          query.creationDateEnd !== undefined
            ? query.creationDateEnd.toString()
            : undefined,
      };
      // We should filter out all undefines
      const params: UrlQuery = Object.entries(paramsRaw).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as UrlQuery);

      const queryString = string2UrlQueryCodec.serialise(params);
      return `/v1/payments?${queryString}`;
    },
    ResponseDeserialiser.fromJsonDeserialiser(json2PaymentsResponseCodec.deserialise)
  );

  const v2RouterSendEndpoint = mkPostEndpoint(
    `${config.baseUrl}/v2/router/send`,
    RequestSerialiser.fromJsonSerialiser(json2RouterSendRequestCodec.serialise),
    ResponseDeserialiser.fromJsonDeserialiser(json2RouterSendResponseCodec.deserialise)
  );

  return {
    addLndInvoice: async (msat: Millisatoshi, memo: string) => {
      return await addInvoiceEndpoint(
        { amount: msat, memo },
        [["Grpc-Metadata-macaroon", config.macaroon]]
      );
    },

    getInfo: async () => {
      return await getInfoEndpoint(
        {},
        [["Grpc-Metadata-macaroon", config.macaroon]]
      );
    },

    graphRoutes: async (
      payeePubkey: Uint8Array,
      amountMsat: Millisatoshi
    ) => {
      return await graphRoutesEndpoint(
        { payee: payeePubkey, amountMsat },
        [["Grpc-Metadata-macaroon", config.macaroon]]
      );
    },

    listPayments: async (query: PaymentsQuery) => {
      return await paymentsEndpoint(query, [
        ["Grpc-Metadata-macaroon", config.macaroon],
      ]);
    },

    v2RouterSend: async (body: RouterSendRequest) => {
      return await v2RouterSendEndpoint(body, [
        ["Grpc-Metadata-macaroon", config.macaroon],
      ]);
    },
  };
};
