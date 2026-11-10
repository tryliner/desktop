#!/usr/bin/env bash
# bumps the PKGBUILD to a published release and regenerates .SRCINFO.
# usage: ./update.sh 0.2.13   (run on arch, needs makepkg and curl)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

VERSION="${1:?pass the release version, e.g. 0.2.13}"
BASE="https://github.com/tryliner/desktop/releases/download/v${VERSION}"

PKG_SUM="$(curl -fsSL "${BASE}/SHA256SUMS.txt" | awk -v f="liner-${VERSION}-x86_64.pkg.tar.zst" '$2 == f { print $1 }')"
[ -n "$PKG_SUM" ] || { echo "liner-${VERSION}-x86_64.pkg.tar.zst is not in the v${VERSION} SHA256SUMS.txt" >&2; exit 1; }
LICENSE_SUM="$(curl -fsSL "https://raw.githubusercontent.com/tryliner/desktop/v${VERSION}/LICENSE" | sha256sum | cut -d' ' -f1)"

sed -i \
  -e "s/^pkgver=.*/pkgver=${VERSION}/" \
  -e "s/^pkgrel=.*/pkgrel=1/" \
  -e "/^sha256sums=(/,/)/c\\sha256sums=('${PKG_SUM}'\\n            '${LICENSE_SUM}')" \
  PKGBUILD

makepkg --printsrcinfo > .SRCINFO
echo "PKGBUILD and .SRCINFO now at ${VERSION}. Test with makepkg -si, then push to the aur repo."
