import * as wasm from "../wasm/konduit_wasm.js";

import { Ed25519PrivateKey } from "@konduit/cardano-keys/rfc8032";
import * as codec from "@konduit/codec";
import { err, ok, Result } from "neverthrow";
import { Lovelace, PublicNetwork, TransactionUnspentOutput, TxCborBytes, TxHash } from "./cardano";
import type { Seconds } from "./time/duration";
import { ChannelTag } from "./channel/core";
import type { ConsumerEd25519VerificationKey } from "./channel/core";
import type { AdaptorEd25519VerificationKey } from "./adaptorClient/adaptorInfo";
import { uint8Array2CborCodec } from "@konduit/codec/cbor/codecs/sync";

export const MIN_ADA_BUFFER: Lovelace = wasm.min_ada_buffer() as Lovelace;
export const TX_FEE_BUFFER: Lovelace = wasm.fee_buffer() as Lovelace;

export type Transaction = {
  prettyPrint: () => string;
  toCbor: () => TxCborBytes;
  txHash: () => TxHash;
  // This MUTATES THE transaction.
  sign: (ed25519PrivateKey: Ed25519PrivateKey) => Result<Transaction, WasmError>;
  _inner: wasm.TransactionReadyForSigning,
};

export const mkTransaction = (txReadyForSigning: wasm.TransactionReadyForSigning): Transaction => {
  return {
    prettyPrint: () => txReadyForSigning.toString(),
    toCbor: () => txReadyForSigning.toCbor() as TxCborBytes,
    txHash: () => {
      let txHashBytes = txReadyForSigning.getId();
      return TxHash.fromBytes(txHashBytes).match(
        (txHash: Uint8Array) => txHash as TxHash,
        (error: string) => {
          throw new Error(`Panic: tx hash returned from WASM has not passed validation: ${error}`);
        }
      );
    },
    sign: (ed25519PrivateKey: Ed25519PrivateKey) => {
      try {
        txReadyForSigning.sign(ed25519PrivateKey.secret);
        return ok(mkTransaction(txReadyForSigning));
      } catch (error) {
        return err(mkWasmError(error, null));
      }
    },
    _inner: txReadyForSigning,
  };
}

const mkWasmError = (error: unknown, contextMessage: string | null): WasmError => {
  const mkError = (msg: string) => {
    return {
      type: "WasmError",
      message: contextMessage ? `${contextMessage}: ${msg}` : msg,
    } as WasmError;
  }
  try {
    const message = (error as any).message;
    if (typeof message === "string") {
      return mkError(message);
    }
  } catch (e) {
    // If we fail to extract a message, we can still return the context message.
  }
  return mkError(String(error));
}
export type WasmError =
  | { type: "WasmError"; message: string };

export type BuildOpenTxError =
  | { type: "InsufficientFunding"; totalFunding: Lovelace; totalRequired: Lovelace }
  | WasmError;

export const buildOpenTx = (
  tag: ChannelTag,
  consumer: ConsumerEd25519VerificationKey,
  adaptor: AdaptorEd25519VerificationKey,
  funding_utxos: TransactionUnspentOutput[],
  publicNetwork: PublicNetwork,
  closePeriod: Seconds,
  amount: Lovelace,
): Result<Transaction, BuildOpenTxError> => {
  const totalFunding = Lovelace.unsafeAdd(Lovelace.zero, ...funding_utxos.map(utxo => utxo.output.value.lovelace));
  const totalRequired = Lovelace.unsafeAdd(amount, MIN_ADA_BUFFER, TX_FEE_BUFFER);
  if(Lovelace.ord.isGreaterThan(totalRequired, totalFunding))
    return err({
      type: "InsufficientFunding",
      totalFunding,
      totalRequired,
    });
  const wasmNetwork = (() => {
    switch (publicNetwork) {
      case "Mainnet": return wasm.Network.mainnet();
      case "Preprod": return wasm.Network.preprod();
      case "Preview": return wasm.Network.preview();
    }
  })();
  const uint8Array2TransactionUnspentOutputCodec = codec.pipe(
    uint8Array2CborCodec,
    TransactionUnspentOutput.cborCodec,
  );
  try {
    const tx = wasm.open_tx(
      tag,
      consumer.key,
      adaptor.key,
      funding_utxos.map((tux) => uint8Array2TransactionUnspentOutputCodec.serialise(tux)),
      wasmNetwork,
      BigInt(closePeriod),
      amount,
    );
    return ok(mkTransaction(tx));
  } catch (error) {
    // FIXME: Tx building errors should be improved on the Rust side and then handled
    // here nicely as well.
    return err(mkWasmError(error, null));
  }
};

// async buildCloseTx(
//   tag: ChannelTag,
//   consumer: ConsumerEd25519VerificationKey,
// ): Promise<Result<Transaction, string>> {
//   const transactionReadyForSigning = await stringifyAsyncThrowable(async () => await wasm.close(
//     this.connector,
//     tag,
//     consumer.key
//   ));
//   return transactionReadyForSigning.map((tx) => mkTransaction(tx));
// }
// 
