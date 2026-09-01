#!/bin/sh
# Fill packaging/homebrew/grain.rb with real checksums for a published release.
#
#   ./packaging/homebrew/update-formula.sh v0.1.0
#
# Requires: curl, and shasum (macOS) or sha256sum (Linux). The release must be
# published (git tag vX.Y.Z && git push origin vX.Y.Z → the release workflow).
set -eu

VERSION="${1:-}"
[ -n "$VERSION" ] || { echo "usage: $0 vX.Y.Z" >&2; exit 1; }
case "$VERSION" in v*) ;; *) VERSION="v$VERSION" ;; esac
ver="${VERSION#v}"

REPO="FrontTribe/grain"
OUT="$(cd "$(dirname "$0")" && pwd)/grain.rb"
# When set (e.g. in CI), read assets from this dir instead of downloading them.
ASSET_DIR="${GRAIN_ASSET_DIR:-}"
tmp=$(mktemp -d) || exit 1
trap 'rm -rf "$tmp"' EXIT INT TERM

sha_of() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    sha256sum "$1" | awk '{print $1}'
  fi
}

fetch_sha() {
  asset="$1"
  if [ -n "$ASSET_DIR" ] && [ -f "$ASSET_DIR/$asset" ]; then
    sha_of "$ASSET_DIR/$asset"
    return
  fi
  curl -fsSL "https://github.com/$REPO/releases/download/$VERSION/$asset" -o "$tmp/$asset" \
    || { echo "grain: failed to download $asset for $VERSION — is the release published?" >&2; exit 1; }
  sha_of "$tmp/$asset"
}

echo "grain: fetching release assets for $VERSION …"
DA=$(fetch_sha grain-darwin-arm64)
DI=$(fetch_sha grain-darwin-amd64)
LA=$(fetch_sha grain-linux-arm64)
LI=$(fetch_sha grain-linux-amd64)

cat > "$OUT" <<EOF
# typed: false
# frozen_string_literal: true

# Homebrew formula for grain. Updated by packaging/homebrew/update-formula.sh.
class Grain < Formula
  desc "Code provenance layer — see how much of your codebase is human-written vs AI"
  homepage "https://github.com/$REPO"
  version "$ver"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/$REPO/releases/download/v#{version}/grain-darwin-arm64"
      sha256 "$DA"
    end
    on_intel do
      url "https://github.com/$REPO/releases/download/v#{version}/grain-darwin-amd64"
      sha256 "$DI"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/$REPO/releases/download/v#{version}/grain-linux-arm64"
      sha256 "$LA"
    end
    on_intel do
      url "https://github.com/$REPO/releases/download/v#{version}/grain-linux-amd64"
      sha256 "$LI"
    end
  end

  def install
    bin.install Dir["grain-*"].first => "grain"
  end

  test do
    assert_match "grain #{version}", shell_output("#{bin}/grain version")
  end
end
EOF

echo "grain: wrote $OUT for $VERSION"
echo "grain: next — copy it into FrontTribe/homebrew-tap as Formula/grain.rb and push (see packaging/homebrew/README.md)."
