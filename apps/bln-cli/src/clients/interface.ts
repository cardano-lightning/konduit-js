export interface Client {
  /**
   * Performs a health check by checking node info and channel status.
   */
  getHealth(): Promise<HealthResponse>;

  /**
   * Retrieves a list of previously issued invoices.
   */
  getInvoices(req: GetInvoicesRequest): Promise<InvoiceFull[]>;

  /**
   * Creates a new Lightning invoice.
   */
  makeInvoice(req: MakeInvoiceRequest): Promise<MakeInvoiceResponse>;

  /**
   * pay an invoice
   * */
  pay(req: PayRequest): Promise<PayResponse>;
}

export interface Config {
  baseUrl: string;
  credentials: string;
  tlsCertPath: string;
}

export interface NodeInfo {
  publicKey: string;
  synced: boolean;
  version: string;
  alias: string;
  numPendingChannels: number;
  numActiveChannels: number;
  blockHeight: number;
}

export interface Channel {
  pubkey: string;
  capacity: bigint;
  active: boolean;
  localBalance: bigint;
  remoteBalance: bigint;
  commitFee: bigint;
  unsettledBalance: bigint;
}

export interface HealthResponse {
  node: {
    publicKey: string;
    synced: boolean;
    version: string;
  };
  channels: Channel[];
}

export interface MakeInvoiceRequest {
  /** An optional description (BOLT 11 'description' field). */
  description?: string;
  /** The preimage hash (32 bytes). */
  hash?: Uint8Array;
  /** The invoice amount in milli-satoshis (msat). */
  amountMsat?: bigint;
  /** The hash of the description (32 bytes). */
  descriptionHash?: Uint8Array;
  /** The invoice expiry time in seconds  */
  expiry?: bigint;
  /** A fallback address for on-chain settlement. */
  fallbackAddr?: string;
  /** The minimum final CLTV expiry delta. */
  cltvExpiry?: bigint;
  /** An array of private routing hints (details omitted for brevity). */
  routeHints?: any[];
  /** Whether the invoice should include private route hints. */
  isPrivate?: boolean;
}

export interface MakeInvoiceResponse {
  paymentRequest: string;
  addIndex: bigint;
  paymentAddress: Uint8Array;
}

export interface GetInvoicesRequest {
  isPending?: boolean;
  indexOffset?: bigint;
  limit?: bigint;
  isReversed?: boolean;
  after?: bigint; // POSIX MILLISECONDS
  before?: bigint; // POSIX MILLISECONDS
}

export interface InvoiceFull {
  description: string;
  rPreimage: Uint8Array;
  rHash: Uint8Array;
  valueSat: bigint;
  valueMsat: bigint;
  isSettled: boolean;
  createdOn: bigint;
  settledOn: bigint;
  paymentRequest: string;
  descriptionHash: Uint8Array;
  expiry: bigint;
  fallbackAddr: string;
  cltvExpiry: bigint;
  routeHints: any[];
  isPrivate: boolean;
  addIndex: bigint;
  settleIndex: bigint;
  amountPaidSat: bigint;
  amountPaidMsat: bigint;
  state: string;
  htlcs: any[];
  features: any;
  isKeysend: boolean;
  paymentSecret: Uint8Array;
  isAmp: boolean;
  ampInvoiceState: any;
  isBlinded: boolean;
  blindedPathConfig: any;
}

export interface PayRequest {
  paymentRequest?: string;
  payee?: Uint8Array;
  amount?: bigint;
  paymentHash?: Uint8Array;
  paymentSecret?: Uint8Array;
  feeLimit?: bigint;
  finalCltvDelta?: number;
  timeoutSeconds?: number;
  feeLimitSat?: bigint;
  outgoingChannelId?: bigint;
  cltvLimit?: number;
  routeHints?: any[];
  payeeCustomRecords?: any;
  lastHopPubkey?: Uint8Array;
  allowSelfPayment?: boolean;
  payeeFeatures?: any[];
  maxParts?: number;
  noInflightUpdates?: boolean;
  outgoingChannelIds?: bigint[];
  maxShardSizeMsat?: bigint;
  isAmp?: boolean;
  timePref?: number;
  isCancelable?: boolean;
  firstHopCustomRecords?: any;
}

export interface PayResponse {
  rHash: Uint8Array;
  valueSat: bigint;
  creationDate: bigint;
  feeSat: bigint;
  rPreimage: Uint8Array;
  valueMsat: bigint;
  paymentRequest: string;
  status: string;
  feeMsat: bigint;
  creationTimeNs: bigint;
  htlcs: any[];
  paymentIndex: bigint;
  failureReason: string;
  firstHopCustomRecords: any;
}
