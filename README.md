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

We use `vue-tsc` as a TS compiler.

## Devel

### Nix shell

Our nix shell provides the basic tools needed for the development - node, yarn, etc. To enter the nix shell, run: `$ nix develop`.

### Devel cycle

At the root level of the repo:

- `yarn install` to install dependencies
- `yarn build` to build all packages and apps
- `yarn dev` currently servers only the app in `apps/konduit-app` through vite.

### Nix build

Our app build is nixified. To build the app with nix, run: `$ nix build .#app`. If you change dependencies please update the dependency hash `nix/default.nix` - more detailed instructions can be found there.

## Learnings

### TS package

### Cross-package references

Random points about package cross-references in the monorepo:

* `composite: true` and `declaration: true` are required for libraries used by other packages.

* `references` must be used to point to other packages in the monorepo on the `tsconfig.json`. This may seem redundant to `package.json` dependencies, but is required by the `tsc`.

* Modules which are exposed by a given library should be listed in the `exports` field of the `package.json` so the importing package can find them.

* We import cross-package only using the package name, not relative paths.

#### Vite stuff

Its not entirely clear why vite ought to be in a lib that is not itself the app
(and so doesn't need bundling ...?)

Regardless, for now we have vite in the libs.

