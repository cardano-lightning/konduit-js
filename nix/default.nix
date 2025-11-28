{
  repoRoot,
  lib,
  stdenv,
  fetchFromGitHub,
  fetchYarnDeps,
  yarnConfigHook,
  yarnBuildHook,
  yarnInstallHook,
  nodejs,
}:
stdenv.mkDerivation (finalAttrs: {
  pname = "konduit-app";
  version = "0.1.0";

  src = lib.sourceByRegex ../. [
    "^eslint.config.js$"
    "^index.html$"
    "^package.json$"
    "^postcss.config.mjs$"
    "^public.*"
    "^pwa-assets.config.js$"
    "^src.*"
    "^tsconfig.json$"
    "^vite.config.js$"
    "^yarn.lock$"
  ];

  yarnOfflineCache = fetchYarnDeps {
    yarnLock = finalAttrs.src + "/yarn.lock";
    # Please uncomment the line fake hash line below and run `nix build .#app`
    # to get the new hash. Please also leave this comment and that line in place :-P
    hash = "sha256-ejG38iKBDWIJksj9akG9g8R68NrSJYUCR8MsPa4WVOI=";
    # hash = lib.fakeHash;
  };

  nativeBuildInputs = [
    yarnConfigHook
    yarnBuildHook
    yarnInstallHook
    # Needed for executing package.json scripts
    nodejs
  ];

  meta = {
    description = "Konduit App. A PWA for the konduit - a Cardano to Bitcoin Lightning Network pipe.";
  };
})
