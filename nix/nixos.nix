self: {
  lib,
  config,
  pkgs,
  ...
}: let
  inherit (lib) mkOption types mapAttrs';
  inherit (pkgs) writeTextDir symlinkJoin;

  konduitAppOptions = {name, ...}: {
    options = {
      domain = mkOption {
        type = types.str;
        default = name;
        description = "The domain to host the website";
      };

      flake = mkOption {
        type = types.attrs;
        default = self;
        description = "A Nix Flake containing the website";
      };

      useSSL = mkOption {
        type = types.bool;
        default = true;
        description = "Whether to use SSL for the website";
      };
    };
  };

  mkRoot = name: {flake, ...}:
    builtins.trace "flake.packages.${pkgs.system}: ${builtins.toJSON flake.packages.${pkgs.system}}.default" flake.packages.${pkgs.system}.app + "/lib/node_modules/konduit-app/dist/";
in {
  options = {
    konduit-apps = mkOption {
      type = types.attrsOf (types.submodule konduitAppOptions);
      default = {};
      description = "Konduit app instances to run";
    };
  };

  config = {
    http-services.static-sites =
      mapAttrs'
      (name: konduit-app: {
        name = "konduit-app-${name}";
        value = {
          inherit (konduit-app) domain;
          useSSL = konduit-app.useSSL;
          root = mkRoot name konduit-app;
          index-fallback = true;
        };
      })
      config.konduit-apps;
  };
}
