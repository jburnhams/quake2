#!/bin/sh
# Builds the GitHub Pages site into apps/explorer/dist: the explorer app at SITE_BASE (default
# /quake2/), with the original demo archive beside it instead of the committed pak.pak.
#
# id's demo licence allows only the unmodified archive to be passed on, so the site carries
# q2-314-demo-x86.exe as downloaded (checked against scripts/demo-paks.sha256) and the browser
# extracts pak0.pak (src/library/demo.ts). pak.pak, a file cut from the demo, is left out.
#
# Usage: apps/explorer/scripts/build-site.sh path/to/q2-314-demo-x86.exe
set -eu

here=$(cd "$(dirname "$0")" && pwd)
app=$(cd "$here/.." && pwd)
root=$(cd "$app/../.." && pwd)
archive=$(cd "$(dirname "${1:?usage: build-site.sh path/to/q2-314-demo-x86.exe}")" && pwd)/$(basename "$1")
name=q2-314-demo-x86.exe

want=$(awk '$2 == "archive" { print $1 }' "$root/scripts/demo-paks.sha256")
got=$(sha256sum "$archive" | cut -d' ' -f1)
[ "$got" = "$want" ] || { echo "build-site: $archive has SHA-256 $got, expected $want" >&2; exit 1; }

cd "$app"
EXPLORER_BASE=${SITE_BASE:-/quake2/} VITE_DEMO_ARCHIVE=$name pnpm exec vite build
rm -f dist/pak.pak
cp "$archive" "dist/$name"
# GitHub Pages has no rewrites: a deep link (/quake2/explore?file=...) is served 404.html, which is
# the app itself, so the router takes over. .nojekyll keeps Pages from dropping files.
cp dist/index.html dist/404.html
touch dist/.nojekyll
echo "build-site: $(du -sh dist | cut -f1) in $app/dist"
