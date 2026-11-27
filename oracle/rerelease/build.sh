#!/bin/sh
# Builds build/q2rgame: id's rerelease game (GPL, fetched unmodified into .id-source/rerelease)
# hosted by host.cpp, with 3.21's cmodel.c answering collision. Needs the oracle's cmodel.o,
# q_shared.o and cm_stubs.o (oracle/build.sh builds them first), libfmt and libjsoncpp.
#
# The flags are the game's own (game.vcxproj): C++17, the fmt library, KEX_Q2_GAME and the
# dynamic-library defines; __declspec is MSVC's, so it is defined away. prelude.h supplies
# MSVC's global isnan and isinf.
set -e
here=$(cd "$(dirname "$0")" && pwd)
out="$here/../build"
src=$(sh "$here/../../scripts/fetch-id-source.sh" full rerelease)
rr="$src/rerelease"
obj="$out/rerelease"
mkdir -p "$obj"
CXXFLAGS="-std=c++17 -include $here/prelude.h -I/usr/include/jsoncpp -DKEX_Q2_GAME -DKEX_Q2GAME_EXPORTS -DNO_FMT_SOURCE \
  -DKEX_Q2GAME_DYNAMIC -DNDEBUG -DFMT_HEADER_ONLY -D__declspec(x)= -O2 -w -fno-strict-aliasing -ffp-contract=off"
export CXXFLAGS rr obj
# Each game file compiles once; a newer source or flags change (the stamp) rebuilds it.
stamp="$obj/.flags"
if [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$CXXFLAGS" ]; then rm -f "$obj"/*.o; echo "$CXXFLAGS" > "$stamp"; fi
(cd "$rr" && ls *.cpp bots/*.cpp ctf/*.cpp rogue/*.cpp xatrix/*.cpp | grep -v '^cg_') | \
  xargs -P "$(nproc)" -I{} sh -c 'o="$obj/$(echo {} | tr / _).o"; [ "$o" -nt "$rr/{}" ] || c++ $CXXFLAGS -c "$rr/{}" -o "$o"'
CFLAGS="-I$src -std=gnu99 -O2 -w -fno-strict-aliasing -ffp-contract=off"
cc $CFLAGS -I"$here/.." -c -o "$obj/world_shim.o" "$here/world_shim.c"
c++ $CXXFLAGS -I"$src" -I"$here/.." -c -o "$obj/host.o" "$here/host.cpp"
c++ $CXXFLAGS -I"$src" -c -o "$obj/game_fields.o" "$here/game_fields.cpp"
c++ -o "$out/q2rgame" "$obj/host.o" "$obj/game_fields.o" "$obj/world_shim.o" "$obj"/*.cpp.o "$out/cm_stubs.o" "$out/cmodel.o" "$out/q_shared.o" -ljsoncpp -lm
echo "$out/q2rgame"
