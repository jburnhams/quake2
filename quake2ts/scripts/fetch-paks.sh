#!/bin/sh
# Fetches the Quake 2 demo's baseq2/pak0.pak into quake2ts/.paks/baseq2/.
#
# The pak is never committed. id's demo licence lets the demo be redistributed only
# as the original, unmodified archive, so this downloads q2-314-demo-x86.exe itself
# (a self-extracting zip), checks it against the SHA-256 pinned in demo-paks.sha256,
# and extracts the one file we need.
#
# Sources are tried in order: this repo's `demo-paks` release (put there by
# .github/workflows/demo-paks.yml), then public mirrors of id's old FTP.
#
# Usage: scripts/fetch-paks.sh            fetch and verify (no-op if already there)
#        scripts/fetch-paks.sh --unpinned  skip the archive hash check (only for the
#                                          mirror workflow, which prints the hash to pin)
# Prints the path of pak0.pak on success. Override the output folder with Q2_PAK_DIR;
# Q2_DEMO_URL adds a source tried first (any URL curl takes, file:// included).
set -eu

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/.." && pwd)
out_dir=${Q2_PAK_DIR:-"$root/.paks"}
pak="$out_dir/baseq2/pak0.pak"
archive_name=q2-314-demo-x86.exe
member=Install/Data/baseq2/pak0.pak
pin_file="$here/demo-paks.sha256"

unpinned=0
[ "${1:-}" = "--unpinned" ] && unpinned=1

pinned_hash() { # $1 = archive | pak
  [ -f "$pin_file" ] || return 0
  awk -v k="$1" '$2 == k { print $1 }' "$pin_file"
}

sha256() { sha256sum "$1" | cut -d' ' -f1; }

want_pak=$(pinned_hash pak)
if [ -f "$pak" ] && [ -n "$want_pak" ] && [ "$(sha256 "$pak")" = "$want_pak" ]; then
  echo "$pak"
  exit 0
fi

want_archive=$(pinned_hash archive)
if [ -z "$want_archive" ] && [ "$unpinned" -eq 0 ]; then
  echo "fetch-paks: no archive hash pinned in $pin_file; run the demo-paks workflow first" >&2
  exit 1
fi

mirrors="${Q2_DEMO_URL:-}
https://github.com/jburnhams/quake2/releases/download/demo-paks/$archive_name
https://deponie.yamagi.org/quake2/idstuff/$archive_name
https://ftp.gwdg.de/pub/misc/ftp.idsoftware.com/idstuff/quake2/$archive_name
https://distfiles.gentoo.org/distfiles/33/$archive_name
"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
got=""
for url in $mirrors; do
  echo "fetch-paks: trying $url" >&2
  if curl -fsSL --retry 3 --retry-delay 2 --connect-timeout 20 -o "$tmp/$archive_name" "$url"; then
    actual=$(sha256 "$tmp/$archive_name")
    if [ -n "$want_archive" ] && [ "$actual" != "$want_archive" ]; then
      echo "fetch-paks: $url has SHA-256 $actual, expected $want_archive; skipping" >&2
      continue
    fi
    got=$url
    break
  fi
done
[ -n "$got" ] || { echo "fetch-paks: no source served $archive_name" >&2; exit 1; }

# unzip exits 1 on the self-extractor's leading stub ("extra bytes"); that is a warning.
unzip -o -j -q "$tmp/$archive_name" "$member" -d "$tmp" || [ $? -eq 1 ]
[ -f "$tmp/pak0.pak" ] || { echo "fetch-paks: $member not found in archive" >&2; exit 1; }
[ "$(head -c 4 "$tmp/pak0.pak")" = "PACK" ] || { echo "fetch-paks: pak0.pak has no PACK header" >&2; exit 1; }
if [ -n "$want_pak" ] && [ "$(sha256 "$tmp/pak0.pak")" != "$want_pak" ]; then
  echo "fetch-paks: extracted pak0.pak does not match the pinned hash" >&2
  exit 1
fi

mkdir -p "$out_dir/baseq2"
mv "$tmp/pak0.pak" "$pak"
if [ "$unpinned" -eq 1 ]; then
  cp "$tmp/$archive_name" "$out_dir/$archive_name"
  echo "fetch-paks: from $got" >&2
  echo "$(sha256 "$out_dir/$archive_name")  archive" >&2
  echo "$(sha256 "$pak")  pak" >&2
fi
echo "$pak"
