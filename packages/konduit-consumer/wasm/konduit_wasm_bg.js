export class CardanoConnector {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(CardanoConnector.prototype);
        obj.__wbg_ptr = ptr;
        CardanoConnectorFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CardanoConnectorFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_cardanoconnector_free(ptr, 0);
    }
    /**
     * @param {Uint8Array} verification_key
     * @returns {Promise<bigint>}
     */
    balance(verification_key) {
        const ptr0 = passArray8ToWasm0(verification_key, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.cardanoconnector_balance(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
     * @returns {bigint}
     */
    get network_magic_number() {
        const ret = wasm.cardanoconnector_network_magic_number(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * @param {string} base_url
     * @param {number | null} [http_timeout_ms]
     * @returns {Promise<CardanoConnector>}
     */
    static new(base_url, http_timeout_ms) {
        const ptr0 = passStringToWasm0(base_url, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.cardanoconnector_new(ptr0, len0, isLikeNone(http_timeout_ms) ? 0x100000001 : (http_timeout_ms) >>> 0);
        return ret;
    }
    /**
     * @param {TransactionReadyForSigning} transaction
     * @param {Uint8Array} signing_key
     * @returns {Promise<Uint8Array>}
     */
    signAndSubmit(transaction, signing_key) {
        _assertClass(transaction, TransactionReadyForSigning);
        const ptr0 = passArray8ToWasm0(signing_key, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.cardanoconnector_signAndSubmit(this.__wbg_ptr, transaction.__wbg_ptr, ptr0, len0);
        return ret;
    }
}
if (Symbol.dispose) CardanoConnector.prototype[Symbol.dispose] = CardanoConnector.prototype.free;

/**
 * A reference to a past transaction output.
 */
export class Input {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        InputFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_input_free(ptr, 0);
    }
    /**
     * @param {Uint8Array} transaction_id
     * @param {bigint} output_index
     */
    constructor(transaction_id, output_index) {
        const ptr0 = passArray8ToWasm0(transaction_id, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.input__wasm_new(ptr0, len0, output_index);
        this.__wbg_ptr = ret >>> 0;
        InputFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {string}
     */
    toString() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.input_toString(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) Input.prototype[Symbol.dispose] = Input.prototype.free;

/**
 * @enum {0 | 1 | 2 | 3 | 4}
 */
export const LogLevel = Object.freeze({
    Trace: 0, "0": "Trace",
    Debug: 1, "1": "Debug",
    Info: 2, "2": "Info",
    Warn: 3, "3": "Warn",
    Error: 4, "4": "Error",
});

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
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(NetworkId.prototype);
        obj.__wbg_ptr = ptr;
        NetworkIdFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        NetworkIdFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_networkid_free(ptr, 0);
    }
    /**
     * @returns {NetworkId}
     */
    static mainnet() {
        const ret = wasm.networkid_mainnet();
        return NetworkId.__wrap(ret);
    }
    /**
     * @returns {NetworkId}
     */
    static testnet() {
        const ret = wasm.networkid_testnet();
        return NetworkId.__wrap(ret);
    }
    /**
     * @returns {string}
     */
    toString() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.networkid_toString(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) NetworkId.prototype[Symbol.dispose] = NetworkId.prototype.free;

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
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Output.prototype);
        obj.__wbg_ptr = ptr;
        OutputFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        OutputFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_output_free(ptr, 0);
    }
    /**
     * @param {string} address
     * @param {bigint} amount
     * @returns {Output}
     */
    static new(address, amount) {
        const ptr0 = passStringToWasm0(address, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.output_new(ptr0, len0, amount);
        return Output.__wrap(ret);
    }
    /**
     * @param {string} address
     * @returns {Output}
     */
    static to(address) {
        const ptr0 = passStringToWasm0(address, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.output_to(ptr0, len0);
        return Output.__wrap(ret);
    }
    /**
     * @returns {string}
     */
    toString() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.output_toString(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {OutputAssets} assets
     */
    withAssets(assets) {
        _assertClass(assets, OutputAssets);
        wasm.output_withAssets(this.__wbg_ptr, assets.__wbg_ptr);
    }
}
if (Symbol.dispose) Output.prototype[Symbol.dispose] = Output.prototype.free;

export class OutputAssets {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(OutputAssets.prototype);
        obj.__wbg_ptr = ptr;
        OutputAssetsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        OutputAssetsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_outputassets_free(ptr, 0);
    }
    /**
     * @returns {OutputAssets}
     */
    static empty() {
        const ret = wasm.outputassets_empty();
        return OutputAssets.__wrap(ret);
    }
    /**
     * @param {Uint8Array} script_hash
     * @param {Uint8Array} asset_name
     * @param {bigint} quantity
     */
    insert(script_hash, asset_name, quantity) {
        const ptr0 = passArray8ToWasm0(script_hash, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(asset_name, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        wasm.outputassets_insert(this.__wbg_ptr, ptr0, len0, ptr1, len1, quantity);
    }
}
if (Symbol.dispose) OutputAssets.prototype[Symbol.dispose] = OutputAssets.prototype.free;

export class OutputValue {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(OutputValue.prototype);
        obj.__wbg_ptr = ptr;
        OutputValueFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        OutputValueFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_outputvalue_free(ptr, 0);
    }
    /**
     * @param {bigint} lovelace
     * @returns {OutputValue}
     */
    static new(lovelace) {
        const ret = wasm.outputvalue_new(lovelace);
        return OutputValue.__wrap(ret);
    }
    /**
     * @param {OutputAssets} assets
     */
    withAssets(assets) {
        _assertClass(assets, OutputAssets);
        wasm.outputvalue_withAssets(this.__wbg_ptr, assets.__wbg_ptr);
    }
    /**
     * @param {bigint} lovelace
     */
    withLovelace(lovelace) {
        wasm.outputvalue_withLovelace(this.__wbg_ptr, lovelace);
    }
}
if (Symbol.dispose) OutputValue.prototype[Symbol.dispose] = OutputValue.prototype.free;

/**
 * Protocol parameters restricted to the set immediately useful to this library.
 */
export class ProtocolParameters {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(ProtocolParameters.prototype);
        obj.__wbg_ptr = ptr;
        ProtocolParametersFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ProtocolParametersFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_protocolparameters_free(ptr, 0);
    }
    /**
     * @returns {ProtocolParameters}
     */
    static mainnet() {
        const ret = wasm.protocolparameters_mainnet();
        return ProtocolParameters.__wrap(ret);
    }
    /**
     * @returns {ProtocolParameters}
     */
    static preprod() {
        const ret = wasm.protocolparameters_preprod();
        return ProtocolParameters.__wrap(ret);
    }
    /**
     * @returns {ProtocolParameters}
     */
    static preview() {
        const ret = wasm.protocolparameters_preview();
        return ProtocolParameters.__wrap(ret);
    }
    /**
     * @returns {string}
     */
    toString() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.protocolparameters_toString(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {BigInt64Array} cost_model
     * @returns {ProtocolParameters}
     */
    withPlutusV3CostModel(cost_model) {
        const ptr = this.__destroy_into_raw();
        const ptr0 = passArray64ToWasm0(cost_model, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.protocolparameters_withPlutusV3CostModel(ptr, ptr0, len0);
        return ProtocolParameters.__wrap(ret);
    }
}
if (Symbol.dispose) ProtocolParameters.prototype[Symbol.dispose] = ProtocolParameters.prototype.free;

export class ResolvedInput {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResolvedInputFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_resolvedinput_free(ptr, 0);
    }
    /**
     * @param {Input} input
     * @param {Output} output
     */
    constructor(input, output) {
        _assertClass(input, Input);
        _assertClass(output, Output);
        const ret = wasm.resolvedinput_new(input.__wbg_ptr, output.__wbg_ptr);
        this.__wbg_ptr = ret >>> 0;
        ResolvedInputFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {string}
     */
    toString() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resolvedinput_toString(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) ResolvedInput.prototype[Symbol.dispose] = ResolvedInput.prototype.free;

export class ResolvedInputs {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(ResolvedInputs.prototype);
        obj.__wbg_ptr = ptr;
        ResolvedInputsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResolvedInputsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_resolvedinputs_free(ptr, 0);
    }
    /**
     * @param {ResolvedInput} resolved_input
     * @returns {ResolvedInputs}
     */
    append(resolved_input) {
        const ptr = this.__destroy_into_raw();
        _assertClass(resolved_input, ResolvedInput);
        var ptr0 = resolved_input.__destroy_into_raw();
        const ret = wasm.resolvedinputs_append(ptr, ptr0);
        return ResolvedInputs.__wrap(ret);
    }
    /**
     * @returns {ResolvedInputs}
     */
    static empty() {
        const ret = wasm.resolvedinputs_empty();
        return ResolvedInputs.__wrap(ret);
    }
    /**
     * @returns {string}
     */
    toString() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resolvedinputs_toString(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) ResolvedInputs.prototype[Symbol.dispose] = ResolvedInputs.prototype.free;

export class StrError {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(StrError.prototype);
        obj.__wbg_ptr = ptr;
        StrErrorFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        StrErrorFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_strerror_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    toString() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.strerror_toString(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) StrError.prototype[Symbol.dispose] = StrError.prototype.free;

export class TransactionReadyForSigning {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(TransactionReadyForSigning.prototype);
        obj.__wbg_ptr = ptr;
        TransactionReadyForSigningFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        TransactionReadyForSigningFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_transactionreadyforsigning_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    toString() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.transactionreadyforsigning_toString(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) TransactionReadyForSigning.prototype[Symbol.dispose] = TransactionReadyForSigning.prototype.free;

/**
 * @param {CardanoConnector} connector
 * @param {Uint8Array} tag
 * @param {Uint8Array} consumer
 * @param {Uint8Array} adaptor
 * @param {string} script_ref
 * @returns {Promise<TransactionReadyForSigning>}
 */
export function close(connector, tag, consumer, adaptor, script_ref) {
    _assertClass(connector, CardanoConnector);
    const ptr0 = passArray8ToWasm0(tag, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(consumer, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(adaptor, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passStringToWasm0(script_ref, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len3 = WASM_VECTOR_LEN;
    const ret = wasm.close(connector.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
    return ret;
}

/**
 * @param {LogLevel} level
 */
export function enableLogs(level) {
    wasm.enableLogs(level);
}

/**
 * @param {CardanoConnector} connector
 * @param {Uint8Array} tag
 * @param {Uint8Array} consumer
 * @param {Uint8Array} adaptor
 * @param {bigint} close_period
 * @param {bigint} amount
 * @returns {Promise<TransactionReadyForSigning>}
 */
export function open(connector, tag, consumer, adaptor, close_period, amount) {
    _assertClass(connector, CardanoConnector);
    const ptr0 = passArray8ToWasm0(tag, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(consumer, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(adaptor, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.open(connector.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, close_period, amount);
    return ret;
}

/**
 * @param {Uint8Array} signing_key
 * @returns {Uint8Array}
 */
export function toVerificationKey(signing_key) {
    const ptr0 = passArray8ToWasm0(signing_key, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.toVerificationKey(ptr0, len0);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}
export function __wbg___wbindgen_debug_string_0bc8482c6e3508ae(arg0, arg1) {
    const ret = debugString(arg1);
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
export function __wbg___wbindgen_is_function_0095a73b8b156f76(arg0) {
    const ret = typeof(arg0) === 'function';
    return ret;
}
export function __wbg___wbindgen_is_undefined_9e4d92534c42d778(arg0) {
    const ret = arg0 === undefined;
    return ret;
}
export function __wbg___wbindgen_string_get_72fb696202c56729(arg0, arg1) {
    const obj = arg1;
    const ret = typeof(obj) === 'string' ? obj : undefined;
    var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
export function __wbg___wbindgen_throw_be289d5034ed271b(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
}
export function __wbg__wbg_cb_unref_d9b87ff7982e3b21(arg0) {
    arg0._wbg_cb_unref();
}
export function __wbg_abort_2f0584e03e8e3950(arg0) {
    arg0.abort();
}
export function __wbg_call_389efe28435a9388() { return handleError(function (arg0, arg1) {
    const ret = arg0.call(arg1);
    return ret;
}, arguments); }
export function __wbg_call_4708e0c13bdc8e95() { return handleError(function (arg0, arg1, arg2) {
    const ret = arg0.call(arg1, arg2);
    return ret;
}, arguments); }
export function __wbg_cardanoconnector_new(arg0) {
    const ret = CardanoConnector.__wrap(arg0);
    return ret;
}
export function __wbg_clearTimeout_5a54f8841c30079a(arg0) {
    const ret = clearTimeout(arg0);
    return ret;
}
export function __wbg_debug_a4099fa12db6cd61(arg0) {
    console.debug(arg0);
}
export function __wbg_error_7534b8e9a36f1ab4(arg0, arg1) {
    let deferred0_0;
    let deferred0_1;
    try {
        deferred0_0 = arg0;
        deferred0_1 = arg1;
        console.error(getStringFromWasm0(arg0, arg1));
    } finally {
        wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
    }
}
export function __wbg_error_9a7fe3f932034cde(arg0) {
    console.error(arg0);
}
export function __wbg_fetch_a9bc66c159c18e19(arg0) {
    const ret = fetch(arg0);
    return ret;
}
export function __wbg_getTime_1e3cd1391c5c3995(arg0) {
    const ret = arg0.getTime();
    return ret;
}
export function __wbg_info_148d043840582012(arg0) {
    console.info(arg0);
}
export function __wbg_instanceof_Error_8573fe0b0b480f46(arg0) {
    let result;
    try {
        result = arg0 instanceof Error;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
}
export function __wbg_instanceof_Response_ee1d54d79ae41977(arg0) {
    let result;
    try {
        result = arg0 instanceof Response;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
}
export function __wbg_log_6b5ca2e6124b2808(arg0) {
    console.log(arg0);
}
export function __wbg_message_9ddc4b9a62a7c379(arg0) {
    const ret = arg0.message;
    return ret;
}
export function __wbg_method_a9e9b2fcba5440fb(arg0, arg1) {
    const ret = arg1.method;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
export function __wbg_name_446e25ef2cfdab5a(arg0) {
    const ret = arg0.name;
    return ret;
}
export function __wbg_new_074b505417ada2d9() { return handleError(function () {
    const ret = new URLSearchParams();
    return ret;
}, arguments); }
export function __wbg_new_0_73afc35eb544e539() {
    const ret = new Date();
    return ret;
}
export function __wbg_new_361308b2356cecd0() {
    const ret = new Object();
    return ret;
}
export function __wbg_new_64284bd487f9d239() { return handleError(function () {
    const ret = new Headers();
    return ret;
}, arguments); }
export function __wbg_new_8a6f238a6ece86ea() {
    const ret = new Error();
    return ret;
}
export function __wbg_new_b5d9e2fb389fef91(arg0, arg1) {
    try {
        var state0 = {a: arg0, b: arg1};
        var cb0 = (arg0, arg1) => {
            const a = state0.a;
            state0.a = 0;
            try {
                return wasm_bindgen__convert__closures_____invoke__h048a54d84a001304(a, state0.b, arg0, arg1);
            } finally {
                state0.a = a;
            }
        };
        const ret = new Promise(cb0);
        return ret;
    } finally {
        state0.a = state0.b = 0;
    }
}
export function __wbg_new_b949e7f56150a5d1() { return handleError(function () {
    const ret = new AbortController();
    return ret;
}, arguments); }
export function __wbg_new_c2f21774701ddac7() { return handleError(function (arg0, arg1) {
    const ret = new URL(getStringFromWasm0(arg0, arg1));
    return ret;
}, arguments); }
export function __wbg_new_no_args_1c7c842f08d00ebb(arg0, arg1) {
    const ret = new Function(getStringFromWasm0(arg0, arg1));
    return ret;
}
export function __wbg_new_with_str_a7c7f835549b152a() { return handleError(function (arg0, arg1) {
    const ret = new Request(getStringFromWasm0(arg0, arg1));
    return ret;
}, arguments); }
export function __wbg_new_with_str_and_init_a61cbc6bdef21614() { return handleError(function (arg0, arg1, arg2) {
    const ret = new Request(getStringFromWasm0(arg0, arg1), arg2);
    return ret;
}, arguments); }
export function __wbg_ok_87f537440a0acf85(arg0) {
    const ret = arg0.ok;
    return ret;
}
export function __wbg_queueMicrotask_0aa0a927f78f5d98(arg0) {
    const ret = arg0.queueMicrotask;
    return ret;
}
export function __wbg_queueMicrotask_5bb536982f78a56f(arg0) {
    queueMicrotask(arg0);
}
export function __wbg_resolve_002c4b7d9d8f6b64(arg0) {
    const ret = Promise.resolve(arg0);
    return ret;
}
export function __wbg_search_143f09a35047e800(arg0, arg1) {
    const ret = arg1.search;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
export function __wbg_setTimeout_db2dbaeefb6f39c7() { return handleError(function (arg0, arg1) {
    const ret = setTimeout(arg0, arg1);
    return ret;
}, arguments); }
export function __wbg_set_6cb8631f80447a67() { return handleError(function (arg0, arg1, arg2) {
    const ret = Reflect.set(arg0, arg1, arg2);
    return ret;
}, arguments); }
export function __wbg_set_body_9a7e00afe3cfe244(arg0, arg1) {
    arg0.body = arg1;
}
export function __wbg_set_headers_cfc5f4b2c1f20549(arg0, arg1) {
    arg0.headers = arg1;
}
export function __wbg_set_method_c3e20375f5ae7fac(arg0, arg1, arg2) {
    arg0.method = getStringFromWasm0(arg1, arg2);
}
export function __wbg_set_search_1d369b0f3868e132(arg0, arg1, arg2) {
    arg0.search = getStringFromWasm0(arg1, arg2);
}
export function __wbg_set_signal_f2d3f8599248896d(arg0, arg1) {
    arg0.signal = arg1;
}
export function __wbg_signal_d1285ecab4ebc5ad(arg0) {
    const ret = arg0.signal;
    return ret;
}
export function __wbg_stack_0ed75d68575b0f3c(arg0, arg1) {
    const ret = arg1.stack;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
export function __wbg_static_accessor_GLOBAL_12837167ad935116() {
    const ret = typeof global === 'undefined' ? null : global;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_static_accessor_GLOBAL_THIS_e628e89ab3b1c95f() {
    const ret = typeof globalThis === 'undefined' ? null : globalThis;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_static_accessor_SELF_a621d3dfbb60d0ce() {
    const ret = typeof self === 'undefined' ? null : self;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_static_accessor_WINDOW_f8727f0cf888e0bd() {
    const ret = typeof window === 'undefined' ? null : window;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_status_89d7e803db911ee7(arg0) {
    const ret = arg0.status;
    return ret;
}
export function __wbg_strerror_new(arg0) {
    const ret = StrError.__wrap(arg0);
    return ret;
}
export function __wbg_stringify_8d1cc6ff383e8bae() { return handleError(function (arg0) {
    const ret = JSON.stringify(arg0);
    return ret;
}, arguments); }
export function __wbg_text_083b8727c990c8c0() { return handleError(function (arg0) {
    const ret = arg0.text();
    return ret;
}, arguments); }
export function __wbg_then_0d9fe2c7b1857d32(arg0, arg1, arg2) {
    const ret = arg0.then(arg1, arg2);
    return ret;
}
export function __wbg_then_b9e7b3b5f1a9e1b5(arg0, arg1) {
    const ret = arg0.then(arg1);
    return ret;
}
export function __wbg_toString_029ac24421fd7a24(arg0) {
    const ret = arg0.toString();
    return ret;
}
export function __wbg_toString_964ff7fe6eca8362(arg0) {
    const ret = arg0.toString();
    return ret;
}
export function __wbg_transactionreadyforsigning_new(arg0) {
    const ret = TransactionReadyForSigning.__wrap(arg0);
    return ret;
}
export function __wbg_url_36c39f6580d05409(arg0, arg1) {
    const ret = arg1.url;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
export function __wbg_warn_f7ae1b2e66ccb930(arg0) {
    console.warn(arg0);
}
export function __wbindgen_cast_0000000000000001(arg0, arg1) {
    // Cast intrinsic for `Closure(Closure { dtor_idx: 628, function: Function { arguments: [], shim_idx: 629, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
    const ret = makeMutClosure(arg0, arg1, wasm.wasm_bindgen__closure__destroy__hb6d864c6f9d47eef, wasm_bindgen__convert__closures_____invoke__hfe5275c36a769c7e);
    return ret;
}
export function __wbindgen_cast_0000000000000002(arg0, arg1) {
    // Cast intrinsic for `Closure(Closure { dtor_idx: 646, function: Function { arguments: [Externref], shim_idx: 647, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
    const ret = makeMutClosure(arg0, arg1, wasm.wasm_bindgen__closure__destroy__h773430c0ef9b0cff, wasm_bindgen__convert__closures_____invoke__h1f7b992ed16f23c5);
    return ret;
}
export function __wbindgen_cast_0000000000000003(arg0, arg1) {
    // Cast intrinsic for `Ref(String) -> Externref`.
    const ret = getStringFromWasm0(arg0, arg1);
    return ret;
}
export function __wbindgen_cast_0000000000000004(arg0) {
    // Cast intrinsic for `U64 -> Externref`.
    const ret = BigInt.asUintN(64, arg0);
    return ret;
}
export function __wbindgen_cast_0000000000000005(arg0, arg1) {
    var v0 = getArrayU8FromWasm0(arg0, arg1).slice();
    wasm.__wbindgen_free(arg0, arg1 * 1, 1);
    // Cast intrinsic for `Vector(U8) -> Externref`.
    const ret = v0;
    return ret;
}
export function __wbindgen_init_externref_table() {
    const table = wasm.__wbindgen_externrefs;
    const offset = table.grow(4);
    table.set(0, undefined);
    table.set(offset + 0, undefined);
    table.set(offset + 1, null);
    table.set(offset + 2, true);
    table.set(offset + 3, false);
}
function wasm_bindgen__convert__closures_____invoke__hfe5275c36a769c7e(arg0, arg1) {
    wasm.wasm_bindgen__convert__closures_____invoke__hfe5275c36a769c7e(arg0, arg1);
}

function wasm_bindgen__convert__closures_____invoke__h1f7b992ed16f23c5(arg0, arg1, arg2) {
    wasm.wasm_bindgen__convert__closures_____invoke__h1f7b992ed16f23c5(arg0, arg1, arg2);
}

function wasm_bindgen__convert__closures_____invoke__h048a54d84a001304(arg0, arg1, arg2, arg3) {
    wasm.wasm_bindgen__convert__closures_____invoke__h048a54d84a001304(arg0, arg1, arg2, arg3);
}

const CardanoConnectorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_cardanoconnector_free(ptr >>> 0, 1));
const InputFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_input_free(ptr >>> 0, 1));
const NetworkIdFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_networkid_free(ptr >>> 0, 1));
const OutputFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_output_free(ptr >>> 0, 1));
const OutputAssetsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_outputassets_free(ptr >>> 0, 1));
const OutputValueFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_outputvalue_free(ptr >>> 0, 1));
const ProtocolParametersFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_protocolparameters_free(ptr >>> 0, 1));
const ResolvedInputFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_resolvedinput_free(ptr >>> 0, 1));
const ResolvedInputsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_resolvedinputs_free(ptr >>> 0, 1));
const StrErrorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_strerror_free(ptr >>> 0, 1));
const TransactionReadyForSigningFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_transactionreadyforsigning_free(ptr >>> 0, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(state => state.dtor(state.a, state.b));

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedBigUint64ArrayMemory0 = null;
function getBigUint64ArrayMemory0() {
    if (cachedBigUint64ArrayMemory0 === null || cachedBigUint64ArrayMemory0.byteLength === 0) {
        cachedBigUint64ArrayMemory0 = new BigUint64Array(wasm.memory.buffer);
    }
    return cachedBigUint64ArrayMemory0;
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function makeMutClosure(arg0, arg1, dtor, f) {
    const state = { a: arg0, b: arg1, cnt: 1, dtor };
    const real = (...args) => {

        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            state.a = a;
            real._wbg_cb_unref();
        }
    };
    real._wbg_cb_unref = () => {
        if (--state.cnt === 0) {
            state.dtor(state.a, state.b);
            state.a = 0;
            CLOSURE_DTORS.unregister(state);
        }
    };
    CLOSURE_DTORS.register(real, state, state);
    return real;
}

function passArray64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getBigUint64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;


let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}
