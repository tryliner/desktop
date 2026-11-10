# AUR package

`liner-bin` repackages the `liner-<version>-x86_64.pkg.tar.zst` that the release workflow attaches to every GitHub release. Arch users who do not want the AUR can install that file directly with `sudo pacman -U`.

## Releasing a new version

1. Wait for the release workflow to publish `v<version>` with its `SHA256SUMS.txt`.
2. Run `./update.sh <version>`. It sets `pkgver`, resets `pkgrel`, fills in the checksums and regenerates `.SRCINFO`.
3. Build and install it once: `makepkg -si`.
4. Copy `PKGBUILD` and `.SRCINFO` into the clone of `ssh://aur@aur.archlinux.org/liner-bin.git`, commit and push.

## Updates

The release `.pkg.tar.zst` updates itself through electron-updater (`pacman -U`). The AUR package removes `resources/package-type`, so the in-app updater stays idle and updates come from the AUR helper instead.
