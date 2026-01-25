/* A tiny wrappings around the wasm which provides some more typing */

import * as wasm from "../../wasm/konduit_wasm.js";
export type { CardanoConnector as WasmCardanoConnector, TransactionReadyForSigning } from "../../wasm/konduit_wasm.js";
export { LogLevel } from "../../wasm/konduit_wasm.js";
import { extractPrvScalar, SKey, type Ed25519PrvScalar, type VKey } from "@konduit/cardano-keys";
import { Result } from "neverthrow";
import { Lovelace } from "../cardano";
import { stringifyAsyncThrowable } from "@konduit/codec/neverthrow";

// // export const enableLogs = (level: wasm.LogLevel): void => {
// //   wasm.enableLogs(level);
// // };
// // 
export class Connector {
  private connector: wasm.CardanoConnector;

  private constructor(connector: wasm.CardanoConnector) {
    this.connector = connector;
  }

  static async new(backendUrl: string): Promise<Result<Connector, string>> {
    return stringifyAsyncThrowable(async () => {
      const connector = await wasm.CardanoConnector.new(backendUrl);
      return new Connector(connector);
    });
  }

// //   async open(
// //     tag: ChannelTag,
// //     consumer: VKey,
// //     adaptor: VKey,
// //     closePeriod: Milliseconds,
// //     amount: Lovelace,
// //   ): Promise<Result<wasm.TransactionReadyForSigning, ConnectorError>> {
// //     try {
// //       const tx = await wasm.open(
// //         this.connector,
// //         tag as Uint8Array,
// //         consumer.getKey(),
// //         adaptor.getKey(),
// //         BigInt(closePeriod),
// //         amount,
// //       );
// //       return ok(tx);
// //     } catch (error) {
// //       return err(wrapError(error));
// //     }
// //   };
// // 
// //   async close(
// //     tag: ChannelTag,
// //     consumer: Ed25519VKey,
// //     adaptor: Ed25519VKey,
// //     scriptRef: string,
// //   ): Promise<Result<wasm.TransactionReadyForSigning, string>> {
// //     return close(this.cardanoConnector, tag, consumer, adaptor, scriptRef);
// // 
// //     stringifyAsyncThrowable(async () => await wasm.close(
// //         this.connector,
// //         tag as Uint8Array,
// //         consumer as Uint8Array,
// //         adaptor as Uint8Array,
// //         scriptRef,
// //       )
// //     );
// // 
// // 
// //   }
// // 
// // 
// // 
// //   }

    async signAndSubmit(
      transaction: wasm.TransactionReadyForSigning,
      sKey: SKey,
    ): Promise<Result<void, string>> {
      const keyScalar: Ed25519PrvScalar = extractPrvScalar(sKey.getKey());
      return stringifyAsyncThrowable(async () => {
        await this.connector.signAndSubmit(transaction, keyScalar);
      });
    }

    async balance(vKey: VKey): Promise<Result<Lovelace, void>> {
      const result = await stringifyAsyncThrowable(async () => {
         return await this.connector.balance(vKey.getKey());
      });
      return result.andThen((balance: bigint) => {
        return Lovelace.fromBigInt(balance);
      });
    }
}
