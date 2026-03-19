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

export type Transaction = {
  prettyPrint: () => string;
  toCbor: () => TxCborBytes;
  txHash: () => TxHash;
  // This MUTATES THE transaction.
  sign: (ed25519PrivateKey: Ed25519PrivateKey) => Result<Transaction, string>;
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
        return err(`Failed to sign transaction: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    _inner: txReadyForSigning,
  };
}

export const buildOpenTx = (
  tag: ChannelTag,
  consumer: ConsumerEd25519VerificationKey,
  adaptor: AdaptorEd25519VerificationKey,
  funding_utxos: TransactionUnspentOutput[],
  publicNetwork: PublicNetwork,
  closePeriod: Seconds,
  amount: Lovelace,
): Result<Transaction, string> => {
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
    return err(`Failed to build open transaction: ${error instanceof Error ? error.message : String(error)}`);
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
