/* @ts-self-types="./konduit_wasm.d.ts" */

import * as wasm from "./konduit_wasm_bg.wasm";
import { __wbg_set_wasm } from "./konduit_wasm_bg.js";
__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export {
    Error, LogLevel, Network, TransactionReadyForSigning, enableLogsAndPanicHook, open_tx
} from "./konduit_wasm_bg.js";
