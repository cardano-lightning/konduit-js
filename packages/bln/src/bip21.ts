import { err, ok, type Result } from "neverthrow";
import type { DecodedInvoice } from "./bolt11";
import * as bolt11 from "./bolt11";
import * as bip21 from "bip21";

// A slightly modified version of the bip21 options to support decoded lighting invoices
export type Bip21Options<invoice> = {
  amount?: number;
  label?: string;
  message?: string;
  lightning?: invoice;
}

export type ParseError = bolt11.ParseError | { type: "UrlDecodingError", message: string };

export type PaymentRequest<invoice> = {
  address: string;
  options: Bip21Options<invoice>;
};

type DecodeResult<invoice> = Result<PaymentRequest<invoice>, ParseError>;

export function parse(uri: string, urnScheme?: string): DecodeResult<DecodedInvoice> {
  const res: DecodeResult<string> = (() => {
    try {
      return ok(bip21.decode(uri, urnScheme) as {
          address: string;
          options: Bip21Options<string>;
      });
    } catch (e) {
      return err({ type: "UrlDecodingError", message: (e as Error).message } as ParseError);
    }
  })();
  return res.andThen((parsedUri: PaymentRequest<string>) => {
    if(parsedUri.options.lightning) {
      return bolt11.parse(parsedUri.options.lightning).match(
        (invoice) => {
          return ok({
            address: parsedUri.address,
            options: { ...parsedUri.options, lightning: invoice }
          });
        },
        (parseErr) => {
          return err(parseErr as ParseError);
        }
      );
    }
    return ok({
      address: parsedUri.address,
      options: { ...parsedUri.options, lightning: undefined }
    });
  });
}

