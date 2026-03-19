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

/**
 * To be called once in the application life-cycle to make logs from Rust/Wasm displayed in the
 * browser console, and to install a hook on Rust internal panics in order to make them bubble as
 * plain JavaScript errors.
 */
export function enableLogsAndPanicHook(level: LogLevel): void;

export function open_tx(channel_tag: Uint8Array, consumer_vk: Uint8Array, adaptor_vk: Uint8Array, funding_utxos: Uint8Array[], network: Network, close_period_sec: bigint, amount: bigint): TransactionReadyForSigning;
