#!/bin/sh
# Builds q2server: id's Quake 2 3.21 server and game from .id-source/full, unchanged, with
# server_harness.c as its platform layer and a scripted player. Needs only a C compiler.
# Usage: oracle/server/build.sh [out_dir]   prints the binary's path.
set -e
here=$(cd "$(dirname "$0")" && pwd)
out="${1:-$here/../build}/q2server-objs"
src=$(sh "$here/../../scripts/fetch-id-source.sh" full)
full="$src/full"
mkdir -p "$out"
# The same rules as the other oracles: the original's old C needs these as warnings, and no FMA.
CFLAGS="-std=gnu99 -O2 -w -fno-strict-aliasing -ffp-contract=off -fcommon -Dstricmp=strcasecmp \
  -Wno-error=incompatible-pointer-types -Wno-error=int-conversion -Wno-error=implicit-function-declaration -Wno-error=implicit-int"
objs=""
for f in \
  qcommon/cmd.c qcommon/cmodel.c qcommon/common.c qcommon/crc.c qcommon/cvar.c qcommon/files.c qcommon/md4.c \
  qcommon/net_chan.c qcommon/pmove.c \
  server/sv_ccmds.c server/sv_ents.c server/sv_game.c server/sv_init.c server/sv_main.c server/sv_send.c \
  server/sv_user.c server/sv_world.c \
  null/cl_null.c linux/net_udp.c \
  game/q_shared.c game/m_flash.c \
  game/g_ai.c game/g_chase.c game/g_cmds.c game/g_combat.c game/g_func.c game/g_items.c game/g_main.c game/g_misc.c \
  game/g_monster.c game/g_phys.c game/g_save.c game/g_spawn.c game/g_svcmds.c game/g_target.c game/g_trigger.c \
  game/g_turret.c game/g_utils.c game/g_weapon.c \
  game/m_actor.c game/m_berserk.c game/m_boss2.c game/m_boss3.c game/m_boss31.c game/m_boss32.c game/m_brain.c \
  game/m_chick.c game/m_flipper.c game/m_float.c game/m_flyer.c game/m_gladiator.c game/m_gunner.c game/m_hover.c \
  game/m_infantry.c game/m_insane.c game/m_medic.c game/m_move.c game/m_mutant.c game/m_parasite.c game/m_soldier.c \
  game/m_supertank.c game/m_tank.c \
  game/p_client.c game/p_hud.c game/p_trail.c game/p_view.c game/p_weapon.c
do
  o="$out/$(echo "$f" | tr / _ | sed 's/\.c$/.o/')"
  # The server and the game each draw from rand(); give each a stream of its own (server_harness.c's
  # MSVC generators), so a TS server can draw the same numbers in the same order.
  case "$f" in
    game/q_shared.c|game/m_flash.c) extra="" ;;
    game/*) extra="-Drand=q2_game_rand -DGAME_HARD_LINKED" ;;
    server/*|qcommon/*) extra="-Drand=q2_server_rand" ;;
    *) extra="" ;;
  esac
  in="$full/$f"
  # g_items.c defines the armor indexes static after g_local.h declared them extern, which MSVC
  # accepted and GCC refuses; compile a copy with the three definitions not static (the only
  # change, made at build time: the indexes are set once in SetItemNames and read the same either way).
  if [ "$f" = game/g_items.c ]; then
    in="$out/g_items.c"
    sed -E 's/^static int([[:space:]]+)(jacket|combat|body)_armor_index;/int\1\2_armor_index;/' "$full/$f" > "$in"
    extra="$extra -I$full/game"
  fi
  if [ ! -f "$o" ] || [ "$full/$f" -nt "$o" ] || [ "$0" -nt "$o" ]; then cc $CFLAGS $extra -c -o "$o" "$in"; fi
  objs="$objs $o"
done
cc $CFLAGS -c -o "$out/server_harness.o" "$here/server_harness.c"
WRAP="-Wl,--wrap=NET_SendPacket -Wl,--wrap=MSG_WriteString -Wl,--wrap=SV_WriteFrameToClient -Wl,--wrap=SV_SendClientMessages"
cc -o "$out/../q2server" "$out/server_harness.o" $objs $WRAP -lm
echo "$(cd "$out/.." && pwd)/q2server"
