# C reference oracle

Differential tests that run the TypeScript port and id Software's original C code
(GPL, fetched unmodified into `../.id-source` by `scripts/fetch-id-source.sh`) on the same inputs and fail on any difference.

- `harness.c` links `full/qcommon/cmodel.c` unchanged and answers queries on stdin
  (`trace`, `contents`, `ttrace`, `btrace`, `tcontents`, `model`) as JSON lines. `build.sh` compiles it with the system
  C compiler into `build/q2oracle`; no npm dependency. `cm_stubs.c` holds the engine services cmodel.c
  calls, and a plain-C trace shim (`cm_shim.h`) for the C++ oracle below.
- `pmove_harness.cpp` links the rerelease's `rerelease/p_move.cpp` unchanged (C++20, `<format>`
  instead of the fmt library) with cmodel.c answering its traces, into `build/q2pmove`. It keeps
  `pm->s` between `move` lines, so a run of moves is a trajectory; `state` resets it.
- `tests/collision.oracle.test.ts` sends seeded random point-contents queries and box
  traces (point, standing, crouched and projectile boxes; several masks; short moves,
  long hitscans and position tests) on `maps/demo1.bsp` from `../pak.pak` to both sides.
  It also covers `CM_TransformedBoxTrace` and `CM_TransformedPointContents` against every
  submodel (doors, plats) moved and turned, and against `CM_HeadnodeForBox` box hulls
  (monsters, players, items), with a floor on the share of traces that hit something.

- `msg_harness.c` links `full/qcommon/common.c`, `crc.c` and `full/client/cl_ents.c` unchanged into
  `build/q2msg` (`--gc-sections` drops the engine they would otherwise pull in): MSG_Write* for
  coordinates, angles, directions, usercmd and entity deltas, MSG_ReadDir, CRC_Block,
  COM_BlockSequenceCRCByte, and the client's CL_ParseEntityBits + CL_ParseDelta.
- `tests/msg.oracle.test.ts` checks BinaryWriter's coordinates, angles and directions, readDir,
  `crcBlock` and `blockSequenceCrcByte`, shared `writeDeltaEntity` and the demo `MessageWriter`
  byte for byte against MSG_WriteDeltaEntity on random protocol 34 states (laser-colour skins,
  high effect bits, beams, unchanged and forced entities), and the demo parser's entity reader
  against CL_ParseDelta on the C's bytes.
- `model_harness.c` links ref_gl's `full/ref_gl/gl_model.c` unchanged into `build/q2model` (`gl/`
  holds just enough of OpenGL's types for its headers; nothing calls GL): Mod_LoadBrushModel,
  Mod_LoadAliasModel, Mod_LoadSpriteModel, Mod_PointInLeaf and Mod_ClusterPVS.
- `tests/model.oracle.test.ts` loads every map, alias model and sprite in the demo `pak0.pak`
  (`scripts/fetch-paks.sh`; the repo's small pak otherwise) through both: planes and signbits,
  texinfo and animation frame counts, faces with CalcSurfaceExtents' lightmap placement
  (`surfaceExtents`), leafs, leaf face lists, nodes, submodels, every PVS row, Mod_PointInLeaf on
  random points (`pointInLeaf`), MD2 headers, skins, st, triangles, frames and glcmds, sprite
  frames, and that the TS refuses the MD2 header damage gl_model.c refuses.
- `tests/pmove.oracle.test.ts` runs seeded random trajectories on demo1 (starts on floors, in the
  air and in water; walking, strafing, jumping, crouching and turning at 8 to 50 ms frames) through
  both, starting each TS frame from the C's previous result so a difference is that frame's own.
  It compares origin, velocity, pm_flags, pm_time, view height and angles, bounds, water, ground,
  jump sound, step clip, impact delta and the touch count.
- `pmove321_harness.c` links 3.21's own `full/qcommon/pmove.c` unchanged into `build/q2pmove321`,
  with CM_BoxTrace answering its traces as the client's prediction (`entmode 0`: the world is hit
  only when the fraction is below 1) or the server's SV_Trace (`entmode 1`: always) does.
  `tests/pmove321.oracle.test.ts` holds `Original.pmove` (`packages/shared/src/original/pmove.ts`,
  the movement the client and server ports share, as id linked one pmove.c into both) to it
  exactly: pmove_state_t in shorts, view angles, height, bounds, ground, water and touches, on
  living, dead, gibbed and spectating players, with landing, teleport and water-jump timers. It
  found CM_TestBoxInBrush's float rounding: a box resting exactly on a slope was inside in the C
  and outside in the TS, which PM_GoodPosition turns into a different eighth.

