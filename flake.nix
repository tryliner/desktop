{
  description = "Liner music player — Nix build";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs?ref=nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; config = { }; };
        lib = pkgs.lib;

        src = lib.cleanSourceWith {
          src = ./.;
          filter = path: _type:
            !(
              lib.hasPrefix ".git" path ||
              lib.hasPrefix "result" path ||
              lib.hasPrefix "node_modules" path
            );
        };

        pkgJson = builtins.fromJSON (builtins.readFile ./package.json);
        version = pkgJson.version;

        desktopEntry = pkgs.writeText "liner.desktop" ''
          [Desktop Entry]
          Name=Liner
          Exec=liner %u
          Icon=liner
          Type=Application
          Terminal=false
          Categories=Audio;
          MimeType=x-scheme-handler/liner;
        '';

        pnpm = pkgs.pnpm;
        pnpmDepsFinal = pkgs.fetchPnpmDeps {
          pname = "liner-deps";
          version = "0.2.12";
          inherit src pnpm;
          fetcherVersion = 5;
          hash = "sha256-zZlDVLIfENVcpAEjorx4j3TWO/t8nUFd5+NY1Tqln2k=";
        };

        appPackage = pkgs.stdenv.mkDerivation {
          pname = "liner";
          version = version;
          inherit src;

          nativeBuildInputs = [
            pkgs.nodejs
            pnpm
            pkgs.pnpmConfigHook
            pkgs.makeWrapper
            pkgs.copyDesktopItems
          ];

          pnpmDeps = pnpmDepsFinal;
          dontConfigure = true;

          env.ELECTRON_SKIP_BINARY_DOWNLOAD = "1";

          buildPhase = ''
            runHook preBuild
            # pnpmConfigHook normally runs in postConfigureHooks but we skip configure phase,
            # so run it manually to set up offline pnpm store from pnpmDeps
            export pnpmDeps=${pnpmDepsFinal}
            pnpmConfigHook
            pnpm run build
            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall
            mkdir -p $out/lib/liner
            cp -r dist dist-electron node_modules public package.json \
                  vite.config.ts tsconfig*.json $out/lib/liner/
            chmod -R u+w $out/lib/liner/node_modules
            mkdir -p $out/bin
            makeWrapper ${pkgs.electron_44-bin}/bin/electron $out/bin/liner \
              --add-flags "$out/lib/liner"

            # install tracked icons at every size upstream ships
            for f in ${src}/build/icons/*.png; do
              size="$(basename "$f" .png)"
              dir="$out/share/icons/hicolor/$size/apps"
              mkdir -p "$dir"
              cp "$f" "$dir/liner.png"
            done

            install -Dm644 ${desktopEntry} $out/share/applications/liner.desktop

            runHook postInstall
          '';

          meta = with lib; {
            description = "Liner music player";
            homepage = "https://github.com/tryliner/desktop";
            license = licenses.mit;
            platforms = [ "x86_64-linux" ];
            maintainers = [ ];
          };
        };
      in
      rec {
        packages = rec {
          default = liner;
          liner = appPackage;
        };
        apps = rec {
          default = liner;
          liner = flake-utils.lib.mkApp { drv = appPackage; };
        };
        devShells.default = pkgs.mkShell {
          name = "liner-dev";
          nativeBuildInputs = [
            pkgs.nodejs
            pnpm
            pkgs.pnpmConfigHook
            pkgs.electron_44-bin
            pkgs.makeWrapper
          ];
          shellHook = ''
            export NIX_ENFORCE_PURITY=0
            export ELECTRON_RUN_AS_NODE=0
          '';
        };
      });
}