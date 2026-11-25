# C reference oracle

Differential tests that run the TypeScript port and id Software's original C code
(GPL, vendored in `../../full`) on the same inputs and fail on any difference.

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
- `tests/pmove.oracle.test.ts` runs seeded random trajectories on demo1 (starts on floors, in the
  air and in water; walking, strafing, jumping, crouching and turning at 8 to 50 ms frames) through
  both, starting each TS frame from the C's previous result so a difference is that frame's own.
  It compares origin, velocity, pm_flags, pm_time, view height and angles, bounds, water, ground,
  jump sound, step clip, impact delta and the touch count.

Run it with `pnpm test:oracle`. `ORACLE_QUERIES=200000` runs a bigger collision sample and
`ORACLE_PMOVE_RUNS=5000` a bigger movement one (40 frames each), `ORACLE_MSG_QUERIES` the message one; `Q2ORACLE_BIN`, `Q2PMOVE_BIN` and `Q2MSG_BIN`
point at prebuilt binaries (`tests/build.global.ts` builds them once per run otherwise). To chase a movement difference, `ORACLE_DUMP=file.json` writes every
differing frame, and `Q2PMOVE_LOG=1` makes q2pmove print each trace it makes to stderr.

Floats: the C works in 32-bit floats, and ties decide real outcomes (a box that starts inside
DIST_EPSILON of a wall and slides along it hits at fraction 0 in doubles and misses in floats; a
landing that reaches the same spot by the step-up and the plain slide picks one by a rounding).
So the port does those computations in floats too: `clipBoxToBrush`, `recursiveHullCheck` and the
trace end point in `packages/shared/src/bsp/collision.ts`, and all of `packages/shared/src/pmove/frame.ts`,
round with `Math.fround` after each operation as SSE does. Since 2026-11-25: 0 of 200,000 world
traces and 0 of 180,000 movement frames differ; about 1 in 50,000 submodel traces still does
(the transform is in doubles). Inputs are rounded to float32 before both sides see them.
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
