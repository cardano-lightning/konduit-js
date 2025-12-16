import { describe, it, expect, test } from "vitest";
import { bolt11 } from "../src/index";
import { base58, hex } from "@scure/base";
import { FallbackAddress } from "../src/bolt11";
import * as bitcoinjs from "bitcoinjs-lib";

const PAYMENT_SECRET = hex.decode(
  "1111111111111111111111111111111111111111111111111111111111111111",
);

function parseAddress(s: string): FallbackAddress {
  try {
    const { hash: bytes, version } = bitcoinjs.address.fromBase58Check(s);
    return { version, bytes };
  } catch {}
  try {
    const { data: bytes, version } = bitcoinjs.address.fromBech32(s);
    return { version, bytes };
  } catch {}
  throw new Error("cannot parse address");
}

describe("bolt 11 spec", () => {
  it("example 1", () => {
    const my = bolt11.parse(
      "lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap9us6v52vjjsrvywa6rt52cm9r9zqt8r2t7mlcwspyetp5h2tztugp9lfyql",
    );
    const their = {
      network: "Bitcoin",
      timestamp: 1496314658,
      paymentSecret: PAYMENT_SECRET,
      paymentHash: hex.decode(
        "0001020304050607080900010203040506070809000102030405060708090102",
      ),
      description: "Please consider supporting this project",
      payee: hex.decode(
        "03e7156ae33b0a208d0744199163177e909e80176e55d97a2f221ede0f934dd9ad",
      ),
    };
    expect(my.network).toStrictEqual(their.network);
    expect(my.timestamp).toStrictEqual(their.timestamp);
    expect(my.paymentSecret).toStrictEqual(their.paymentSecret);
    expect(my.paymentHash).toStrictEqual(their.paymentHash);
    expect(my.description).toStrictEqual(their.description);
    expect(my.payee).toStrictEqual(their.payee);
  });
  it("example 2", () => {
    const my = bolt11.parse(
      "lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpu9qrsgquk0rl77nj30yxdy8j9vdx85fkpmdla2087ne0xh8nhedh8w27kyke0lp53ut353s06fv3qfegext0eh0ymjpf39tuven09sam30g4vgpfna3rh",
    );
    const their = {
      network: "Bitcoin",
      amount: BigInt("250000000"),
      timestamp: 1496314658,
      paymentSecret: PAYMENT_SECRET,
      paymentHash: hex.decode(
        "0001020304050607080900010203040506070809000102030405060708090102",
      ),
      description: "1 cup coffee",
      payee: hex.decode(
        "03e7156ae33b0a208d0744199163177e909e80176e55d97a2f221ede0f934dd9ad",
      ),
    };
    expect(my.network).toStrictEqual(their.network);
    expect(my.amount).toStrictEqual(their.amount);
    expect(my.timestamp).toStrictEqual(their.timestamp);
    expect(my.paymentSecret).toStrictEqual(their.paymentSecret);
    expect(my.paymentHash).toStrictEqual(their.paymentHash);
    expect(my.description).toStrictEqual(their.description);
    expect(my.payee).toStrictEqual(their.payee);
  });
  it("example 4", () => {
    const my = bolt11.parse(
      "lnbc20m1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqhp58yjmdan79s6qqdhdzgynm4zwqd5d7xmw5fk98klysy043l2ahrqs9qrsgq7ea976txfraylvgzuxs8kgcw23ezlrszfnh8r6qtfpr6cxga50aj6txm9rxrydzd06dfeawfk6swupvz4erwnyutnjq7x39ymw6j38gp7ynn44",
    );
    const their = {
      network: "Bitcoin",
      amount: BigInt("2000000000"),
      timestamp: 1496314658,
      paymentSecret: PAYMENT_SECRET,
      paymentHash: hex.decode(
        "0001020304050607080900010203040506070809000102030405060708090102",
      ),
      descriptionHash: hex.decode(
        "3925b6f67e2c340036ed12093dd44e0368df1b6ea26c53dbe4811f58fd5db8c1",
      ),
      payee: hex.decode(
        "03e7156ae33b0a208d0744199163177e909e80176e55d97a2f221ede0f934dd9ad",
      ),
    };
    expect(my.network).toStrictEqual(their.network);
    expect(my.amount).toStrictEqual(their.amount);
    expect(my.timestamp).toStrictEqual(their.timestamp);
    expect(my.paymentSecret).toStrictEqual(their.paymentSecret);
    expect(my.paymentHash).toStrictEqual(their.paymentHash);
    expect(my.descriptionHash).toStrictEqual(their.descriptionHash);
    expect(my.payee).toStrictEqual(their.payee);
  });
  it("example 5", () => {
    const my = bolt11.parse(
      "lntb20m1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygshp58yjmdan79s6qqdhdzgynm4zwqd5d7xmw5fk98klysy043l2ahrqspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqfpp3x9et2e20v6pu37c5d9vax37wxq72un989qrsgqdj545axuxtnfemtpwkc45hx9d2ft7x04mt8q7y6t0k2dge9e7h8kpy9p34ytyslj3yu569aalz2xdk8xkd7ltxqld94u8h2esmsmacgpghe9k8",
    );
    const their = {
      network: "Testnet",
      amount: BigInt("2000000000"),
      timestamp: 1496314658,
      paymentSecret: PAYMENT_SECRET,
      paymentHash: hex.decode(
        "0001020304050607080900010203040506070809000102030405060708090102",
      ),
      descriptionHash: hex.decode(
        "3925b6f67e2c340036ed12093dd44e0368df1b6ea26c53dbe4811f58fd5db8c1",
      ),
      fallbackAddress: parseAddress("mk2QpYatsKicvFVuTAQLBryyccRXMUaGHP"),
      payee: hex.decode(
        "03e7156ae33b0a208d0744199163177e909e80176e55d97a2f221ede0f934dd9ad",
      ),
    };
    expect(my.network).toStrictEqual(their.network);
    expect(my.amount).toStrictEqual(their.amount);
    expect(my.timestamp).toStrictEqual(their.timestamp);
    expect(my.paymentSecret).toStrictEqual(their.paymentSecret);
    expect(my.paymentHash).toStrictEqual(their.paymentHash);
    expect(my.descriptionHash).toStrictEqual(their.descriptionHash);
    expect(my.fallbackAddress?.bytes).toStrictEqual(
      their.fallbackAddress?.bytes,
    );
    expect(my.payee).toStrictEqual(their.payee);
  });
  it("example 6", () => {
    const my = bolt11.parse(
      "lnbc20m1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqhp58yjmdan79s6qqdhdzgynm4zwqd5d7xmw5fk98klysy043l2ahrqsfpp3qjmp7lwpagxun9pygexvgpjdc4jdj85fr9yq20q82gphp2nflc7jtzrcazrra7wwgzxqc8u7754cdlpfrmccae92qgzqvzq2ps8pqqqqqqpqqqqq9qqqvpeuqafqxu92d8lr6fvg0r5gv0heeeqgcrqlnm6jhphu9y00rrhy4grqszsvpcgpy9qqqqqqgqqqqq7qqzq9qrsgqdfjcdk6w3ak5pca9hwfwfh63zrrz06wwfya0ydlzpgzxkn5xagsqz7x9j4jwe7yj7vaf2k9lqsdk45kts2fd0fkr28am0u4w95tt2nsq76cqw0",
    );
    const their = {
      network: "Bitcoin",
      amount: BigInt("2000000000"),
      timestamp: 1496314658,
      paymentSecret: PAYMENT_SECRET,
      paymentHash: hex.decode(
        "0001020304050607080900010203040506070809000102030405060708090102",
      ),
      descriptionHash: hex.decode(
        "3925b6f67e2c340036ed12093dd44e0368df1b6ea26c53dbe4811f58fd5db8c1",
      ),
      fallbackAddress: parseAddress("1RustyRX2oai4EYYDpQGWvEL62BBGqN9T"),
      payee: hex.decode(
        "03e7156ae33b0a208d0744199163177e909e80176e55d97a2f221ede0f934dd9ad",
      ),
    };
    expect(my.network).toStrictEqual(their.network);
    expect(my.amount).toStrictEqual(their.amount);
    expect(my.timestamp).toStrictEqual(their.timestamp);
    expect(my.paymentSecret).toStrictEqual(their.paymentSecret);
    expect(my.paymentHash).toStrictEqual(their.paymentHash);
    expect(my.descriptionHash).toStrictEqual(their.descriptionHash);
    expect(my.fallbackAddress?.bytes).toStrictEqual(
      their.fallbackAddress?.bytes,
    );
    expect(my.payee).toStrictEqual(their.payee);
  });
});
