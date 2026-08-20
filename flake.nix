{
  description = "Konduit: A Cardano to Bitcoin Lightning Network pipe";

  inputs = {
    flake-parts.url = "github:hercules-ci/flake-parts";
    jailed-agents.url = "github:andersonjoseph/jailed-agents";
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    git-hooks-nix.url = "github:cachix/git-hooks.nix";
    git-hooks-nix.inputs.nixpkgs.follows = "nixpkgs";
    treefmt-nix.url = "github:numtide/treefmt-nix";
    treefmt-nix.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = inputs @ {flake-parts, ...}:
    flake-parts.lib.mkFlake {inherit inputs;}
    {
      imports = [
        inputs.git-hooks-nix.flakeModule
        inputs.treefmt-nix.flakeModule
      ];
      systems = ["x86_64-linux" "aarch64-darwin"];
      perSystem = {
        config,
        pkgs,
        ...
      }: {
        treefmt = {
          projectRootFile = "flake.nix";
          flakeFormatter = true;
          programs = {
            prettier = {
              enable = true;
              settings = {
                printWidth = 80;
                proseWrap = "always";
              };
            };
            alejandra.enable = true;
            rustfmt.enable = true;
          };
        };
        packages = {
          app = pkgs.callPackage ./nix/default.nix {
            repoRoot = ./.;
          };
        };
        pre-commit.settings.hooks = {
          treefmt.enable = true;
        };
        devShells.default = let
          vite = pkgs.writeShellScriptBin "vite"
            ''
              #!/usr/bin/env bash
              root=$(git rev-parse --show-toplevel)
              node $root/node_modules/vite/bin/vite.js $@
            '';
          vitest = pkgs.writeShellScriptBin "vitest"
            ''
              #!/usr/bin/env bash
              root=$(git rev-parse --show-toplevel)
              node $root/node_modules/vitest/vitest.mjs $@
            '';
          vue-language-server =
            pkgs.writeShellScriptBin "vue-language-server"
            ''
              #!/usr/bin/env bash
              # This expects @vue/language-server to be installed via yarn or otherwise
              root=$(git rev-parse --show-toplevel)
              node $root/node_modules/@vue/language-server/index.js $@
            '';
          vtsls =
            pkgs.writeShellScriptBin "vtsls"
            ''
              #!/usr/bin/env bash
              # This expects @vtsls/language-server to be installed via yarn or otherwise
              root=$(git rev-parse --show-toplevel)
              node $root/node_modules/@vtsls/language-server/bin/vtsls.js $@
            '';
          vue-tsc =
            pkgs.writeShellScriptBin "vue-tsc"
            ''
              #!/usr/bin/env bash
              # This expects vue-tsc to be installed via yarn or otherwise
              root=$(git rev-parse --show-toplevel)
              node $root/node_modules/vue-tsc/bin/vue-tsc.js $@
            '';
          ld-library-path = pkgs.lib.makeLibraryPath [
            pkgs.stdenv.cc.cc.lib
            pkgs.bzip2
            # add more only if you hit further .so errors (e.g. pkgs.zlib)
          ];
          commonPackages = [
            pkgs.nodePackages_latest.nodejs
            pkgs.typescript-language-server
            pkgs.yarn-bash-completion
            pkgs.yarn-berry
            pkgs.yarn-berry_4.yarn-berry-fetcher
            vite
            vitest
            vtsls
            vue-language-server
            vue-tsc
          ];
          commonJail = {
            baseJailOptions =
              let
                jail = inputs.jailed-agents.lib.${pkgs.system}.internals.jail;
              in [
                jail.combinators.network
                jail.combinators.time-zone
                jail.combinators.no-new-session
                jail.combinators.mount-cwd
                (jail.combinators.try-fwd-env "PKG_CONFIG_PATH")
                (jail.combinators.try-fwd-env "LD_LIBRARY_PATH")
                (jail.combinators.try-fwd-env "CARDANO_NODE_NETWORK_ID")
                (jail.combinators.try-fwd-env "CARDANO_NODE_SOCKET_PATH")
              ];
            extraReadwriteDirs = [
              "/home/paluh/.config/cabal"   # exactly the path it complains about
              "/home/paluh/.cache/cabal"          # also include the classic cabal dir (safe)
              "/home/paluh/.cabal-devx"          # also include the classic cabal dir (safe)
              "/home/paluh/.local/state/cabal"          # also include the classic cabal dir (safe)
              "/home/paluh/.local/bin/cabal-plan"          # also include the classic cabal dir (safe)
              "/home/paluh/.local/bin/ghcid"          # also include the classic cabal dir (safe)
              "/home/paluh/.config/opencode"
              "/home/paluh/.local/share/opencode"
              "/home/paluh/.cache/opencode"
              "/home/paluh/projects/cl/"
              "/home/paluh/programming/cardano/mgdoc"
            ];
            extraPkgs = commonPackages ++ [
              pkgs.stdenv.cc.cc.lib
            ];
          };
        in
          pkgs.mkShell
          {
            nativeBuildInputs = [
              config.treefmt.build.wrapper
              (inputs.jailed-agents.lib.${pkgs.system}.makeJailedOpencode {
                inherit (commonJail) baseJailOptions extraPkgs extraReadwriteDirs;
                env = {
                  LD_LIBRARY_PATH = ld-library-path;
                };
              })
              (inputs.jailed-agents.lib.${pkgs.system}.makeJailedOpencode {
                name = "jailed-bash";
                pkg = pkgs.bashInteractive;
                inherit (commonJail) baseJailOptions extraPkgs extraReadwriteDirs;
              })
            ];
            shellHook = ''
                ${config.pre-commit.installationScript}
              echo 1>&2 "Welcome to the development shell!"
            '';
            name = "konduit-js-shell";
            packages = commonPackages ++ [
            ];
          };
      };
      flake = {
        nixosModules.default = import ./nix/nixos.nix inputs.self;
      };
    };
}
