import { describe, it } from "vitest";
import { expectNotNull, expectOk } from "../assertions";
import { json2GraphRoutesCodec, mkLndClient, type LndClient } from "../../src/bitcoin/lndClient";
import { Millisatoshi } from "../../src/bitcoin/asset";
import { NonNegativeBigInt } from "@konduit/codec/integers/big";
import { stringify, type Json } from "@konduit/codec/json";
import { NonNegativeInt } from "@konduit/codec/integers/smallish";

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

  it("parses graph routes response correctly", () => {
    let json: Json = {
      "routes": [
        {
          "total_time_lock": 4842207n,
          "total_fees": "0",
          "total_amt": "10000",
          "hops": [
            {
              "chan_id": "5323783624645869568",
              "chan_capacity": "15000000",
              "amt_to_forward": "10000",
              "fee": "0",
              "expiry": 4842201n,
              "amt_to_forward_msat": "10000101",
              "fee_msat": "101",
              "pub_key": "037f1c05c19f9e0bbdf36bfd6189d14405009fc5a82a7d02568ac2fdc32c6f88ef",
              "tlv_payload": true,
              "mpp_record": null,
              "amp_record": null,
              "custom_records": {},
              "metadata": "",
              "blinding_point": "",
              "encrypted_data": "",
              "total_amt_msat": "0"
            },
            {
              "chan_id": "5259856919095410688",
              "chan_capacity": "100000",
              "amt_to_forward": "10000",
              "fee": "0",
              "expiry": 4842195n,
              "amt_to_forward_msat": "10000000",
              "fee_msat": "101",
              "pub_key": "039031cb39905af6b1f63cd5ba61ab631ee38957926793787989c7e4955bffd702",
              "tlv_payload": true,
              "mpp_record": null,
              "amp_record": null,
              "custom_records": {},
              "metadata": "",
              "blinding_point": "",
              "encrypted_data": "",
              "total_amt_msat": "0"
            },
            {
              "chan_id": "5323783624645738496",
              "chan_capacity": "15000000",
              "amt_to_forward": "10000",
              "fee": "0",
              "expiry": 4842195n,
              "amt_to_forward_msat": "10000000",
              "fee_msat": "0",
              "pub_key": "022a15e511bc5e5eb10e3d3d777fa098e9087fcd878917986ee3a157340becdbfa",
              "tlv_payload": true,
              "mpp_record": null,
              "amp_record": null,
              "custom_records": {},
              "metadata": "",
              "blinding_point": "",
              "encrypted_data": "",
              "total_amt_msat": "0"
            }
          ],
          "total_fees_msat": "202",
          "total_amt_msat": "10000202",
          "first_hop_amount_msat": "0",
          "custom_channel_data": ""
        }
      ],
      "success_prob": 1n
    };
    const deserialised = json2GraphRoutesCodec.deserialise(json);
    expectOk(deserialised);
  });

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

      //  let routes = self.v1_graph_routes(req.payee, req.amount_msat).await?;
      //  let route = routes.routes.first().ok_or(Error::ApiError {
      //      status: 404,
      //      message: "No route".into(),
      //  })?;

      //  let blocks = route
      //      .total_time_lock
      //      .checked_sub(self.block_height().await?)
      //      .ok_or(Error::Time)?;
      //  let relative_timeout = self
      //      .config
      //      .block_time
      //      .checked_mul(blocks as u32)
      //      .ok_or(Error::Time)?;

      //  Ok(QuoteResponse {
      //      relative_timeout,
      //      fee_msat: route.total_fees_msat,
      //  })
      // pub async fn v1_graph_routes(
      //     &self,
      //     payee: [u8; 33],
      //     amount_msat: u64,
      // ) -> crate::Result<graph_routes::GraphRoutes> {
      //     let path = format!(
      //         "v1/graph/routes/{}/{}",
      //         hex::encode(payee),
      //         amount_msat / 1000 + 1
      //     );
      //     self.execute(self.get(&path)).await
      // }
      //
      // graphRoutes: (
      //   payeePubkey: Uint8Array, // 33 bytes
      //   amountMsat: Millisatoshi
      // ) => Promise<Result<GraphRoutesResponse, HttpEndpointError>>;
      const payReq = invoiceResponse.invoice.raw;

      const route = (await lndPaying.graphRoutes(invoiceResponse.invoice.payee, invoiceResponse.invoice.amount)).match(
        (res) => res,
        (err) => {
          console.error(`Failed to fetch graph routes on paying node: ${stringify(err as Json)}`);
          throw new Error("Failed to fetch graph routes on paying node");
        }
      );
      console.debug(`Graph routes response on paying node: ${stringify(json2GraphRoutesCodec.serialise(route))}`);

      const info = expectOk(await lndPaying.getInfo());

      // Construct a minimal router send request similar to the Rust client:
      // we set the payment_request and a simple fee limit.
      const originalTotalFeesMsat = route.routes[0]?.total_fees_msat;
      const feeLimitMsat = originalTotalFeesMsat ? originalTotalFeesMsat : NonNegativeBigInt.fromDigits(1, 0, 0, 0); // allow up to 1 msat fee.
      const totalTimeLock:NonNegativeInt = expectNotNull(route.routes[0]?.total_time_lock);

      const cltvLimit = expectOk(NonNegativeInt.add(
        NonNegativeInt.distance(totalTimeLock, info.block_height),
        NonNegativeInt.fromDigits(3))
      ); // add some buffer to the CLTV limit based on current block height.

      console.debug(`Original total_time_lock from route: ${route.routes[0]?.total_time_lock}, current block height: ${info.block_height}`);
      console.debug(`Original total_fees_msat from route: ${route.routes[0]?.total_fees_msat}`);
      console.debug(`Calculated CLTV limit for router send: ${cltvLimit} and fee limit: ${feeLimitMsat.toString()} msat`);

      const sendResult = await lndPaying.v2RouterSend({
        allow_self_payment: true,
        amp: undefined,
        amt_msat: undefined,
        cltv_limit: cltvLimit,
        dest: undefined,
        fee_limit_msat: feeLimitMsat,
        last_hop_pubkey: undefined,
        outgoing_chan_ids: undefined,
        payment_request: payReq,
        timeout_seconds: undefined,
      });
      console.debug(`Router send response on paying node: ${stringify(sendResult as unknown as Json)}`);
      const sendResponse = expectOk(sendResult);


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
