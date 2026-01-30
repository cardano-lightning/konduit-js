# Konduit-wasm

A WASM-friendly API for Konduit.

## Building

This code was build and copied from `konduit/crates/konduit-wasm` using the following command:

```bash
$ cd konduit/crates/konduit-wasm
$ make browser
$ cp konduit-wasm-browser/*.ts $THIS_REPO_PATH/wasm/
$ cp konduit-wasm-browser/*.wasm $THIS_REPO_PATH/wasm/
$ cp konduit-wasm-browser/*.js $THIS_REPO_PATH/wasm/
$ cp konduit-wasm-browser/package.json $THIS_REPO_PATH/wasm/
```
