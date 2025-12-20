{
  repoRoot,
  lib,
  stdenv,
  yarn-berry_4,
  nodejs,
}:
let
  yarn-berry = yarn-berry_4;
in
  stdenv.mkDerivation (finalAttrs: {
    pname = "konduit-app";
    version = "0.1.0";

    src = lib.sourceByRegex ../. [
      "^index.html$"
      "^package.json$"
      "^postcss.config.mjs$"
      "^public.*"
      "^pwa-assets.config.js$"
      "^src.*"
      "^tsconfig.json$"
      "^vite.config.js$"
      "^yarn.lock$"
      "^packages.*"
      "^apps.*"
    ];

    missingHashes = ./missing-hashes.json;

    yarnOfflineCache = yarn-berry.fetchYarnBerryDeps {
      inherit (finalAttrs) src missingHashes;
      yarnLock = finalAttrs.src + "/yarn.lock";
      # In order to update the hash you should run in the root dir:
      # * `$ yarn-berry-fetcher prefetch yarn.lock ./nix/missing-hashes.json`
      # * Then copy the new hash from the output and paste it below.
      #
      # If the above command fails because of some missing hashes you should update the missing-hashes.json file:
      # * `$ yarn-berry-fetcher missing-hashes yarn.lock > ./nix/missing-hashes.json`
      # * Then re-run the prefetch command.
      hash = "sha256-FiMDYV+HGNMwYEe+4no7/aCM8v52YxjdkmHwG2nhy+0=";
    };

    nativeBuildInputs = [
      # Needed for executing package.json scripts
      nodejs
      yarn-berry.yarnBerryConfigHook
    ];

    buildInputs = [
      yarn-berry
    ];

    buildPhase = ''
      yarn exec vue-tsc --build
      yarn exec vite build apps/konduit-app
    '';

    installPhase = ''
      mkdir -p $out
      cp -r apps/konduit-app/dist/* $out/
    '';

    meta = {
      description = "Konduit App. A PWA for the konduit - a Cardano to Bitcoin Lightning Network pipe.";
    };
  })
