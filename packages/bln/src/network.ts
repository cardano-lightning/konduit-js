// defaults for encode; default timestamp is current time at call

export type Network = "Bitcoin" | "Testnet" | "Regnet" | "Simnet";
export type Short = "bc" | "tb" | "bcrt" | "sb";

export type NetworkInfo = {
  short: Short;
  keyByte: number;
  scriptByte: number;
  witnessVersions: number[];
};

export const NETWORKS: Record<Network, NetworkInfo> = {
  Bitcoin: {
    short: "bc",
    keyByte: 0x00,
    scriptByte: 0x05,
    witnessVersions: [0, 1],
  },
  Testnet: {
    short: "tb",
    keyByte: 0x6f,
    scriptByte: 0xc4,
    witnessVersions: [0, 1],
  },
  Regnet: {
    short: "bcrt",
    keyByte: 0x6f,
    scriptByte: 0xc4,
    witnessVersions: [0, 1],
  },
  Simnet: {
    short: "sb",
    keyByte: 0x3f,
    scriptByte: 0x7b,
    witnessVersions: [0, 1],
  },
};

export const SHORT_LOOKUP: Record<Short, Network> = (() =>
  Object.entries(NETWORKS).reduce(
    (acc, [key, val]) => {
      acc[val.short] = key as Network;
      return acc;
    },
    {} as Record<Short, Network>,
  ))();
