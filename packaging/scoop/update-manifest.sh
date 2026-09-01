#!/bin/sh
# Regenerate the Scoop manifest (packaging/scoop/grain.json) for a released version.
#
#   ./packaging/scoop/update-manifest.sh v0.1.0
#
# Requires: curl, and shasum (macOS) or sha256sum (Linux). The release must be
# published. Set GRAIN_ASSET_DIR to read pre-downloaded assets (used in CI).
set -eu

VERSION="${1:-}"
[ -n "$VERSION" ] || { echo "usage: $0 vX.Y.Z" >&2; exit 1; }
case "$VERSION" in v*) ;; *) VERSION="v$VERSION" ;; esac
ver="${VERSION#v}"

REPO="FrontTribe/grain"
OUT="$(cd "$(dirname "$0")" && pwd)/grain.json"
ASSET_DIR="${GRAIN_ASSET_DIR:-}"
tmp=$(mktemp -d) || exit 1
trap 'rm -rf "$tmp"' EXIT INT TERM

sha_of() {
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'; else sha256sum "$1" | awk '{print $1}'; fi
}
fetch_sha() {
  a="$1"
  if [ -n "$ASSET_DIR" ] && [ -f "$ASSET_DIR/$a" ]; then sha_of "$ASSET_DIR/$a"; return; fi
  curl -fsSL "https://github.com/$REPO/releases/download/$VERSION/$a" -o "$tmp/$a" \
    || { echo "grain: failed to download $a for $VERSION — is the release published?" >&2; exit 1; }
  sha_of "$tmp/$a"
}

echo "grain: fetching Windows assets for $VERSION …"
H64=$(fetch_sha grain-windows-amd64.exe)
HARM=$(fetch_sha grain-windows-arm64.exe)

# Emit the manifest with literal Scoop tokens ($dir, $version) intact via a
# quoted heredoc, then substitute the dynamic values with sed (| delimiter so
# URL slashes are safe).
cat > "$OUT" <<'JSON'
{
  "version": "__VER__",
  "description": "Code provenance layer — see how much of your codebase is human-written vs AI. Signals, not verdicts.",
  "homepage": "https://github.com/__REPO__",
  "license": "MIT",
  "architecture": {
    "64bit": {
      "url": "https://github.com/__REPO__/releases/download/v__VER__/grain-windows-amd64.exe",
      "hash": "__H64__"
    },
    "arm64": {
      "url": "https://github.com/__REPO__/releases/download/v__VER__/grain-windows-arm64.exe",
      "hash": "__HARM__"
    }
  },
  "pre_install": "Get-ChildItem \"$dir\\grain-windows-*.exe\" | Rename-Item -NewName 'grain.exe'",
  "bin": "grain.exe",
  "checkver": "github",
  "autoupdate": {
    "architecture": {
      "64bit": { "url": "https://github.com/__REPO__/releases/download/v$version/grain-windows-amd64.exe" },
      "arm64": { "url": "https://github.com/__REPO__/releases/download/v$version/grain-windows-arm64.exe" }
    }
  }
}
JSON

sed -i.bak \
  -e "s|__VER__|$ver|g" \
  -e "s|__REPO__|$REPO|g" \
  -e "s|__H64__|$H64|g" \
  -e "s|__HARM__|$HARM|g" \
  "$OUT"
rm -f "$OUT.bak"

echo "grain: wrote $OUT for $VERSION"
echo "grain: next — copy it into FrontTribe/scoop-bucket as bucket/grain.json and push (see packaging/scoop/README.md)."
