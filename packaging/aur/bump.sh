#!/usr/bin/env bash
#
# Bumps the AUR packaging recipes to an upstream release.
#
#   usage: bump.sh <version>
#
# Updates pkgver in every recipe and refreshes the checksums of the
# prebuilt upstream artifact. The source-built recipe computes its version
# from the git history at build time, so its pkgver is only a fallback.
set -euo pipefail

version="${1:-}"
if [ -z "$version" ]; then
  echo "usage: $(basename "$0") <version>" >&2
  exit 1
fi
version="${version#v}"

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> bumping packaging recipes to ${version}"

for pkgbuild in "$root"/*/PKGBUILD; do
  sed -i -E "s/^pkgver=.*/pkgver=${version}/" "$pkgbuild"
  sed -i -E "s/^pkgrel=.*/pkgrel=1/" "$pkgbuild"
  echo "    ${pkgbuild#"$root"/}"
done

# the prebuilt recipe ships the upstream .deb, so its checksums have to be
# recomputed for the new release
bin="$root/liner-desktop-bin"
deb="liner_${version}_amd64.deb"
deb_url="https://github.com/tryliner/desktop/releases/download/v${version}/${deb}"
lic_url="https://raw.githubusercontent.com/tryliner/desktop/v${version}/LICENSE"

# the release is published before the linux artifacts are uploaded, so give
# the .deb a few minutes to appear
deb_path="${bin}/${deb}"
tmp_path="${deb_path}.part"
rm -f "$tmp_path"

# the deb is the first source, so its checksum is the first entry of b2sums
known_deb_sum="$(sed -n "/^b2sums=($/,/^)/p" "${bin}/PKGBUILD" | sed -n '2p' | tr -d " '")"

if [ -f "$deb_path" ] && [ -n "$known_deb_sum" ] &&
   [ "$(b2sum "$deb_path" | cut -d' ' -f1)" = "$known_deb_sum" ]; then
  echo "    reusing the already downloaded ${deb}"
  deb_sum="$known_deb_sum"
else
  for attempt in $(seq 1 10); do
    echo "    downloading ${deb} (attempt ${attempt}/10)"
    if curl -fsSL --retry 3 --retry-delay 5 -o "$tmp_path" "$deb_url"; then
      mv "$tmp_path" "$deb_path"
      break
    fi
    rm -f "$tmp_path"
    sleep 30
  done

  if [ ! -f "$deb_path" ]; then
    echo "error: could not download ${deb_url}" >&2
    exit 1
  fi

  deb_sum="$(b2sum "$deb_path" | cut -d' ' -f1)"
fi

lic_path="${bin}/.LICENSE.tmp"
if ! curl -fsSL --retry 3 --retry-delay 5 -o "$lic_path" "$lic_url" || [ ! -s "$lic_path" ]; then
  echo "error: could not download ${lic_url}" >&2
  exit 1
fi
lic_sum="$(b2sum "$lic_path" | cut -d' ' -f1)"
rm -f "$lic_path"

echo "    deb    ${deb_sum}"
echo "    LICENSE ${lic_sum}"

# rewrite the b2sums array of a recipe, in the order the sources are listed:
# the downloaded ones use the sums computed above, the local files (the
# desktop entry and the launcher) are hashed from the recipe directory
refresh_b2sums() {
  local recipe="$1"
  local dir="${recipe%/PKGBUILD}"
  local deb="$2" lic="$3"

  local -a sums=()
  local entry name
  while read -r entry; do
    # a source is either "file" or "name::url"; the name is what ends up in
    # the source directory, the url is where it comes from
    name="${entry%%::*}"
    case "$name" in
      git+*) sums+=("SKIP") ;;
      *_amd64.deb) sums+=("$deb") ;;
      LICENSE) sums+=("$lic") ;;
      http*|https*) sums+=("SKIP") ;;
      *)
        if [ -f "${dir}/${name}" ]; then
          sums+=("$(b2sum "${dir}/${name}" | cut -d' ' -f1)")
        else
          echo "error: ${dir}/${name} is listed as a source but missing" >&2
          exit 1
        fi
        ;;
    esac
  done < <(sed -n "/^source=($/,/^)/p" "$recipe" | grep -oE "'[^']+'|\"[^\"]+\"" | tr -d "'\"")

  if [ "${#sums[@]}" -eq 0 ]; then
    echo "error: could not read the source array of ${recipe}" >&2
    exit 1
  fi

  # write the new block, then splice it over the old one in place
  {
    echo "b2sums=("
    local sum
    for sum in "${sums[@]}"; do
      echo "  '${sum}'"
    done
    echo ")"
  } > "${recipe}.sums"

  awk '
    /^b2sums=\($/ {
      while ((getline line < block) > 0) print line
      close(block)
      skip = 1
      next
    }
    skip && /^\)$/ { skip = 0; next }
    !skip { print }
  ' block="${recipe}.sums" "$recipe" > "${recipe}.new"
  mv "${recipe}.new" "$recipe"
  rm -f "${recipe}.sums"
}

refresh_b2sums "${bin}/PKGBUILD" "$deb_sum" "$lic_sum"
refresh_b2sums "${root}/liner-desktop-git/PKGBUILD" "$deb_sum" "$lic_sum"

rm -f "$deb_path"

echo "==> done"
