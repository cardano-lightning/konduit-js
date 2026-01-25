/* A tiny wrappings around the wasm which provides some more typing */

// import * as wasm from "../../wasm/konduit_wasm.js";
// export type { CardanoConnector as WasmCardanoConnector, TransactionReadyForSigning } from "../../wasm/konduit_wasm.js";
// export { LogLevel } from "../../wasm/konduit_wasm.js";
// import type { VKey } from "@konduit/cardano-keys";
// import type { ChannelTag } from "./channel";
// import { ok, err, Result } from "neverthrow";
// import type { Milliseconds } from "../time/duration";
// import type { Lovelace } from "../cardano";
// import { stringifyAsyncThrowable } from "@konduit/codec/neverthrow";
// 
// // export const enableLogs = (level: wasm.LogLevel): void => {
// //   wasm.enableLogs(level);
// // };
// // 
// // export class Connector {
// //   private connector: wasm.CardanoConnector;
// // 
// //   private constructor(connector: wasm.CardanoConnector) {
// //     this.connector = connector;
// //   }
// // 
// //   static async new(baseUrl: string): Promise<Result<Connector, string>> {
// //     stringifyAsyncThrowable(async () => {
// //       const connector = await wasm.CardanoConnector.new(baseUrl);
// //       return ok(new Connector(connector));
// //     });
// //   }
// // 
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
// // 
// //   async signAndSubmit(
// //     transaction: wasm.TransactionReadyForSigning,
// //     signingKey: Ed25519VKey,
// //   ): Promise<Result<void, ConnectorError>> {
// //     try {
// //       await this.cardanoConnector.signAndSubmit(transaction, signingKey);
// //       return ok(undefined);
// //     } catch (error) {
// //       return err(wrapError(error));
// //     }
// //   }
// // 
// //   async balance(verificationKey: Ed25519VKey): Promise<Result<Lovelace, ConnectorError>> {
// //     try {
// //       const balance = await this.cardanoConnector.balance(verificationKey as Uint8Array);
// //       return ok(balance as Lovelace);
// //     } catch (error) {
// //       return err(wrapError(error));
// //     }
// //   }
// // }
