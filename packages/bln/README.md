# BLN (as far as konduit needs)

## Why?

We tried a bunch of different js packages and also tried rust ones brought in
using wasm. All but one of them significantly bloated our build artifacts. The
exception was `light-bolt11-decoder`, which is indeed light. However it does not
recover the payee key from signature - something we are interested in. So in the
end, we have yet another bolt11 decoder.

## Status

This is package is largely untested.

## Notes

Having stared at bolt11 for a long time, I strongly recommend that when we come
to write an invoice-like standard, we stick to CBOR and leave the "human
readability" problem as a "tooling issue.

## Credits

This code is largely based on the `light-bolt11-decoder`, itself based on the
`bolt11`. Some functions are verbatim as they appear in these repos.
