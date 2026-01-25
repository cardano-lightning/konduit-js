/* tslint:disable */
/* eslint-disable */
export function open(
  connector: CardanoConnector,
  tag: Uint8Array,
  consumer: Uint8Array,
  adaptor: Uint8Array,
  close_period: bigint,
  amount: bigint,
): Promise<TransactionReadyForSigning>;
export function toVerificationKey(signing_key: Uint8Array): Uint8Array;
export function enableLogs(level: LogLevel): void;
export function close(
  connector: CardanoConnector,
  tag: Uint8Array,
  consumer: Uint8Array,
  adaptor: Uint8Array,
  script_ref: string,
): Promise<TransactionReadyForSigning>;
export enum LogLevel {
  Trace = 0,
  Debug = 1,
  Info = 2,
  Warn = 3,
  Error = 4,
}
export class CardanoConnector {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  static new(base_url: string): Promise<CardanoConnector>;
  signAndSubmit(
    transaction: TransactionReadyForSigning,
    signing_key: Uint8Array,
  ): Promise<void>;
  balance(verification_key: Uint8Array): Promise<bigint>;
}
/**
 * A reference to a past transaction output.
 */
export class Input {
  free(): void;
  [Symbol.dispose](): void;
  constructor(transaction_id: Uint8Array, output_index: bigint);
  toString(): string;
}
/**
 * A network identifier to protect misuses of addresses or transactions on a wrong network.
 *
 * Note that you can convert to and from [`u8`] using [`u8::from`] and [`Self::try_from`]
 * respectively.:
 *
 * ```rust
 * # use cardano_tx_builder::{NetworkId};
 * assert_eq!(u8::from(NetworkId::TESTNET), 0);
 * assert_eq!(u8::from(NetworkId::MAINNET), 1);
 * ```
 *
 * ```rust
 * # use cardano_tx_builder::{NetworkId};
 * assert!(NetworkId::try_from(0_u8).is_ok_and(|network| network.is_testnet()));
 * assert!(NetworkId::try_from(1_u8).is_ok_and(|network| network.is_mainnet()));
 * ```
 */
export class NetworkId {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  static mainnet(): NetworkId;
  static testnet(): NetworkId;
  toString(): string;
}
/**
 * A transaction output, which comprises of at least an [`Address`] and a [`Value<u64>`].
 *
 * The value can be either explicit set using [`Self::new`] or defined to the minimum acceptable
 * by the protocol using [`Self::to`].
 *
 * Optionally, one can attach an [`Datum`] and/or a [`PlutusScript`] via
 * [`Self::with_datum`]/[`Self::with_datum_hash`] and [`Self::with_plutus_script`] respectively.
 *
 * <div class="warning">Native scripts as reference scripts aren't yet supported. Only Plutus
 * scripts are.</div>
 */
export class Output {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  static new(address: string, amount: bigint): Output;
  static to(address: string): Output;
  withAssets(assets: OutputAssets): void;
  toString(): string;
}
export class OutputAssets {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  static empty(): OutputAssets;
  insert(
    script_hash: Uint8Array,
    asset_name: Uint8Array,
    quantity: bigint,
  ): void;
}
export class OutputValue {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  static new(lovelace: bigint): OutputValue;
  withLovelace(lovelace: bigint): void;
  withAssets(assets: OutputAssets): void;
}
/**
 * Protocol parameters restricted to the set immediately useful to this library.
 */
export class ProtocolParameters {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  toString(): string;
  static mainnet(): ProtocolParameters;
  static preprod(): ProtocolParameters;
  static preview(): ProtocolParameters;
  withPlutusV3CostModel(cost_model: BigInt64Array): ProtocolParameters;
}
export class ResolvedInput {
  free(): void;
  [Symbol.dispose](): void;
  constructor(input: Input, output: Output);
  toString(): string;
}
export class ResolvedInputs {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  static empty(): ResolvedInputs;
  append(resolved_input: ResolvedInput): ResolvedInputs;
  toString(): string;
}
export class StrError {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  toString(): string;
}
export class TransactionReadyForSigning {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  toString(): string;
}

