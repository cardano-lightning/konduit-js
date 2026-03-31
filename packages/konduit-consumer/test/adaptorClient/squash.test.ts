import { describe, it } from "vitest";
import { mkJson2SquashResponseCodec } from "../../src/adaptorClient/squash";
import { expectOk } from "../assertions";
import { Ed25519PublicKey, Ed25519VerificationKey } from "@konduit/cardano-keys";
import { HexString } from "@konduit/codec/hexString";
import * as hexString from "@konduit/codec/hexString";
import type { ChannelTag, ConsumerEd25519VerificationKey } from "../../src/channel";

describe("SquashResponse serialization/deserialization", () => {
  it("should successfully roundtrip serialize and deserialize", async () => {
    const response = {
      "Incomplete": {
        "proposal": "9f1a00028efa029f01ffff",
        "current": {
          "body": "9f000080ff",
          "signature": "d56a0cadc9c220aa5275be1b4fca367de5491c2aa7c341927f80e969f17f7e505ea5b29f1d25a7e30e5ec7675aec95366a6e963e1edac0a56473b99a4604170e"
        },
        "unlockeds": [
          {
            "body": "9f021a00028efa1b0000019c8970727f5820383a37acf244c8ff183299cac4e1cf388b46e771c60f712ddf5cb57c392fd833ff",
            "signature": "45af1027e645e2a55bbe6841533c2750419071fe2adc56630499a5b8494ea9aced3bc2ecb2a4ef060dba534a6dc94a436b6664c6722328dd3dde8670b320d70e",
            "secret": "277d09fbd66769c28f0123e3736b431d64dbc5ca15b9a176a223583a1493e617"
          }
        ]
      }
    };
    const channelTag = hexString.toUint8Array(HexString.unsafeFromString("60fce8a15cf1c0357d5b577155334634")) as ChannelTag;
    const pubKey = hexString.toUint8Array(HexString.unsafeFromString("1a0b65a0f5e2fc1af32b6fcbb8bc7304d270fb78b36bd9ad1a9c5d427a345754")) as Ed25519PublicKey;
    const vKey = new Ed25519VerificationKey(pubKey) as ConsumerEd25519VerificationKey;
    const json2SquashResponseCodec = mkJson2SquashResponseCodec(channelTag, vKey);
    const result = expectOk(json2SquashResponseCodec.deserialise(response));
    console.log(result);
  });
});

