#!/bin/sh
# Builds the C reference oracle from id Software's GPL source in ../../full.
set -e
here=$(cd "$(dirname "$0")" && pwd)
out="$here/build"
mkdir -p "$out"
cc -O2 -w -fno-strict-aliasing -o "$out/q2oracle" \
  "$here/harness.c" "$here/../../full/qcommon/cmodel.c" "$here/../../full/game/q_shared.c" -lm
echo "$out/q2oracle"
