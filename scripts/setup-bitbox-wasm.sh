#!/usr/bin/env bash
# Setup-bitbox-wasm — fetch, verify and stage the bitbox-api WASM bundle.
#
# What this script does:
#   1. Determines the target version (env BITBOX_API_VERSION, default 0.12.0).
#   2. Pulls bitbox_api.js + bitbox_api_bg.wasm from the npm package tarball.
#   3. Verifies SHA-256 against pinned values below; refuses to proceed on
#      a mismatch (supply-chain defence).
#   4. Stages the files under assets/bitbox-bridge/ so the WebView can load
#      them as bundled resources at runtime.
#   5. Updates app.json's assetBundlePatterns if necessary.
#
# Re-run after bumping BITBOX_API_VERSION. CI calls this via:
#   bash scripts/setup-bitbox-wasm.sh --check
# which only verifies the staged artefacts; --apply rewrites them.
#
# DO NOT commit assets/bitbox-bridge/ — it is generated. The hashes below
# are the source of truth; modifying them requires a code-review of the
# upstream release notes for the bumped version.

set -euo pipefail

VERSION="${BITBOX_API_VERSION:-0.12.0}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE_DIR="$ROOT/assets/bitbox-bridge"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Pinned hashes — when bumping VERSION, regenerate by running this script
# in --capture mode, inspect the diff, code-review the bitbox-api-rs commit
# range, then commit the new values here.
#
# Using a function (not associative arrays) keeps the script portable to
# macOS's default bash 3.x.
expected_sha256() {
  case "$1/$2" in
    "0.12.0/bitbox_api.js")     echo "REPLACE_WITH_REAL_SHA256_OF_bitbox_api_js" ;;
    "0.12.0/bitbox_api_bg.wasm") echo "REPLACE_WITH_REAL_SHA256_OF_bitbox_api_bg_wasm" ;;
    *) echo "" ;;
  esac
}

usage() {
  cat >&2 <<EOF
Usage: setup-bitbox-wasm.sh [--apply | --check | --capture]
  --apply    Download, verify against pinned hashes, stage under assets/bitbox-bridge/.
  --check    Only verify already-staged files against pinned hashes; exit nonzero on mismatch.
  --capture  Download, print the SHA-256 hashes, do not stage anything. Used to bump VERSION.

Env:
  BITBOX_API_VERSION   npm package version to pull (default 0.12.0)
EOF
  exit 2
}

MODE="${1:-}"
case "$MODE" in
  --apply|--check|--capture) ;;
  *) usage ;;
esac

download() {
  local out="$TMP_DIR/bitbox-api.tgz"
  echo "==> downloading bitbox-api@$VERSION..."
  curl --fail --silent --show-error --location \
    --output "$out" \
    "https://registry.npmjs.org/bitbox-api/-/bitbox-api-$VERSION.tgz"
  tar -xzf "$out" -C "$TMP_DIR"
  # npm tarball unpacks under "package/"
  local pkg="$TMP_DIR/package"
  for f in bitbox_api.js bitbox_api_bg.wasm; do
    [[ -f "$pkg/$f" ]] || {
      echo "ERROR: $f missing from bitbox-api@$VERSION tarball" >&2
      exit 1
    }
  done
  echo "$pkg"
}

verify() {
  local pkg="$1"
  for f in bitbox_api.js bitbox_api_bg.wasm; do
    local expected
    expected=$(expected_sha256 "$VERSION" "$f")
    if [[ -z "$expected" || "$expected" == REPLACE_* ]]; then
      echo "ERROR: no pinned SHA-256 for $VERSION/$f. Run --capture and update the script." >&2
      exit 1
    fi
    local actual
    actual=$(shasum -a 256 "$pkg/$f" | awk '{print $1}')
    if [[ "$actual" != "$expected" ]]; then
      cat >&2 <<EOF
ERROR: SHA-256 mismatch for $f at version $VERSION
       expected $expected
       actual   $actual
       This is a supply-chain alarm — investigate before proceeding.
EOF
      exit 1
    fi
    echo "==> $f verified ($actual)"
  done
}

stage() {
  local pkg="$1"
  mkdir -p "$STAGE_DIR"
  for f in bitbox_api.js bitbox_api_bg.wasm; do
    cp "$pkg/$f" "$STAGE_DIR/$f"
  done
  echo "==> staged to $STAGE_DIR"
  echo
  echo "Next step: bundle the assets in the app build."
  echo "  - For Expo: add \"assets/bitbox-bridge/**\" to assetBundlePatterns in app.json."
  echo "  - For bare RN: include assets/bitbox-bridge/ in the bundle resource pattern."
}

case "$MODE" in
  --capture)
    pkg=$(download)
    for f in bitbox_api.js bitbox_api_bg.wasm; do
      printf '  "%s/%s"="%s"\n' "$VERSION" "$f" "$(shasum -a 256 "$pkg/$f" | awk '{print $1}')"
    done
    ;;
  --apply)
    pkg=$(download)
    verify "$pkg"
    stage "$pkg"
    ;;
  --check)
    [[ -d "$STAGE_DIR" ]] || {
      echo "ERROR: $STAGE_DIR does not exist. Run --apply first." >&2
      exit 1
    }
    verify "$STAGE_DIR"
    echo "==> staged files match pinned hashes."
    ;;
esac
