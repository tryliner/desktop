#!/usr/bin/env bash
#
# Publishes the packaging recipes to the AUR.
#
#   usage: publish.sh [version]
#
# With a version argument the recipes are bumped first (see bump.sh). The
# .SRCINFO files are regenerated and the result is pushed to the AUR git
# repositories.
#
# Requirements:
#   - an AUR account that owns the package bases
#   - an ssh key registered with the AUR, loaded into your agent:
#       ssh-add ~/.ssh/id_aur
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
aur_host="${AUR_HOST:-aur.archlinux.org}"
packages=("liner-desktop-bin" "liner-desktop-git")
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

if [ -n "${1:-}" ]; then
  "$root/bump.sh" "$1"
fi

# regenerate .SRCINFO for every recipe
gen_srcinfo() {
  local dir="$1"
  if command -v makepkg >/dev/null 2>&1; then
    (cd "$dir" && makepkg --printsrcinfo > .SRCINFO)
  elif command -v docker >/dev/null 2>&1; then
    # makepkg refuses to run as root, so drop to the invoking user
    docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
      -v "${dir}:/pkg" -w /pkg archlinux/archlinux:latest \
      makepkg --printsrcinfo > "${dir}/.SRCINFO"
  else
    echo "error: need makepkg or docker to generate .SRCINFO" >&2
    exit 1
  fi
}

# packages built from a vcs checkout compute their version at build time;
# record that version in .SRCINFO so the AUR page is not stuck on the
# fallback version
refresh_vcs_version() {
  local dir="$1"
  local url
  url="$(sed -n "s/.*'\(git+[^']*\)'.*/\1/p" "$dir/PKGBUILD" | head -n 1)"
  [ -n "$url" ] || return 0
  url="${url#git+}"
  url="${url%%#*}"
  url="${url%.git}"

  local tmp version
  tmp="$(mktemp -d)"
  if ! git clone --quiet --mirror "$url" "${tmp}/desktop"; then
    rm -rf "$tmp"
    # gen_srcinfo has already written the static fallback into .SRCINFO:
    # pushing that would take the AUR page backwards, so publish nothing. the
    # next run retries.
    echo "    could not clone ${url}, skipping this package" >&2
    return 1
  fi

  # reuse the recipe's own pkgver() so both always agree
  version="$( cd "$dir" && source ./PKGBUILD && srcdir="$tmp" && pkgver 2>/dev/null )" || version=""
  rm -rf "$tmp"

  if [ -z "$version" ]; then
    echo "    could not determine the vcs version, skipping this package" >&2
    return 1
  fi

  sed -i -E "s/^([[:space:]]*pkgver = ).*/\1${version}/" "$dir/.SRCINFO"
  echo "    vcs version ${version}"
}

for pkg in "${packages[@]}"; do
  src="${root}/${pkg}"
  dest="${workdir}/${pkg}"

  echo "==> ${pkg}"
  gen_srcinfo "$src"
  if ! refresh_vcs_version "$src"; then
    echo "    leaving the AUR copy of ${pkg} untouched"
    continue
  fi

  if ! git clone --quiet "ssh://aur@${aur_host}/${pkg}.git" "$dest"; then
    echo "error: cannot clone ssh://aur@${aur_host}/${pkg}.git" >&2
    echo "       check that the package base exists and that your ssh key is" >&2
    echo "       registered with the AUR (see packaging/aur/README.md)" >&2
    exit 1
  fi

  cp "$src/PKGBUILD" "$src/.SRCINFO" "$dest/"

  # the local files listed in source=() have to be pushed as well, the AUR
  # build downloads them from the package repo like any other source.
  # "name::url" entries are fetched from the url, only the plain ones are
  # files that live next to the PKGBUILD.
  while read -r entry; do
    case "$entry" in
      *::*) continue ;;
      git+*) continue ;;
    esac
    if [ ! -f "$src/$entry" ]; then
      echo "error: ${src}/${entry} is listed as a source but missing" >&2
      exit 1
    fi
    cp "$src/$entry" "$dest/"
  done < <(sed -n "/^source=($/,/^)/p" "$src/PKGBUILD" | grep -oE "'[^']+'|\"[^\"]+\"" | tr -d "'\"")

  version="$(sed -n 's/^[[:space:]]*pkgver = //p' "$src/.SRCINFO" | head -n 1)"

  if [ -z "$(git -C "$dest" status --porcelain)" ]; then
    echo "    no changes, skipping"
    continue
  fi

  # the runner has no git identity configured; write one into this throwaway
  # clone only so the commit succeeds regardless of the global config
  git -C "$dest" config user.name "liner-aur-sync"
  git -C "$dest" config user.email "aur-sync@tryliner.fun"

  git -C "$dest" add -A
  git -C "$dest" commit --quiet -m "sync to ${version}"
  git -C "$dest" push --quiet
  echo "    pushed to https://aur.archlinux.org/packages/${pkg}"
done

echo "==> done"
