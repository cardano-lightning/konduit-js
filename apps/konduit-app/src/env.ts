import { Connector } from "@konduit/konduit-consumer/cardano/connector";

export const defaultCardanoConnector: Connector = await (async (): Promise<Connector> => {
  const backendUrl = import.meta.env.VITE_CARDANO_CONNECTOR_URL;
  if (!backendUrl) {
    throw new Error("VITE_CARDANO_CONNECTOR_URL is not defined. Please set it in your env (please check .env.example).");
  }
  const result = await Connector.new(backendUrl);
  return result.match(
    (connector) => connector as Connector,
    (err) => { throw new Error(`Failed to create CardanoConnector: ${err}`) }
  );
})();

