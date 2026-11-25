#!/bin/sh
# Builds the C reference oracles from id Software's GPL source:
#   build/q2oracle  collision (full/qcommon/cmodel.c)
#   build/q2pmove   player movement (rerelease/p_move.cpp, traced through cmodel.c)
set -e
here=$(cd "$(dirname "$0")" && pwd)
out="$here/build"
full="$here/../../full"
rr="$here/../../rerelease"
mkdir -p "$out"
CFLAGS="-std=gnu99 -O2 -w -fno-strict-aliasing"
cc $CFLAGS -c -o "$out/cmodel.o" "$full/qcommon/cmodel.c"
cc $CFLAGS -c -o "$out/q_shared.o" "$full/game/q_shared.c"
cc $CFLAGS -c -o "$out/cm_stubs.o" "$here/cm_stubs.c"
cc $CFLAGS -o "$out/q2oracle" "$here/harness.c" "$out/cm_stubs.o" "$out/cmodel.o" "$out/q_shared.o" -lm
if command -v c++ >/dev/null 2>&1; then
  # The rerelease needs C++20; USE_CPP20_FORMAT picks <format> over the fmt library.
  c++ -std=c++20 -DUSE_CPP20_FORMAT=1 -O2 -w -fno-strict-aliasing -o "$out/q2pmove" \
    "$here/pmove_harness.cpp" "$rr/p_move.cpp" "$out/cm_stubs.o" "$out/cmodel.o" "$out/q_shared.o" -lm
fi
echo "$out/q2oracle"
