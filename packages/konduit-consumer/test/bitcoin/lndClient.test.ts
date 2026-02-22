import { describe, it } from "vitest";
import { expectNotNull, expectOk } from "../assertions";
import { mkLndClient, type LndClient } from "../../src/bitcoin/lndClient";
import { Millisatoshi } from "../../src/bitcoin/asset";
import { NonNegativeBigInt } from "@konduit/codec/integers/big";

const integrationTestEnv = (() => {
  const invoicingBaseUrlOpt = import.meta.env
    .VITE_TEST_LND_INVOICING_BASE_URL as string | undefined;
  const invoicingMacaroonOpt = import.meta.env
    .VITE_TEST_LND_INVOICING_MACAROON as string | undefined;

  const payingBaseUrlOpt = import.meta.env
    .VITE_TEST_LND_PAYING_BASE_URL as string | undefined;
  const payingMacaroonOpt = import.meta.env
    .VITE_TEST_LND_PAYING_MACAROON as string | undefined;

  const mkLndInvoicing = (t: any): LndClient => {
    if (!invoicingBaseUrlOpt || !invoicingMacaroonOpt) {
      t.skip();
    }
    const baseUrl = expectNotNull(invoicingBaseUrlOpt);
    const macaroon = expectNotNull(invoicingMacaroonOpt);
    return mkLndClient({ baseUrl, macaroon });
  };

  const mkLndPaying = (t: any): LndClient => {
    if (!payingBaseUrlOpt || !payingMacaroonOpt) {
      t.skip();
    }
    const baseUrl = expectNotNull(payingBaseUrlOpt);
    const macaroon = expectNotNull(payingMacaroonOpt);
    return mkLndClient({ baseUrl, macaroon });
  };

  return {
    mkLndInvoicing,
    mkLndPaying,
  };
})();

describe("LND client basic interactions", () => {
  it(
    "creates an invoice via LND addInvoice endpoint",
    async (test) => {
      const lnd = integrationTestEnv.mkLndInvoicing(test);
      const msat = Millisatoshi.fromDigits(1, 0, 0, 0, 0);
      const memo = `An invoice from TS lnd client integration test at ${new Date().toISOString()}`;

      const result = await lnd.addLndInvoice(msat, memo);

      const response = expectOk(result);
      console.debug("Received invoice from LND:", response);
    },
    60000
  );

  it(
    "retrieves node information via getInfo",
    async (test) => {
      const lnd = integrationTestEnv.mkLndInvoicing(test);

      const result = await lnd.getInfo();

      const info = expectOk(result);
      console.debug("LND getInfo response:", info);

      // Very light sanity checks (shape, not exact values)
      expectNotNull(info.identity_pubkey);
      expectNotNull(info.alias);
    },
    60000
  );

  it(
    "lists payments with default query",
    async (test) => {
      const lnd = integrationTestEnv.mkLndInvoicing(test);

      const result = await lnd.listPayments({
        includeIncomplete: true,
        reversed: false,
        countTotalPayments: true,
      });

      const payments = expectOk(result);
      console.debug("LND payments response:", payments);

      expectNotNull(payments.first_index_offset);
      expectNotNull(payments.last_index_offset);
      expectNotNull(payments.total_num_payments);
    },
    60000
  );

  it(
    "issues an invoice on the invoicing node and (at least) decodes it on the paying node",
    async (test) => {
      const lndInvoicing = integrationTestEnv.mkLndInvoicing(test);
      const lndPaying = integrationTestEnv.mkLndPaying(test);

      const msat = Millisatoshi.fromDigits(1, 0, 0, 0, 0);
      const memo = `An invoice from TS lnd client integration test at ${new Date().toISOString()}`;

      const invoiceResult = await lndInvoicing.addLndInvoice(msat, memo);
      const invoiceResponse = expectOk(invoiceResult);
      console.debug("Invoice created on invoicing node:", invoiceResponse);

      const payReq = invoiceResponse.invoice.raw;

      // Construct a minimal router send request similar to the Rust client:
      // we set the payment_request and a simple fee limit.
      const feeLimitMsat = NonNegativeBigInt.fromDigits(1, 0, 0, 0); // allow up to 1 msat fee.

      const sendResult = await lndPaying.v2RouterSend({
        payment_request: payReq,
        fee_limit_msat: feeLimitMsat,
        allow_self_payment: true,
        amp: undefined,
        amt_msat: undefined,
        dest: undefined,
        last_hop_pubkey: undefined,
        outgoing_chan_ids: undefined,
        timeout_seconds: undefined,
      });

      const sendResponse = expectOk(sendResult);
      console.debug("Router send response on paying node:", sendResponse);

      // At minimum, we expect LND to have a concrete status and failure_reason.
      // expectNotNull(sendResponse.status);
      // expectNotNull(sendResponse.failure_reason);

      // // If it succeeded, we should have a preimage and payment details.
      // if (sendResponse.status === "SUCCEEDED") {
      //   expectNotNull(sendResponse.preimage);
      //   expectNotNull(sendResponse.payment);
      //   if (sendResponse.payment) {
      //     expectNotNull(sendResponse.payment.payment_preimage);
      //   }
      // }
    },
    60000
  );
});
