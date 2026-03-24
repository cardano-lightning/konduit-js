import { type ConnectorClient, mkConnectorClient } from "@konduit/konduit-consumer/cardano/connectorClient";
import { PublicNetwork } from "@konduit/konduit-consumer/cardano";

export const defaultCardanoConnector: { connector: ConnectorClient, publicNetwork: PublicNetwork } = await (async () => {
  const backendUrl = import.meta.env.VITE_CARDANO_CONNECTOR_URL;
  const publicNetworkStr = import.meta.env.VITE_CARDANO_PUBLIC_NETWORK;

  if (!backendUrl) {
    throw new Error("VITE_CARDANO_CONNECTOR_URL is not defined. Please set it in your env (please check .env.example).");
  }

  if (!publicNetworkStr) {
    throw new Error("VITE_CARDANO_PUBLIC_NETWORK is not defined. Please set it in your env (please check .env.example).");
  }

  const connectorClient = mkConnectorClient(backendUrl);
  return PublicNetwork.fromString(publicNetworkStr).match(
    (publicNetwork) => ({ connector: connectorClient, publicNetwork }),
    (err) => { throw new Error(`Failed to create CardanoConnector: ${err}`) }
  );
})();

export const debugMode = import.meta.env.VITE_DEBUG_MODE === "true";