export type InitInput =
  | RequestInfo
  | URL
  | Response
  | BufferSource
  | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_resolvedinput_free: (a: number, b: number) => void;
  readonly resolvedinput_new: (a: number, b: number) => number;
  readonly resolvedinput_toString: (a: number) => [number, number];
  readonly __wbg_resolvedinputs_free: (a: number, b: number) => void;
  readonly resolvedinputs_empty: () => number;
  readonly resolvedinputs_append: (a: number, b: number) => number;
  readonly resolvedinputs_toString: (a: number) => [number, number];
  readonly open: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    g: number,
    h: bigint,
    i: bigint,
  ) => any;
  readonly toVerificationKey: (a: number, b: number) => [number, number];
  readonly enableLogs: (a: number) => void;
  readonly close: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    g: number,
    h: number,
    i: number,
  ) => any;
  readonly __wbg_strerror_free: (a: number, b: number) => void;
  readonly strerror_toString: (a: number) => [number, number];
  readonly __wbg_cardanoconnector_free: (a: number, b: number) => void;
  readonly cardanoconnector_new: (a: number, b: number) => any;
  readonly cardanoconnector_signAndSubmit: (
    a: number,
    b: number,
    c: number,
    d: number,
  ) => any;
  readonly cardanoconnector_balance: (a: number, b: number, c: number) => any;
  readonly __wbg_input_free: (a: number, b: number) => void;
  readonly input__wasm_new: (a: number, b: number, c: bigint) => number;
  readonly input_toString: (a: number) => [number, number];
  readonly __wbg_output_free: (a: number, b: number) => void;
  readonly output_new: (a: number, b: number, c: bigint) => number;
  readonly output_to: (a: number, b: number) => number;
  readonly output_withAssets: (a: number, b: number) => void;
  readonly output_toString: (a: number) => [number, number];
  readonly __wbg_outputvalue_free: (a: number, b: number) => void;
  readonly outputvalue_new: (a: bigint) => number;
  readonly outputvalue_withLovelace: (a: number, b: bigint) => void;
  readonly outputvalue_withAssets: (a: number, b: number) => void;
  readonly __wbg_outputassets_free: (a: number, b: number) => void;
  readonly outputassets_empty: () => number;
  readonly outputassets_insert: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: bigint,
  ) => void;
  readonly __wbg_networkid_free: (a: number, b: number) => void;
  readonly networkid_mainnet: () => number;
  readonly networkid_testnet: () => number;
  readonly networkid_toString: (a: number) => [number, number];
  readonly __wbg_protocolparameters_free: (a: number, b: number) => void;
  readonly protocolparameters_toString: (a: number) => [number, number];
  readonly protocolparameters_mainnet: () => number;
  readonly protocolparameters_preprod: () => number;
  readonly protocolparameters_preview: () => number;
  readonly protocolparameters_withPlutusV3CostModel: (
    a: number,
    b: number,
    c: number,
  ) => number;
  readonly __wbg_transactionreadyforsigning_free: (
    a: number,
    b: number,
  ) => void;
  readonly transactionreadyforsigning_toString: (a: number) => [number, number];
  readonly wasm_bindgen__convert__closures_____invoke__he0b91bb628a575ae: (
    a: number,
    b: number,
    c: any,
  ) => void;
  readonly wasm_bindgen__closure__destroy__h6e058345d5cedd9d: (
    a: number,
    b: number,
  ) => void;
  readonly wasm_bindgen__convert__closures_____invoke__h07aec053534da3d8: (
    a: number,
    b: number,
    c: any,
    d: any,
  ) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (
    a: number,
    b: number,
    c: number,
    d: number,
  ) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(
  module: { module: SyncInitInput } | SyncInitInput,
): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init(
  module_or_path?:
    | { module_or_path: InitInput | Promise<InitInput> }
    | InitInput
    | Promise<InitInput>,
): Promise<InitOutput>;
