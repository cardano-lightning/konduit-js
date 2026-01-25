import { describe, it, expect } from 'vitest';
import * as addresses from '../../src/cardano/addressses';
import { expectOk, expectErrWithSubstring } from '../assertions';
import { parse } from '@konduit/codec/json';
import { bech32 } from '@scure/base';

describe('Cardano Addresses', () => {
  describe('ScriptHash', () => {
    it('should create valid ScriptHash from 28 bytes', () => {
      const validHash = new Uint8Array(28).fill(0xaa);
      const result = addresses.ScriptHash.fromBytes(validHash);
      const hash = expectOk(result);
      expect(hash.length).toBe(28);
    });

    it('should reject hash with less than 28 bytes', () => {
      const tooShort = new Uint8Array(27).fill(0xaa);
      const result = addresses.ScriptHash.fromBytes(tooShort);
      expectErrWithSubstring(result, 'Invalid ScriptHash length');
    });

    it('should reject hash with more than 28 bytes', () => {
      const tooLong = new Uint8Array(29).fill(0xaa);
      const result = addresses.ScriptHash.fromBytes(tooLong);
      expectErrWithSubstring(result, 'Invalid ScriptHash length');
    });
  });

  describe('json2ScriptHashCodec', () => {
    it('should deserialize JSON string to ScriptHash', () => {
      const validHex = 'b'.repeat(56);
      const json = expectOk(parse(`"${validHex}"`));
      const result = addresses.json2ScriptHashCodec.deserialise(json);
      const hash = expectOk(result);
      expect(hash.length).toBe(28);
    });

    it('should roundtrip through JSON', () => {
      const hash = new Uint8Array(28).fill(0xcd) as addresses.ScriptHash;
      const json = addresses.json2ScriptHashCodec.serialise(hash);
      const decoded = expectOk(addresses.json2ScriptHashCodec.deserialise(json));
      expect(decoded).toEqual(hash);
    });
  });

  describe('json2PubKeyHashCodec', () => {
    it('should deserialize JSON string to PubKeyHash', () => {
      const validHex = 'd'.repeat(56);
      const json = expectOk(parse(`"${validHex}"`));
      const result = addresses.json2PubKeyHashCodec.deserialise(json);
      const hash = expectOk(result);
      expect(hash.length).toBe(28);
    });

    it('should roundtrip through JSON', () => {
      const hash = new Uint8Array(28).fill(0x34) as addresses.PubKeyHash;
      const json = addresses.json2PubKeyHashCodec.serialise(hash);
      const decoded = expectOk(addresses.json2PubKeyHashCodec.deserialise(json));
      expect(decoded).toEqual(hash);
    });
  });

  describe('Address encoding/decoding', () => {
    const testPaymentHash = new Uint8Array(28).fill(0x11) as addresses.PubKeyHash;
    const testStakingHash = new Uint8Array(28).fill(0x22) as addresses.PubKeyHash;
    const testScriptHash = new Uint8Array(28).fill(0x33) as addresses.ScriptHash;

    describe('mainnet addresses', () => {
      it('should encode PubKeyHash/PubKeyHash address (type 0x00)', () => {
        const address: addresses.Address = {
          network: addresses.mainnet,
          paymentCredential: { type: "PubKeyHash", hash: testPaymentHash },
          stakingCredential: { type: "PubKeyHash", hash: testStakingHash }
        };
        const bech32 = addresses.AddressBech32.fromAddress(address);
        expect(bech32).toMatch(/^addr1/);
      });

      it('should encode ScriptHash/PubKeyHash address (type 0x01)', () => {
        const address: addresses.Address = {
          network: addresses.mainnet,
          paymentCredential: { type: "ScriptHash", hash: testScriptHash },
          stakingCredential: { type: "PubKeyHash", hash: testStakingHash }
        };
        const bech32 = addresses.AddressBech32.fromAddress(address);
        expect(bech32).toMatch(/^addr1/);
      });

      it('should encode PubKeyHash/ScriptHash address (type 0x02)', () => {
        const address: addresses.Address = {
          network: addresses.mainnet,
          paymentCredential: { type: "PubKeyHash", hash: testPaymentHash },
          stakingCredential: { type: "ScriptHash", hash: testScriptHash }
        };
        const bech32 = addresses.AddressBech32.fromAddress(address);
        expect(bech32).toMatch(/^addr1/);
      });

      it('should encode ScriptHash/ScriptHash address (type 0x03)', () => {
        const address: addresses.Address = {
          network: addresses.mainnet,
          paymentCredential: { type: "ScriptHash", hash: testScriptHash },
          stakingCredential: { type: "ScriptHash", hash: testScriptHash }
        };
        const bech32 = addresses.AddressBech32.fromAddress(address);
        expect(bech32).toMatch(/^addr1/);
      });

      it('should encode PubKeyHash without staking credential (type 0x06)', () => {
        const address: addresses.Address = {
          network: addresses.mainnet,
          paymentCredential: { type: "PubKeyHash", hash: testPaymentHash }
        };
        const bech32 = addresses.AddressBech32.fromAddress(address);
        expect(bech32).toMatch(/^addr1/);
      });

      it('should encode ScriptHash without staking credential (type 0x07)', () => {
        const address: addresses.Address = {
          network: addresses.mainnet,
          paymentCredential: { type: "ScriptHash", hash: testScriptHash }
        };
        const bech32 = addresses.AddressBech32.fromAddress(address);
        expect(bech32).toMatch(/^addr1/);
      });
    });

    describe('testnet addresses', () => {
      it('should encode testnet address with correct prefix', () => {
        const address: addresses.Address = {
          network: addresses.testnet,
          paymentCredential: { type: "PubKeyHash", hash: testPaymentHash },
          stakingCredential: { type: "PubKeyHash", hash: testStakingHash }
        };
        const bech32 = addresses.AddressBech32.fromAddress(address);
        expect(bech32).toMatch(/^addr_test1/);
      });
    });

    describe('roundtrip encoding/decoding', () => {
      it('should roundtrip all address type combinations', () => {
        const types: Array<[addresses.Credential, addresses.Credential | undefined]> = [
          [{ type: "PubKeyHash", hash: testPaymentHash }, { type: "PubKeyHash", hash: testStakingHash }],
          [{ type: "ScriptHash", hash: testScriptHash }, { type: "PubKeyHash", hash: testStakingHash }],
          [{ type: "PubKeyHash", hash: testPaymentHash }, { type: "ScriptHash", hash: testScriptHash }],
          [{ type: "ScriptHash", hash: testScriptHash }, { type: "ScriptHash", hash: testScriptHash }],
          [{ type: "PubKeyHash", hash: testPaymentHash }, undefined],
          [{ type: "ScriptHash", hash: testScriptHash }, undefined],
        ];

        for (const [payment, staking] of types) {
          const address: addresses.Address = {
            network: addresses.mainnet,
            paymentCredential: payment,
            stakingCredential: staking
          };
          const bech32 = addresses.AddressBech32.fromAddress(address);
          const decoded = expectOk(addresses.string32ToAddressCodec.deserialise(bech32));
          expect(decoded).toEqual(address);
        }
      });
    });
  });

  describe('string32ToAddressCodec error cases', () => {
    it('should reject invalid bech32 string', () => {
      const invalid = "not-a-valid-bech32-address";
      const result = addresses.string32ToAddressCodec.deserialise(invalid);
      expectErrWithSubstring(result, 'Invalid bech32 address');
    });

    it('should reject mismatched prefix for network', () => {
      const pubKeyHash = new Uint8Array(28).fill(0x11) as addresses.PubKeyHash;
      const mainnetBytes = new Uint8Array([0x01, ...pubKeyHash]);
      const words = bech32.toWords(mainnetBytes);
      const invalid = bech32.encode('addr_test', words, 90);
      const result = addresses.string32ToAddressCodec.deserialise(invalid);
      expectErrWithSubstring(result, 'Invalid address prefix');
    });

    it('should reject address with invalid length for type 0x00', () => {
      const invalidData = new Uint8Array([0x01, ...new Uint8Array(27)]);
      const words = bech32.toWords(invalidData);
      const invalid = bech32.encode('addr', words, 90);
      const result = addresses.string32ToAddressCodec.deserialise(invalid);
      expectErrWithSubstring(result, 'Invalid address length');
    });

    it('should reject pointer addresses (type 0x04 and 0x05)', () => {
      const pointerData = new Uint8Array([0x41, ...new Uint8Array(28)]);
      const words = bech32.toWords(pointerData);
      const pointerAddr = bech32.encode('addr', words, 90);
      const result = addresses.string32ToAddressCodec.deserialise(pointerAddr);
      expectErrWithSubstring(result, 'Pointer addresses');
    });
  });

  describe('json2AddressCodec', () => {
    it('should deserialize JSON string to Address', () => {
      const address: addresses.Address = {
        network: addresses.mainnet,
        paymentCredential: { type: "PubKeyHash", hash: new Uint8Array(28).fill(0x55) as addresses.PubKeyHash },
        stakingCredential: { type: "PubKeyHash", hash: new Uint8Array(28).fill(0x66) as addresses.PubKeyHash }
      };
      const bech32Str = addresses.AddressBech32.fromAddress(address);
      const json = expectOk(parse(`"${bech32Str}"`));
      const decoded = expectOk(addresses.json2AddressCodec.deserialise(json));
      expect(decoded).toEqual(address);
    });

    it('should serialize Address to JSON string', () => {
      const address: addresses.Address = {
        network: addresses.testnet,
        paymentCredential: { type: "ScriptHash", hash: new Uint8Array(28).fill(0x77) as addresses.ScriptHash }
      };
      const json = addresses.json2AddressCodec.serialise(address);
      expect(typeof json).toBe('string');
      expect(json).toMatch(/^addr_test1/);
    });

    it('should round through JSON', () => {
      const original: addresses.Address = {
        network: addresses.mainnet,
        paymentCredential: { type: "PubKeyHash", hash: new Uint8Array(28).fill(0x88) as addresses.PubKeyHash },
        stakingCredential: { type: "ScriptHash", hash: new Uint8Array(28).fill(0x99) as addresses.ScriptHash }
      };
      const json = addresses.json2AddressCodec.serialise(original);
      const decoded = expectOk(addresses.json2AddressCodec.deserialise(json));
      expect(decoded).toEqual(original);
    });
  });
});
