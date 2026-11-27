#!/bin/sh
# Builds q2demo: id's whole Quake 2 3.21 (client, server, ref_gl) from .id-source/full, unchanged,
# with demo_harness.c as its platform layer. Needs a C compiler and OSMesa (libosmesa6-dev).
# Usage: oracle/demo/build.sh [out_dir]   prints the binary's path.
set -e
here=$(cd "$(dirname "$0")" && pwd)
out="${1:-$here/../build}/q2demo-objs"
src=$(sh "$here/../../scripts/fetch-id-source.sh" full)
full="$src/full"
mkdir -p "$out"
# The same rules as the other oracles: the original's old C needs these as warnings, and no FMA.
CFLAGS="-I$here/include -std=gnu99 -O2 -w -fno-strict-aliasing -ffp-contract=off -fcommon -DREF_HARD_LINKED -Dstricmp=strcasecmp \
  -Wno-error=incompatible-pointer-types -Wno-error=int-conversion -Wno-error=implicit-function-declaration -Wno-error=implicit-int"
objs=""
for f in \
  client/cl_cin.c client/cl_ents.c client/cl_fx.c client/cl_newfx.c client/cl_input.c client/cl_inv.c \
  client/cl_main.c client/cl_parse.c client/cl_pred.c client/cl_tent.c client/cl_scrn.c client/cl_view.c \
  client/console.c client/keys.c client/menu.c client/qmenu.c client/snd_dma.c client/snd_mem.c client/snd_mix.c \
  qcommon/cmd.c qcommon/cmodel.c qcommon/common.c qcommon/crc.c qcommon/cvar.c qcommon/files.c qcommon/md4.c \
  qcommon/net_chan.c qcommon/pmove.c \
  server/sv_ccmds.c server/sv_ents.c server/sv_game.c server/sv_init.c server/sv_main.c server/sv_send.c \
  server/sv_user.c server/sv_world.c \
  game/q_shared.c game/m_flash.c \
  null/vid_null.c null/in_null.c null/cd_null.c linux/net_udp.c \
  ref_gl/gl_draw.c ref_gl/gl_image.c ref_gl/gl_light.c ref_gl/gl_mesh.c ref_gl/gl_model.c ref_gl/gl_rmain.c \
  ref_gl/gl_rmisc.c ref_gl/gl_rsurf.c ref_gl/gl_warp.c linux/qgl_linux.c
do
  o="$out/$(echo "$f" | tr / _ | sed 's/\.c$/.o/')"
  # The client's effects draw from rand(); give them a stream of their own (demo_harness.c's
  # q2_client_rand, the MSVC generator the TS client also runs) so the server's draws do not move it.
  # snd_mix.c as the i386 Linux build compiled it: without its C S_PaintChannelFrom8 and
  # S_WriteLinearBlastStereo16, which snd_mixa.s replaced there (demo_harness.c has them in C). The C
  # S_PaintChannelFrom8 indexes snd_scaletable by volume >> 11, which is always row 0, so every 8-bit
  # sound (all of them, with s_loadas8bit's default of 1) mixes as silence; the assembly used >> 3.
  case "$f" in
    client/cl_*|qcommon/common.c) extra="-Drand=q2_client_rand" ;;
    client/snd_mix.c) extra="-D__i386__" ;;
    *) extra="" ;;
  esac
  if [ ! -f "$o" ] || [ "$full/$f" -nt "$o" ] || [ "$0" -nt "$o" ]; then cc $CFLAGS $extra -c -o "$o" "$full/$f"; fi
  objs="$objs $o"
done
cc $CFLAGS -c -o "$out/demo_harness.o" "$here/demo_harness.c"
cc $CFLAGS -c -o "$out/model_names.o" "$here/model_names.c"
WRAP="-Wl,--wrap=GetRefAPI -Wl,--wrap=CL_ParseServerMessage -Wl,--wrap=S_StartSound -Wl,--wrap=S_StartLocalSound -Wl,--wrap=S_Update -Wl,--wrap=CL_Frame"
cc -o "$out/../q2demo" "$out/demo_harness.o" "$out/model_names.o" $objs $WRAP -lOSMesa -lm
echo "$(cd "$out/.." && pwd)/q2demo"
