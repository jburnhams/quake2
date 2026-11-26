#!/bin/sh
# Fetches id Software's original source into .id-source/ (gitignored), laid out as it
# used to sit at the repository root:
#   full/       the 1997 GPL source release (id-Software/Quake-2)
#   rerelease/  the 2023 rerelease game code (id-Software/quake2-rerelease-dll)
#   original/   the original game code shipped beside it (baseq2, ctf, rogue, xatrix)
#   fgd/        the rerelease's FGD and TrenchBroom game config
#   q2tools/    qbism's q2tools-220 map compiler, which bsp-tools cites
#
# The oracles (oracle/build.sh) compile it unmodified and the explorer's labs quote it
# (apps/explorer/vite.config.ts); both call this script, so nothing has to be fetched by hand.
# Every directory is pinned to a git tree hash in id-source.pins and checked after the fetch.
#
# Usage: scripts/fetch-id-source.sh [dir...]   fetch those (default: all) if missing or stale;
#                                              a no-op when they are already there
# Prints the path of .id-source on success. Override it with Q2_ID_SOURCE_DIR.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/.." && pwd)
out=${Q2_ID_SOURCE_DIR:-"$root/.id-source"}
pins="$here/id-source.pins"
fallback=https://github.com/jburnhams/quake2.git
# The last commit on main that carried these at the repository root (see id-source.pins).
fallback_commit=3dada0f2c481026dfef3be4c86d4367be774f642

pinned() { grep -v '^#' "$pins" | awk 'NF == 5'; }

wanted=${*:-$(pinned | awk '{ print $1 }')}
stale=""
for dir in $wanted; do
  pinned | awk -v d="$dir" '$1 == d { f = 1 } END { exit !f }' || { echo "fetch-id-source: $dir is not in $pins" >&2; exit 1; }
  tree=$(pinned | awk -v d="$dir" '$1 == d { print $2 }')
  [ "$(cat "$out/$dir/.tree" 2>/dev/null || true)" = "$tree" ] || stale="$stale $dir"
done
if [ -z "$stale" ]; then
  echo "$out"
  exit 0
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git init -q --bare "$tmp/cache"
g() { git -C "$tmp/cache" "$@"; }

# fetch <url> <ref>: quietly, one commit deep, retried on a flaky network.
fetch() {
  for attempt in 1 2 3; do
    GIT_TERMINAL_PROMPT=0 g fetch -q --depth 1 --no-tags "$1" "$2" 2>"$tmp/err" && return 0
    sleep "$attempt"
  done
  echo "fetch-id-source: could not fetch $2 from $1: $(cat "$tmp/err")" >&2
  return 1
}

# tree_at <commit> <path>: the tree hash at that path, or nothing.
tree_at() {
  if [ "$2" = "." ]; then g rev-parse -q --verify "$1^{tree}" 2>/dev/null || true
  else g rev-parse -q --verify "$1:$2" 2>/dev/null || true; fi
}

fallback_fetched=0
for dir in $stale; do
  set -- $(pinned | awk -v d="$dir" '$1 == d')
  tree=$2 repo=$3 commit=$4 path=$5
  if ! g cat-file -e "$commit^{commit}" 2>/dev/null; then
    echo "fetch-id-source: $dir from $repo@$(echo "$commit" | cut -c1-7)" >&2
    fetch "https://github.com/$repo.git" "$commit" || true
  fi
  got=$(tree_at "$commit" "$path")
  if [ "$got" != "$tree" ]; then
    echo "fetch-id-source: $repo did not give tree $tree for $dir; trying $fallback@$(echo "$fallback_commit" | cut -c1-7)" >&2
    if [ "$fallback_fetched" -eq 0 ]; then
      fetch "$fallback" "$fallback_commit" && fallback_fetched=1
    fi
    got=$(tree_at "$fallback_commit" "$dir")
  fi
  [ "$got" = "$tree" ] || { echo "fetch-id-source: no source gave $dir at tree $tree" >&2; exit 1; }
  rm -rf "$out/$dir"
  mkdir -p "$out/$dir"
  g archive --format=tar "$tree" | tar -x -C "$out/$dir"
  echo "$tree" > "$out/$dir/.tree"
done
echo "$out"
