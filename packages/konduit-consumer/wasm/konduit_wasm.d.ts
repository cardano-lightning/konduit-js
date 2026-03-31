/* tslint:disable */
/* eslint-disable */

/**
 * @hidden
 */
declare class Error2 {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly message: string;
}
export { Error2 as Error }

/**
 * Consumer intent for an existing channel (add funds or close).
 */
export class Intent {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static add(amount: bigint): Intent;
    static close(): Intent;
}

/**
 * Intent associated with a channel tag (used by general tx builder).
 */
export class IntentWithTag {
    free(): void;
    [Symbol.dispose](): void;
    constructor(tag: Uint8Array, intent: Intent);
    readonly intent: Intent;
    readonly tag: Uint8Array;
}

/**
 * A log level to configure the logger.
 */
export enum LogLevel {
    Trace = 0,
    Debug = 1,
    Info = 2,
    Warn = 3,
    Error = 4,
}

/**
 * Network protocol parameters used to expose predefined network configs.
 */
export class Network {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static mainnet(): Network;
    static preprod(): Network;
    static preview(): Network;
}

/**
 * Open intent for a new channel.
 */
export class OpenIntent {
    free(): void;
    [Symbol.dispose](): void;
    constructor(channel_tag: Uint8Array, adaptor_vk: Uint8Array, close_period_sec: bigint, amount: bigint);
    readonly adaptorVk: Uint8Array;
    readonly amount: bigint;
    readonly closePeriodSec: bigint;
    readonly tag: Uint8Array;
}

/**
 * A reference to fully built transaction
 */
export class TransactionReadyForSigning {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    getId(): Uint8Array;
    sign(secret_key: Uint8Array): void;
    toCbor(): Uint8Array;
}

export function add_tx(channel_tag: Uint8Array, consumer_vk: Uint8Array, amount: bigint, funding_utxos: Uint8Array[], network: Network): TransactionReadyForSigning;

export function close_tx(channel_tag: Uint8Array, consumer_vk: Uint8Array, funding_utxos: Uint8Array[], network: Network): TransactionReadyForSigning;

/**
 * To be called once in the application life-cycle to make logs from Rust/Wasm displayed in the
 * browser console, and to install a hook on Rust internal panics in order to make them bubble as
 * plain JavaScript errors.
 */
export function enableLogsAndPanicHook(level: LogLevel): void;

export function fee_buffer(): bigint;

export function min_ada_buffer(): bigint;

export function open_tx(channel_tag: Uint8Array, consumer_vk: Uint8Array, adaptor_vk: Uint8Array, funding_utxos: Uint8Array[], network: Network, close_period_sec: bigint, amount: bigint): TransactionReadyForSigning;

export function tx(opens: OpenIntent[], intents: IntentWithTag[], consumer_vk: Uint8Array, funding_utxos: Uint8Array[], network: Network): TransactionReadyForSigning;
