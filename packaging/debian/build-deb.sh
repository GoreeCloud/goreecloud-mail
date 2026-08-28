#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="$ROOT/dist/debian"
PKG="$ROOT/packaging/debian/goreecloud-mail"

mkdir -p "$OUT"
mkdir -p "$PKG/usr/share/goreecloud-mail"

rm -rf "$PKG/usr/share/goreecloud-mail/*"
cp -r "$ROOT/web" "$PKG/usr/share/goreecloud-mail/web"

dpkg-deb --build "$PKG" "$OUT/goreecloud-mail.deb"
