#!/bin/bash
set -euo pipefail

artifact_dir="${1:-release}"
expected_team_id="${EXPECTED_APPLE_TEAM_ID:-}"

if [[ ! "$expected_team_id" =~ ^[A-Z0-9]{10}$ ]]; then
  echo "EXPECTED_APPLE_TEAM_ID must be the 10-character Apple Developer Team ID." >&2
  exit 1
fi

if [[ ! -d "$artifact_dir" ]]; then
  echo "macOS artifact directory not found: $artifact_dir" >&2
  exit 1
fi

shopt -s nullglob
dmg_files=("$artifact_dir"/*.dmg)
zip_files=("$artifact_dir"/*.zip)

if [[ ${#dmg_files[@]} -ne 2 || ${#zip_files[@]} -ne 2 ]]; then
  echo "Expected two architecture-specific DMGs and two update ZIPs in $artifact_dir; found ${#dmg_files[@]} DMGs and ${#zip_files[@]} ZIPs." >&2
  exit 1
fi

update_metadata="$artifact_dir/latest-mac.yml"
if [[ ! -f "$update_metadata" ]]; then
  echo "Electron update metadata is missing: $update_metadata" >&2
  exit 1
fi

for arch in arm64 x64; do
  arch_dmg=("$artifact_dir"/*-"$arch".dmg)
  arch_zip=("$artifact_dir"/*-"$arch".zip)
  if [[ ${#arch_dmg[@]} -ne 1 || ${#arch_zip[@]} -ne 1 ]]; then
    echo "Expected exactly one DMG and ZIP for macOS architecture $arch." >&2
    exit 1
  fi
  if ! grep -Fq "$(basename "${arch_zip[0]}")" "$update_metadata"; then
    echo "latest-mac.yml does not reference the $arch update ZIP: ${arch_zip[0]}" >&2
    exit 1
  fi
done

temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/liner-macos-artifacts.XXXXXX")"
mount_dir="$temp_dir/mounted"
mkdir -p "$mount_dir"

cleanup() {
  hdiutil detach "$mount_dir" -quiet -force >/dev/null 2>&1 || true
  rm -rf "$temp_dir"
}
trap cleanup EXIT

find_app_bundle() {
  local root="$1"
  find "$root" -type d -name "*.app" -prune -print -quit
}

verify_app_bundle() {
  local app_path="$1"
  local signature_output team_id authority

  if [[ -z "$app_path" || ! -d "$app_path" ]]; then
    echo "No .app bundle found in artifact." >&2
    return 1
  fi

  echo "Verifying $app_path"
  codesign --verify --deep --strict --verbose=2 "$app_path"
  signature_output="$(codesign -dv --verbose=4 "$app_path" 2>&1)"
  team_id="$(sed -n 's/^TeamIdentifier=//p' <<< "$signature_output" | head -n 1)"
  authority="$(sed -n '/^Authority=Developer ID Application:/p' <<< "$signature_output" | head -n 1)"

  if [[ "$team_id" != "$expected_team_id" ]]; then
    echo "Unexpected Team Identifier in $app_path: '$team_id'" >&2
    return 1
  fi
  if [[ "$authority" != *"($expected_team_id)" ]]; then
    echo "Developer ID Application authority does not match Team Identifier in $app_path." >&2
    return 1
  fi

  xcrun stapler validate "$app_path"
  spctl --assess --type execute --verbose=2 "$app_path"
}

for artifact in "${zip_files[@]}"; do
  extract_dir="$temp_dir/zip-$(basename "$artifact" .zip)"
  mkdir -p "$extract_dir"
  ditto -x -k "$artifact" "$extract_dir"
  app_path="$(find_app_bundle "$extract_dir")"
  verify_app_bundle "$app_path"
done

for artifact in "${dmg_files[@]}"; do
  hdiutil attach "$artifact" -readonly -nobrowse -mountpoint "$mount_dir" >/dev/null
  app_path="$(find_app_bundle "$mount_dir")"
  verify_app_bundle "$app_path"
  hdiutil detach "$mount_dir" -quiet
done

echo "All macOS DMG and update ZIP artifacts passed signature, Team ID, notarization, and Gatekeeper checks."
