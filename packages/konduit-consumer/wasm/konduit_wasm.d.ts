/* tslint:disable */
/* eslint-disable */

export class CardanoConnector {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    balance(verification_key: Uint8Array): Promise<bigint>;
    static new(base_url: string, http_timeout_ms?: bigint | null): Promise<CardanoConnector>;
    submit(transaction: TransactionReadyForSigning): Promise<Uint8Array>;
    readonly network: Network;
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

export enum LogLevel {
    Trace = 0,
    Debug = 1,
    Info = 2,
    Warn = 3,
    Error = 4,
}

export enum Network {
    Mainnet = 0,
    Preview = 1,
    Preprod = 2,
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
 * A network identifier to protect misuses of addresses or transactions on a wrong network.
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
 * A transaction output, which comprises of at least an Address and a Value.
 */
export class Output {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static new(address: string, amount: bigint): Output;
    static to(address: string): Output;
    toString(): string;
    withAssets(assets: OutputAssets): void;
}

export class OutputAssets {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static empty(): OutputAssets;
    insert(script_hash: Uint8Array, asset_name: Uint8Array, quantity: bigint): void;
}

export class OutputValue {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static new(lovelace: bigint): OutputValue;
    withAssets(assets: OutputAssets): void;
    withLovelace(lovelace: bigint): void;
}

/**
 * Protocol parameters restricted to the set immediately useful to this library.
 */
export class ProtocolParameters {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static mainnet(): ProtocolParameters;
    static preprod(): ProtocolParameters;
    static preview(): ProtocolParameters;
    toString(): string;
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
    append(resolved_input: ResolvedInput): ResolvedInputs;
    static empty(): ResolvedInputs;
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
    getId(): Uint8Array;
    sign(secret_key: Uint8Array): TransactionReadyForSigning;
    toCbor(): Uint8Array;
    toString(): string;
}

export function close(connector: CardanoConnector, tag: Uint8Array, consumer: Uint8Array): Promise<TransactionReadyForSigning>;

export function enableLogs(level: LogLevel): void;

export function networkAsMagic(network: Network): bigint;

export function networkIsMainnet(network: Network): boolean;

export function networkIsTestnet(network: Network): boolean;

export function networkToString(network: Network): string;

export function open(connector: CardanoConnector, tag: Uint8Array, consumer: Uint8Array, adaptor: Uint8Array, close_period: bigint, amount: bigint): Promise<TransactionReadyForSigning>;

export function toVerificationKey(signing_key: Uint8Array): Uint8Array;
