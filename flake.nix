{
  description = "Konduit: A Cardano to Bitcoin Lightning Network pipe";

  inputs = {
    flake-parts.url = "github:hercules-ci/flake-parts";
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
        in
          pkgs.mkShell
          {
            nativeBuildInputs = [
              config.treefmt.build.wrapper
            ];
            shellHook = ''
                ${config.pre-commit.installationScript}
              echo 1>&2 "Welcome to the development shell!"
            '';
            name = "konduit-js-shell";
            packages = [
              pkgs.yarn-berry
              pkgs.yarn-bash-completion
              pkgs.nodePackages_latest.nodejs
              pkgs.typescript-language-server
              vue-language-server
              vtsls
            ];
          };
      };
      flake = {
        nixosModules.default = import ./flake/nixos.nix inputs.self;
      };
    };
}
