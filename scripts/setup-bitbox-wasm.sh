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

# Pinned hashes for bitbox-api 0.12.0.
#
# How these were captured:
#   curl -sL https://registry.npmjs.org/bitbox-api/-/bitbox-api-0.12.0.tgz \
#     | shasum -a 256
#   # → tarball SHA-256
#   #   e03095a8e546bcfa61639317af15c88d5d241c4ba6bec65ef2ecf8951f92abf9
#   tar -xzf .../bitbox-api-0.12.0.tgz
#   shasum -a 256 package/bitbox_api.js package/bitbox_api_bg.wasm
#
# Cross-checked against npm registry's metadata `dist.shasum` (SHA-1):
#   ff7a97d43b71cb2fd7c9d0d5f3e76097dfbdfb61
# which matches the tarball SHA-1, ruling out in-flight tampering between
# the registry and the download.
#
# Publisher: benmma (Marko Bencun, BitBoxSwiss maintainer per the
# `repository` field pointing at github.com/BitBoxSwiss/bitbox-api-rs).
# Published at 2026-01-20T09:41:45.506Z.
#
# When bumping VERSION:
#   1. Run `--capture` and inspect the diff.
#   2. Cross-check the tarball SHA-1 against npm's `dist.shasum` metadata
#      (curl https://registry.npmjs.org/bitbox-api/<VERSION> | jq '.dist').
#   3. Code-review the bitbox-api-rs commit range between the previous
#      pinned commit and the new release.
#   4. Commit the new values + this comment block updated.
#
# A function (not associative arrays) keeps the script portable to
# macOS's default bash 3.x.
expected_sha256() {
  case "$1/$2" in
    "0.12.0/bitbox_api.js")
      echo "b71c1779a2032906e043a58c2cf41e13da3d58febb18bc3eb41e4b440267238f" ;;
    "0.12.0/bitbox_api_bg.wasm")
      echo "ca59c51054978db8d943a4ce24b378a85ffc1d400d6014f3d58fa0aaba8cea06" ;;
    *) echo "" ;;
  esac
}

# Tarball-level integrity (SHA-256 over the entire .tgz bytes). Verified
# against npm registry's dist.shasum (SHA-1) by --apply / --check before
# extraction, so a tampered tarball is rejected before its files even
# reach disk.
expected_tarball_sha256() {
  case "$1" in
    "0.12.0")
      echo "e03095a8e546bcfa61639317af15c88d5d241c4ba6bec65ef2ecf8951f92abf9" ;;
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
  # Progress to stderr so the caller's $(download) captures only the
  # path on stdout. The previous implementation echoed progress on
  # stdout, polluting the return value with a multi-line string that
  # silently broke every downstream path expansion — every CI run
  # then reported "file missing" against bogus paths.
  echo "==> downloading bitbox-api@$VERSION..." >&2
  curl --fail --silent --show-error --location \
    --output "$out" \
    "https://registry.npmjs.org/bitbox-api/-/bitbox-api-$VERSION.tgz" >&2

  # Verify the tarball itself BEFORE extraction. Catches a tampered
  # registry response before any of its files touch disk.
  local expected_tar
  expected_tar=$(expected_tarball_sha256 "$VERSION")
  if [[ -n "$expected_tar" ]]; then
    local actual_tar
    actual_tar=$(shasum -a 256 "$out" | awk '{print $1}')
    if [[ "$actual_tar" != "$expected_tar" ]]; then
      cat >&2 <<EOF
ERROR: tarball SHA-256 mismatch for bitbox-api@$VERSION
       expected $expected_tar
       actual   $actual_tar
       The .tgz downloaded from npm does not match the pinned hash.
       This is a supply-chain alarm — investigate before proceeding.
EOF
      exit 1
    fi
    echo "==> tarball verified ($actual_tar)" >&2
  fi

  tar -xzf "$out" -C "$TMP_DIR" >&2
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
