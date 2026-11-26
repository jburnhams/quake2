#!/bin/sh
# Builds the C reference oracles from id Software's GPL source, fetched unmodified into
# quake2ts/.id-source by scripts/fetch-id-source.sh (pinned in scripts/id-source.pins):
#   build/q2oracle  collision (full/qcommon/cmodel.c)
#   build/q2pmove   player movement (rerelease/p_move.cpp, traced through cmodel.c)
#   build/q2msg     message encoding and checksums (qcommon/common.c, crc.c, client/cl_ents.c)
#   build/q2model   map, alias model and sprite loading (ref_gl/gl_model.c)
set -e
here=$(cd "$(dirname "$0")" && pwd)
out="$here/build"
src=$(sh "$here/../scripts/fetch-id-source.sh" full rerelease)
full="$src/full"
rr="$src/rerelease"
mkdir -p "$out"
# -ffp-contract=off: a compiler that targets FMA (newer runners) would fuse a*b+c and round once,
# which the original x87/SSE builds never did, and which moves exact float ties.
# GCC 14 made these old-C warnings errors; the original source needs them as warnings.
CFLAGS="-I$src -std=gnu99 -O2 -w -fno-strict-aliasing -ffp-contract=off -Wno-error=incompatible-pointer-types -Wno-error=int-conversion -Wno-error=implicit-function-declaration -Wno-error=implicit-int"
cc $CFLAGS -c -o "$out/cmodel.o" "$full/qcommon/cmodel.c"
cc $CFLAGS -c -o "$out/q_shared.o" "$full/game/q_shared.c"
cc $CFLAGS -c -o "$out/cm_stubs.o" "$here/cm_stubs.c"
cc $CFLAGS -o "$out/q2oracle" "$here/harness.c" "$out/cm_stubs.o" "$out/cmodel.o" "$out/q_shared.o" -lm
# common.c is linked whole; --gc-sections drops the engine it would otherwise pull in.
GCFLAGS="$CFLAGS -ffunction-sections -fdata-sections"
cc $GCFLAGS -c -o "$out/common.o" "$full/qcommon/common.c"
cc $GCFLAGS -c -o "$out/crc.o" "$full/qcommon/crc.c"
cc $GCFLAGS -c -o "$out/q_shared_gc.o" "$full/game/q_shared.c"
cc $GCFLAGS -c -o "$out/cl_ents.o" "$full/client/cl_ents.c"
cc $GCFLAGS -o "$out/q2msg" "$here/msg_harness.c" "$out/common.o" "$out/cl_ents.o" "$out/crc.o" "$out/q_shared_gc.o" -Wl,--gc-sections -lm
# ref_gl's model loader; gl/ holds just enough of OpenGL's types for its headers.
cc $CFLAGS -I"$here/gl" -c -o "$out/gl_model.o" "$full/ref_gl/gl_model.c"
cc $CFLAGS -I"$here/gl" -o "$out/q2model" "$here/model_harness.c" "$out/gl_model.o" "$out/q_shared.o" -lm
if command -v c++ >/dev/null 2>&1; then
  # The rerelease needs C++20; USE_CPP20_FORMAT picks <format> over the fmt library.
  c++ -I"$src" -std=c++20 -DUSE_CPP20_FORMAT=1 -O2 -w -fno-strict-aliasing -ffp-contract=off -o "$out/q2pmove" \
    "$here/pmove_harness.cpp" "$rr/p_move.cpp" "$out/cm_stubs.o" "$out/cmodel.o" "$out/q_shared.o" -lm
fi
echo "$out/q2oracle"