Run it with `pnpm test:oracle`. `ORACLE_QUERIES=200000` runs a bigger collision sample and
`ORACLE_PMOVE_RUNS=5000` a bigger movement one (40 frames each), `ORACLE_MSG_QUERIES` the message one; `ORACLE_LEAF_QUERIES` the point-in-leaf one; `Q2ORACLE_BIN`, `Q2PMOVE_BIN`, `Q2MSG_BIN` and `Q2MODEL_BIN`
point at prebuilt binaries (`tests/build.global.ts` builds them once per run otherwise). To chase a movement difference, `ORACLE_DUMP=file.json` writes every
differing frame, and `Q2PMOVE_LOG=1` makes q2pmove print each trace it makes to stderr.

Floats: the C works in 32-bit floats, and ties decide real outcomes (a box that starts inside
DIST_EPSILON of a wall and slides along it hits at fraction 0 in doubles and misses in floats; a
landing that reaches the same spot by the step-up and the plain slide picks one by a rounding).
So the port does those computations in floats too: `clipBoxToBrush`, `recursiveHullCheck` and the
trace end point in `packages/shared/src/bsp/collision.ts`, and all of `packages/shared/src/pmove/frame.ts`,
round with `Math.fround` after each operation as SSE does. Since 2026-11-25: 0 of 200,000 world
traces, 0 of 100,000 submodel traces (the transform is in floats too, since the same day)
and 0 of 180,000 movement frames differ. Inputs are rounded to float32 before both sides see them.
The oracles build with `-ffp-contract=off`: a compiler targeting FMA (as the CI runner's does) fuses
`a*b+c` into one rounding, which the original builds never did, and that moved two landing frames.

What the movement oracle found on its first run (2026-11-25), 58% of frames differing: ground and
air moves steered by the full pitch (p_move.cpp divides it by 3), swimming steered by `upmove`
(the rerelease uses the jump and crouch buttons), no `pm_time` (so no landing pause, trick jump,
water jump or teleport pause), no ladders, no stuck fix, `sv_airaccelerate`'s path taken by default,
the trace mask ignored (ladders and water checks need theirs), dead players frozen in place.
`runPmove` is now a port of `Pmove` (`frame.ts`); the old pure helpers beside it are unchanged.

What the message oracle found (2026-11-25): both entity delta writers (shared `writeDeltaEntity`,
used by the server and the game's demo serializer, and the engine's `MessageWriter`) never sent
old_origin (a laser's far end; and the bit, when set, wrote nothing), cut skins, effects and
renderfx above 16 bits (laser colours, high effect flags), sent `event` only when it changed
(the C sends any non-zero event), and `force` set every bit instead of only writing an empty
header. The engine writer also left out any field that changed to 0. `writeAngle16` put angles
far outside 0..360 one step off (doubles, not floats). Fixed; reading was already right. Not
fixed, for the netcode work: the client's clc_move checksum is `crc8`, not COM_BlockSequenceCRCByte
(now in `shared/protocol/crc.ts` as `blockSequenceCrcByte`), and usercmds go out whole
(`writeUserCommand`), not as MSG_WriteDeltaUsercmd deltas (the oracle's `cmd` op is ready for it).

What the loader oracle found (2026-11-25): the renderer sized lightmaps from s and t computed in
doubles, where CalcSurfaceExtents uses floats, so 22 faces on demo1 to demo3 got a lightmap one luxel
too wide or tall (now `surfaceExtents` in `@quake2ts/formats`, used by `createBspSurfaces`). The view
leaf sent a point on a plane to the front child where Mod_PointInLeaf sends it to the back (2% of
whole-unit points landed in another leaf; now `pointInLeaf`, used by `findLeaf` and the renderer).
Texture animation treated a nexttexinfo of 0 as a link where the C ends the chain. The MD2 parser
loaded models with a skin taller than 480, no triangles or no frames, which gl_model.c refuses.

## Demo lockstep (`demo/`, `tests/demo.oracle.test.ts`)

Plays `demos/q2demo1.dm2` (the 3.14 demo, protocol 31, from the demo `pak0.pak`) through id's own
client and through the TS client, frame by frame, and fails at the first frame where a layer of
what they would draw differs. demo1.dm2 (the 3.00 format) is not used: 3.21 refuses it.

- `demo/build.sh` compiles id's 3.21 client, server, `qcommon` and `ref_gl` from `.id-source/full`
  unchanged, with `demo/demo_harness.c` as the platform layer, into `build/q2demo` (needs
  `libosmesa6-dev`; `tests/build.global.ts` builds it and skips the test without OSMesa, except in
  CI). The harness runs a virtual clock (a fixed 25 ms `Qcommon_Frame`), draws through OSMesa, gives
  the sound code a fake DMA buffer (22050 Hz, 16-bit stereo) and a stub game DLL. The linker's
  `--wrap` taps `GetRefAPI` (every refdef and 2D draw call), `CL_ParseServerMessage` (each message's
  bytes and the netchan ack), `S_StartSound`, `S_Update` (every mixing channel) and `CL_Frame`.
- `q2demo <basedir> <out> [msec] [shot_every]` writes `<out>/demo.jsonl` (one `msg`, `frame`, `ref`,
  `draw`, `snd` or `chan` line per event, and a `tick` with the clock for each frame before the client
  is active), `<out>/pcm.raw` (the mixed sound, s16le stereo) and,
  every `shot_every` frames, `<out>/shots/fNNNNN.ppm` (ref_gl's picture). Inline brush models are
  named `*N` and entities are compared as a sorted multiset (V_RenderView sorts them by pointer).
- `tests/demo/lockstep.ts` feeds each C frame's message bytes and ack into
  `packages/client/src/cl/client.ts` (`OriginalClient`, a float32 port of cl_main's `CL_Frame`,
  cl_parse, cl_ents, cl_pred and cl_view, with 3.x's configstring numbers in `cl/defs.ts`) and
  compares layer by layer: timing (`cl.time`, lerpfrac), frame state, prediction, the view, light
  styles, then the entity list, dynamic lights and particles, then the sound: every `S_StartSound`,
  the mixer's channels after each `S_Update`, and `pcm.raw` against the samples the TS mixer painted.
  `Q2DEMO_OUT=dir` reuses a finished run; `Q2DEMO_BIN` points at a prebuilt binary.

Gated, and equal on all 2,528 frames: timing, frame state, prediction, view, light styles, the
entity list (87,816 entities), dynamic lights (1,547) and particles (1,126,589, in the C's order).
The effects (`packages/client/src/cl/fx.ts`, a port of cl_fx.c and cl_tent.c) draw their random
numbers from `Rand` in `cl/qmath.ts`, the MSVC runtime's rand() the original Windows builds used;
`demo/build.sh` compiles `client/cl_*.c` and `qcommon/common.c` with `-Drand=q2_client_rand`, the
same generator in `demo_harness.c`, so the server's draws do not move the client's. The Rogue mission
pack's effects (cl_newfx.c) are not ported and throw.

Sound is gated too, and exact: the 610 sounds the client starts (server sound packets, effects,
footsteps), the mixer's channels on every frame (10,608 channel-frames: volumes, positions, ends),
and all 1,416,161 stereo samples of the mixed audio. The mixer is `packages/client/src/cl/snd.ts`,
a port of snd_dma.c, snd_mem.c and snd_mix.c over a device the platform supplies (`virtualDevice`
plays at the harness's clock, as `SNDDMA_GetDMAPos` does). id's C `S_PaintChannelFrom8` indexes its
scale table by `volume >> 11`, which is always row 0, so every 8-bit sound (every sound, with
`s_loadas8bit`'s default) mixes as silence; the game shipped with snd_mixa.s, which uses `volume >> 3`.
`demo/build.sh` therefore compiles snd_mix.c as the i386 Linux build did, without its C
`S_PaintChannelFrom8` and `S_WriteLinearBlastStereo16`, and `demo_harness.c` supplies the assembly's
two routines in C; the TS mixer follows the assembly. The 2D draw list and pixels come next.

What it found on its first run (2026-11-27): the demo parsers read entity angles as unsigned bytes,
where `MSG_ReadAngle` reads a signed char (180 where the C has -180); fixed in
`engine/src/demo/protocol/legacy.ts` and `quake2.ts`. A demo plays with `pm_type` forced to
`PM_FREEZE` (`cl.attractloop`), so prediction holds the player still and the view is the server's.

## Rerelease game lockstep (`rerelease/`, `tests/rgame.oracle.test.ts`)

Runs id's rerelease game DLL (the code the TS game ports) and the TS game on the same map, and
compares what they spawn. The work goes in slices, each gated before the next: (1) spawning,
(2) player movement and state, (3) items, doors and triggers, (4) monsters and combat.

- `rerelease/build.sh` compiles every `.cpp` of `.id-source/rerelease` (the game, bots, ctf, rogue
  and xatrix; not the client game) unchanged with the game's own flags, plus `host.cpp`, a small
  server built on 3.21's `cmodel.c` (collision, areas and PVS through `world_shim.c`), into
  `build/q2rgame`. Needs `libfmt-dev` and `libjsoncpp-dev`; `tests/build.global.ts` builds it and
  skips the test if that fails, except in CI.
- `q2rgame <basedir> <map> <ticks>` loads the map, spawns its entities, connects one player and runs
  25 ms frames, writing a JSON line per tick with every edict and, after ClientBegin, one `cs` line
  with every configstring. `Q2RGAME_INDEX_LOG=1` logs each new model, sound and image index to stderr.
- The game's random numbers come from `std::mt19937` through libstdc++'s distributions (MSVC's
  differ), so `packages/strata-math/src/random.ts` follows libstdc++ 13: `uniform_real<float>` from
  one 32-bit draw, `uniform_int` by Lemire's method, `random_time` inclusive of its maximum.
- `tests/rgame.ts` runs both games; `tests/rgame.oracle.test.ts` is the gate.

Slice 1 gated on demo1 (tick 0, floats to 1/128): every edict but the player (slice 2), with
monsters' frame, skin and origin left for slice 4, and models compared by name; every configstring
but the model, sound and image lists (the order of precaches is slice 4's monsters), the status bar,
CS_PLAYERS and General+2.

What slice 1 fixed in the TS game: freed edicts are reused at once in the first two seconds and a
new edict is `noclass`; inline models' bounds are spread by 1 (CMod_LoadSubmodels); worldspawn,
the item spawns and wheels, func_train, func_rotating, target_secret, target_goal, misc_banner,
misc_deadsoldier, misc_explobox and the player starts are ports of the rerelease; `s.sound` (the
looping sound) is its own field, apart from the map's `sounds` key; a think set at spawn waits one
frame (25 ms) even before the first frame has run.
