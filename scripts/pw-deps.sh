#!/usr/bin/env bash
# Install the shared libraries headless Chromium needs, without root.
#
# The sandbox runs as a non-root user and the apt dpkg lock is unavailable, so
# `npx playwright install-deps` cannot work. Instead we download the .deb files
# and extract them into a private prefix, then point LD_LIBRARY_PATH at it.
# The prefix lives under ~/.local (excluded from workspace snapshots), so this
# script is re-run whenever a fresh sandbox needs screenshots or the audit.
#
#   source scripts/pw-deps.sh          # exports LD_LIBRARY_PATH
#   bash   scripts/pw-deps.sh --check  # only verify the binary resolves
set -euo pipefail

PREFIX="${HOME}/.local/pwlibs"
LIBDIR="${PREFIX}/usr/lib/x86_64-linux-gnu"
DEBS="$(mktemp -d)"

# Debian trixie renamed the ATK/AT-SPI packages with a t64 suffix; the others kept their names.
PKGS="libnss3 libnspr4 libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 libxdamage1 libxkbcommon0 libasound2t64"

if [ "${1:-}" != "--check" ]; then
  mkdir -p "$LIBDIR"
  ( cd "$DEBS" && for p in $PKGS; do apt-get download "$p" >/dev/null 2>&1 || echo "warn: could not fetch $p"; done )
  for f in "$DEBS"/*.deb; do
    dpkg-deb -x "$f" "$PREFIX" 2>/dev/null || { ( cd "$DEBS" && ar x "$(basename "$f")" && tar xf data.tar.* -C "$PREFIX" ); }
  done
  rm -rf "$DEBS"
fi

export LD_LIBRARY_PATH="${LIBDIR}${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
SHELL_BIN="$(ls -d "${HOME}"/.cache/ms-playwright/chromium_headless_shell-*/chrome-linux/headless_shell 2>/dev/null | head -1)"
if [ -n "$SHELL_BIN" ]; then
  if ldd "$SHELL_BIN" | grep -q "not found"; then
    echo "still missing:"; ldd "$SHELL_BIN" | grep "not found"; exit 1
  fi
  echo "chromium libs OK ($SHELL_BIN)"
else
  echo "no headless shell installed — run: npx playwright@1.49.1 install chromium"
fi
