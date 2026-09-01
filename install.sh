#!/bin/sh
# grain installer — downloads the prebuilt binary for your platform.
#
#   curl -fsSL https://raw.githubusercontent.com/FrontTribe/grain/main/install.sh | sh
#
# Options (env vars):
#   GRAIN_VERSION=v0.1.0        install a specific release (default: latest)
#   GRAIN_INSTALL_DIR=/path     install location (default: /usr/local/bin if
#                               writable, else ~/.local/bin)
set -eu

REPO="FrontTribe/grain"
BIN="grain"

info() { printf 'grain: %s\n' "$1"; }
err()  { printf 'grain: %s\n' "$1" >&2; }
fail() { err "$1"; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

# --- detect platform ---
uname_s=$(uname -s)
case "$uname_s" in
  Linux)  OS=linux ;;
  Darwin) OS=darwin ;;
  *) fail "unsupported OS '$uname_s'. Use npm (npx grain) or a release binary: https://github.com/$REPO/releases" ;;
esac

uname_m=$(uname -m)
case "$uname_m" in
  x86_64|amd64)   ARCH=amd64 ;;
  arm64|aarch64)  ARCH=arm64 ;;
  *) fail "unsupported architecture '$uname_m'. See https://github.com/$REPO/releases" ;;
esac

ASSET="grain-${OS}-${ARCH}"

# --- downloader ---
if have curl; then
  dl() { curl -fSL --progress-bar "$1" -o "$2"; }
  get() { curl -fsSL "$1"; }
elif have wget; then
  dl() { wget -O "$2" "$1"; }
  get() { wget -qO- "$1"; }
else
  fail "need curl or wget to download"
fi

# --- resolve version ---
VERSION="${GRAIN_VERSION:-latest}"
if [ "$VERSION" = "latest" ]; then
  VERSION=$(get "https://api.github.com/repos/$REPO/releases/latest" \
    | grep '"tag_name"' | head -1 \
    | sed -e 's/.*"tag_name":[[:space:]]*"//' -e 's/".*//')
  [ -n "$VERSION" ] || fail "could not resolve the latest release (is the repo public and does it have a release?)"
fi

URL="https://github.com/$REPO/releases/download/${VERSION}/${ASSET}"

# --- install dir ---
DIR="${GRAIN_INSTALL_DIR:-}"
if [ -z "$DIR" ]; then
  if [ -d /usr/local/bin ] && [ -w /usr/local/bin ]; then
    DIR=/usr/local/bin
  else
    DIR="$HOME/.local/bin"
  fi
fi
mkdir -p "$DIR" || fail "cannot create install dir $DIR"

# --- download + install ---
tmp=$(mktemp 2>/dev/null || mktemp -t grain) || fail "mktemp failed"
trap 'rm -f "$tmp"' EXIT INT TERM

info "downloading $ASSET ($VERSION)"
dl "$URL" "$tmp" || fail "download failed: $URL"

chmod +x "$tmp"
mv "$tmp" "$DIR/$BIN" || fail "cannot write to $DIR (set GRAIN_INSTALL_DIR to a writable path)"
trap - EXIT INT TERM

info "installed $DIR/$BIN"
if "$DIR/$BIN" version >/dev/null 2>&1; then
  info "$("$DIR/$BIN" version)"
else
  err "installed, but '$BIN version' did not run cleanly"
fi

# --- PATH hint ---
case ":$PATH:" in
  *":$DIR:"*) : ;;
  *) printf '\ngrain: %s is not on your PATH. Add this to your shell profile:\n  export PATH="%s:$PATH"\n\n' "$DIR" "$DIR" ;;
esac

info "try it: grain scan"
