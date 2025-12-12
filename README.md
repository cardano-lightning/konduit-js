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

We are forced to use `vue-tsc` extension as a project level compiler because `tsc` was not able to handle `vue` file compilation.

## Devel

At the root level of the repo:

- `yarn install` to install dependencies
- `yarn build` to build all packages and apps
- `yarn dev` currently servers only the app in `apps/konduit-app` through vite.


## Learnings

### TS stuff

#### Vite stuff

Its not entirely clear why vite ought to be in a lib that is not itself the app
(and so doesn't need bundling ...?)

Regardless, for now we have vite in the libs.

#### Cross-package references

Cross-referencing packages in a monorepo:

* `composite: true` and `declaration: true` are required for libraries used by other packages.

* `references` must be used to point to other packages in the monorepo on the tsconfig.json. This may seem redundant to packages.json dependencies, but is required for `tsc` to work out the build order.

* Modules which are exposed by a given library should be listed in the `exports` field of the package.json so the importing package can find them.

* We import cross-package only using the package name, not relative paths.

