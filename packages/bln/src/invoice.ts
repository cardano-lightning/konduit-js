import type { Tagged } from "type-fest";
import type { DecodedInvoice } from "./invoice/bolt11";
import { err, ok, type Result } from "neverthrow";
import * as bolt11 from "./invoice/bolt11";
import * as bip21 from "./invoice/bip21";
export type { DecodedInvoice } from "./invoice/bolt11";

export type InvoiceInfo = { raw: InvoiceString, decoded: DecodedInvoice }
export type InvoiceString = Tagged<string, "InvoiceString">;
export type InvoiceError = bip21.ParseError | bolt11.ParseURIError | { message: string };

// Parse a string into a InvoiceString invoice using three strategies:
// 1. Try to parse as BIP21 URI with lightning parameter
// 2. Try to parse as InvoiceString URI (with "lightning:" prefix)
// 3. Try to parse as raw InvoiceString invoice
export const parse = (val: string) : Result<InvoiceInfo, InvoiceError> => {
  try {
    return bip21.parse(val)
      .andThen(({ options }): Result<InvoiceInfo, InvoiceError> => {
        if (!options.lightning) {
          return err({ message: "No invoice found in BIP21 string" });
        }
        return ok({ raw: options.lightning.invoiceString as InvoiceString, decoded: options.lightning.decoded });
      })
      .orElse((): Result<InvoiceInfo, InvoiceError> => {
        // Try to parse as raw invoice
        return bolt11.parseURI(val).match(
          ({ invoiceString, decoded }) => ok({ raw: invoiceString as InvoiceString, decoded }),
          (error) => err(error as InvoiceError)
        );
      })
      .orElse((_err: bip21.ParseError | { message: string }): Result<InvoiceInfo, InvoiceError> => {
        return bolt11.parse(val).match(
          (invoice) => ok({ raw: val as InvoiceString, decoded: invoice }),
          (error) =>err(error as InvoiceError)
        )
      });
  } catch (e) {
    // TODO: This should be reported to the server and presented as application error, not user error
    return err({ message: (e as Error).message || "Unknown error" });
  }
};
