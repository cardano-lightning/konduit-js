import { HexString } from "@konduit/codec/hexString";
import { AddressBech32, type PublicNetwork, TxHash } from "@konduit/konduit-consumer/cardano";

export namespace CardanoScan {
  const rootUrl = (network: PublicNetwork) => {
    switch (network) {
      case "Mainnet":
        return "https://cardanoscan.io";
      case "Preprod":
        return "https://preprod.cardanoscan.io";
      case "Preview":
        return "https://preview.cardanoscan.io";
    }
  }
  export const mkAddressPageUrl = (network: PublicNetwork, addressBech32: AddressBech32) => {
    const url = rootUrl(network) + "/address/" + addressBech32;
    return url;
  }
  export const mkTransactionPageUrl = (network: PublicNetwork, transactionHash: TxHash) => {
    const txHashHex = HexString.fromUint8Array(transactionHash);
    const url = rootUrl(network) + "/transaction/" + txHashHex;
    return url;
  }
};

