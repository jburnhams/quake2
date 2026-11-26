#!/bin/sh
# Builds the site into apps/explorer/dist: the explorer app at SITE_BASE, with the original demo
# archive beside it instead of the committed pak.pak.
#
# SITE_HOST=github (the default) is GitHub Pages at /quake2/: the archive is copied into dist and
# 404.html is the app. SITE_HOST=cloudflare is the Worker in wrangler.jsonc at /: the archive is
# over Cloudflare's 25 MiB asset limit, so the Worker serves it (worker/handle.ts) and it is left out
# of dist, and deep links need no 404.html (not_found_handling is single-page-application).
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

host=${SITE_HOST:-github}
case $host in
  github) base=${SITE_BASE:-/quake2/} ;;
  cloudflare) base=${SITE_BASE:-/} ;;
  *) echo "build-site: SITE_HOST is $host, expected github or cloudflare" >&2; exit 1 ;;
esac

cd "$app"
EXPLORER_BASE=$base VITE_DEMO_ARCHIVE=$name pnpm exec vite build
rm -f dist/pak.pak
if [ "$host" = cloudflare ]; then
  echo "build-site: $(du -sh dist | cut -f1) in $app/dist (the Worker serves $name)"
  exit 0
fi
cp "$archive" "dist/$name"
# GitHub Pages has no rewrites: a deep link (/quake2/explore?file=...) is served 404.html, which is
# the app itself, so the router takes over. .nojekyll keeps Pages from dropping files.
cp dist/index.html dist/404.html
touch dist/.nojekyll
echo "build-site: $(du -sh dist | cut -f1) in $app/dist"
