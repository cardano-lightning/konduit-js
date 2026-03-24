/**
 * @hidden
 */
class Error2 {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Error2.prototype);
        obj.__wbg_ptr = ptr;
        Error2Finalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        Error2Finalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_error_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get message() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.error_message(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) Error2.prototype[Symbol.dispose] = Error2.prototype.free;
export { Error2 as Error }

/**
 * Consumer intent for an existing channel (add funds or close).
 */
export class Intent {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Intent.prototype);
        obj.__wbg_ptr = ptr;
        IntentFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IntentFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_intent_free(ptr, 0);
    }
    /**
     * @param {bigint} amount
     * @returns {Intent}
     */
    static add(amount) {
        const ret = wasm.intent_add(amount);
        return Intent.__wrap(ret);
    }
    /**
     * @returns {Intent}
     */
    static close() {
        const ret = wasm.intent_close();
        return Intent.__wrap(ret);
    }
}
if (Symbol.dispose) Intent.prototype[Symbol.dispose] = Intent.prototype.free;

/**
 * Intent associated with a channel tag (used by general tx builder).
 */
export class IntentWithTag {
    static __unwrap(jsValue) {
        if (!(jsValue instanceof IntentWithTag)) {
            return 0;
        }
        return jsValue.__destroy_into_raw();
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IntentWithTagFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_intentwithtag_free(ptr, 0);
    }
    /**
     * @returns {Intent}
     */
    get intent() {
        const ret = wasm.intentwithtag_intent(this.__wbg_ptr);
        return Intent.__wrap(ret);
    }
    /**
     * @param {Uint8Array} tag
     * @param {Intent} intent
     */
    constructor(tag, intent) {
        const ptr0 = passArray8ToWasm0(tag, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        _assertClass(intent, Intent);
        var ptr1 = intent.__destroy_into_raw();
        const ret = wasm.intentwithtag_new(ptr0, len0, ptr1);
        this.__wbg_ptr = ret >>> 0;
        IntentWithTagFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {Uint8Array}
     */
    get tag() {
        const ret = wasm.intentwithtag_tag(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
}
if (Symbol.dispose) IntentWithTag.prototype[Symbol.dispose] = IntentWithTag.prototype.free;

/**
 * A log level to configure the logger.
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
 * Network protocol parameters used to expose predefined network configs.
 */
export class Network {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Network.prototype);
        obj.__wbg_ptr = ptr;
        NetworkFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        NetworkFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_network_free(ptr, 0);
    }
    /**
     * @returns {Network}
     */
    static mainnet() {
        const ret = wasm.network_mainnet();
        return Network.__wrap(ret);
    }
    /**
     * @returns {Network}
     */
    static preprod() {
        const ret = wasm.network_preprod();
        return Network.__wrap(ret);
    }
    /**
     * @returns {Network}
     */
    static preview() {
        const ret = wasm.network_preview();
        return Network.__wrap(ret);
    }
}
if (Symbol.dispose) Network.prototype[Symbol.dispose] = Network.prototype.free;

/**
 * Open intent for a new channel.
 */
export class OpenIntent {
    static __unwrap(jsValue) {
        if (!(jsValue instanceof OpenIntent)) {
            return 0;
        }
        return jsValue.__destroy_into_raw();
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        OpenIntentFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_openintent_free(ptr, 0);
    }
    /**
     * @returns {Uint8Array}
     */
    get adaptorVk() {
        const ret = wasm.openintent_adaptorVk(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {bigint}
     */
    get amount() {
        const ret = wasm.openintent_amount(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * @returns {bigint}
     */
    get closePeriodSec() {
        const ret = wasm.openintent_closePeriodSec(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * @param {Uint8Array} channel_tag
     * @param {Uint8Array} adaptor_vk
     * @param {bigint} close_period_sec
     * @param {bigint} amount
     */
    constructor(channel_tag, adaptor_vk, close_period_sec, amount) {
        const ptr0 = passArray8ToWasm0(channel_tag, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(adaptor_vk, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.openintent_new(ptr0, len0, ptr1, len1, close_period_sec, amount);
        this.__wbg_ptr = ret >>> 0;
        OpenIntentFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {Uint8Array}
     */
    get tag() {
        const ret = wasm.openintent_tag(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
}
if (Symbol.dispose) OpenIntent.prototype[Symbol.dispose] = OpenIntent.prototype.free;

/**
 * A reference to fully built transaction
 */
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
     * @returns {Uint8Array}
     */
    getId() {
        const ret = wasm.transactionreadyforsigning_getId(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @param {Uint8Array} secret_key
     */
    sign(secret_key) {
        const ptr0 = passArray8ToWasm0(secret_key, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.transactionreadyforsigning_sign(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @returns {Uint8Array}
     */
    toCbor() {
        const ret = wasm.transactionreadyforsigning_toCbor(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
}
if (Symbol.dispose) TransactionReadyForSigning.prototype[Symbol.dispose] = TransactionReadyForSigning.prototype.free;

/**
 * @param {Uint8Array} channel_tag
 * @param {Uint8Array} consumer_vk
 * @param {bigint} amount
 * @param {Uint8Array[]} funding_utxos
 * @param {Network} network
 * @returns {TransactionReadyForSigning}
 */
export function add_tx(channel_tag, consumer_vk, amount, funding_utxos, network) {
    const ptr0 = passArray8ToWasm0(channel_tag, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(consumer_vk, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayJsValueToWasm0(funding_utxos, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    _assertClass(network, Network);
    const ret = wasm.add_tx(ptr0, len0, ptr1, len1, amount, ptr2, len2, network.__wbg_ptr);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return TransactionReadyForSigning.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} channel_tag
 * @param {Uint8Array} consumer_vk
 * @param {Uint8Array[]} funding_utxos
 * @param {Network} network
 * @returns {TransactionReadyForSigning}
 */
export function close_tx(channel_tag, consumer_vk, funding_utxos, network) {
    const ptr0 = passArray8ToWasm0(channel_tag, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(consumer_vk, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayJsValueToWasm0(funding_utxos, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    _assertClass(network, Network);
    const ret = wasm.close_tx(ptr0, len0, ptr1, len1, ptr2, len2, network.__wbg_ptr);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return TransactionReadyForSigning.__wrap(ret[0]);
}

/**
 * To be called once in the application life-cycle to make logs from Rust/Wasm displayed in the
 * browser console, and to install a hook on Rust internal panics in order to make them bubble as
 * plain JavaScript errors.
 * @param {LogLevel} level
 */
export function enableLogsAndPanicHook(level) {
    const ret = wasm.enableLogsAndPanicHook(level);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}

/**
 * @returns {bigint}
 */
export function fee_buffer() {
    const ret = wasm.fee_buffer();
    return BigInt.asUintN(64, ret);
}

/**
 * @returns {bigint}
 */
export function min_ada_buffer() {
    const ret = wasm.min_ada_buffer();
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} channel_tag
 * @param {Uint8Array} consumer_vk
 * @param {Uint8Array} adaptor_vk
 * @param {Uint8Array[]} funding_utxos
 * @param {Network} network
 * @param {bigint} close_period_sec
 * @param {bigint} amount
 * @returns {TransactionReadyForSigning}
 */
export function open_tx(channel_tag, consumer_vk, adaptor_vk, funding_utxos, network, close_period_sec, amount) {
    const ptr0 = passArray8ToWasm0(channel_tag, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(consumer_vk, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(adaptor_vk, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayJsValueToWasm0(funding_utxos, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    _assertClass(network, Network);
    const ret = wasm.open_tx(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, network.__wbg_ptr, close_period_sec, amount);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return TransactionReadyForSigning.__wrap(ret[0]);
}

/**
 * @param {OpenIntent[]} opens
 * @param {IntentWithTag[]} intents
 * @param {Uint8Array} consumer_vk
 * @param {Uint8Array[]} funding_utxos
 * @param {Network} network
 * @returns {TransactionReadyForSigning}
 */
export function tx(opens, intents, consumer_vk, funding_utxos, network) {
    const ptr0 = passArrayJsValueToWasm0(opens, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayJsValueToWasm0(intents, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(consumer_vk, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayJsValueToWasm0(funding_utxos, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    _assertClass(network, Network);
    const ret = wasm.tx(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, network.__wbg_ptr);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return TransactionReadyForSigning.__wrap(ret[0]);
}
export function __wbg___wbindgen_throw_be289d5034ed271b(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
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
export function __wbg_error_new(arg0) {
    const ret = Error2.__wrap(arg0);
    return ret;
}
export function __wbg_info_148d043840582012(arg0) {
    console.info(arg0);
}
export function __wbg_intentwithtag_unwrap(arg0) {
    const ret = IntentWithTag.__unwrap(arg0);
    return ret;
}
export function __wbg_length_32ed9a279acd054c(arg0) {
    const ret = arg0.length;
    return ret;
}
export function __wbg_log_6b5ca2e6124b2808(arg0) {
    console.log(arg0);
}
export function __wbg_new_8a6f238a6ece86ea() {
    const ret = new Error();
    return ret;
}
export function __wbg_now_a3af9a2f4bbaa4d1() {
    const ret = Date.now();
    return ret;
}
export function __wbg_openintent_unwrap(arg0) {
    const ret = OpenIntent.__unwrap(arg0);
    return ret;
}
export function __wbg_prototypesetcall_bdcdcc5842e4d77d(arg0, arg1, arg2) {
    Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
}
export function __wbg_stack_0ed75d68575b0f3c(arg0, arg1) {
    const ret = arg1.stack;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
export function __wbg_warn_f7ae1b2e66ccb930(arg0) {
    console.warn(arg0);
}
export function __wbindgen_cast_0000000000000001(arg0, arg1) {
    // Cast intrinsic for `Ref(String) -> Externref`.
    const ret = getStringFromWasm0(arg0, arg1);
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
const Error2Finalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_error_free(ptr >>> 0, 1));
const IntentFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_intent_free(ptr >>> 0, 1));
const IntentWithTagFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_intentwithtag_free(ptr >>> 0, 1));
const NetworkFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_network_free(ptr >>> 0, 1));
const OpenIntentFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_openintent_free(ptr >>> 0, 1));
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

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
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

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayJsValueToWasm0(array, malloc) {
    const ptr = malloc(array.length * 4, 4) >>> 0;
    for (let i = 0; i < array.length; i++) {
        const add = addToExternrefTable0(array[i]);
        getDataViewMemory0().setUint32(ptr + 4 * i, add, true);
    }
    WASM_VECTOR_LEN = array.length;
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

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
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
