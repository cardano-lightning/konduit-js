# konduit-js

## Org

This repo uses

- nix (optional)
- yarn - probably required
- vite, ts, and vue.

The repo is organized a monorepo with yarn workspaces:

```
.
├── apps
└── packages
```

## Learnings

### Vite stuff

Its not entirely clear why vite ought to be in a lib that is not itself the app
(and so doesn't need bundling ...?)

Regardless, for now we have vite in the libs.

### TS stuff

TS configs are a known dark art.

Afaiu, ts cannot work out where workspace deps are coming from. The `paths` must
be explicitly declared.

Again afaiu, it is not possible to "merge" to tsconfig.json: extending leads to
overwriting. Partly as a consequence, it is not deemed advisable to try to be
too clever in inheriting from multiple configs.

A suggestion is to instead use
https://devblogs.microsoft.com/typescript/announcing-typescript-5-4/#auto-import-support-for-subpath-imports
I haven't looked into this further
