import * as showEnv from "./handlers/showEnv";
import * as health from "./handlers/health";
import * as getInvoices from "./handlers/getInvoices";
import * as makeInvoice from "./handlers/makeInvoice";
import * as pay from "./handlers/pay";

export { showEnv, health, getInvoices, makeInvoice, pay };

export const handlers = {
  showEnv: showEnv.handle,
  health: health.handle,
  getInvoices: getInvoices.handle,
  makeInvoice: makeInvoice.handle,
  pay: pay.handle,
};
