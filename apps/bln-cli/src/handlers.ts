import * as showEnv from "./handlers/showEnv.ts";
import * as health from "./handlers/health.ts";
import * as getInvoices from "./handlers/getInvoices.ts";
import * as makeInvoice from "./handlers/makeInvoice.ts";
import * as pay from "./handlers/pay.ts";

export { showEnv, health, getInvoices, makeInvoice, pay };

export const handlers = {
  showEnv: showEnv.handle,
  health: health.handle,
  getInvoices: getInvoices.handle,
  makeInvoice: makeInvoice.handle,
  pay: pay.handle,
};
