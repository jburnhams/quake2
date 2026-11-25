# C reference oracle

Differential tests that run the TypeScript port and id Software's original C code
(GPL, vendored in `../../full`) on the same inputs and fail on any difference.

- `harness.c` links `full/qcommon/cmodel.c` unchanged and answers queries on stdin
  (`trace`, `contents`, `model`) as JSON lines. `build.sh` compiles it with the system
  C compiler into `build/q2oracle`; no npm dependency.
- `tests/collision.oracle.test.ts` sends seeded random point-contents queries and box
  traces (point, standing, crouched and projectile boxes; several masks; short moves,
  long hitscans and position tests) on `maps/demo1.bsp` from `../pak.pak` to both sides.

Run it with `pnpm test:oracle`. `ORACLE_QUERIES=200000` runs a bigger sample;
`Q2ORACLE_BIN` points at a prebuilt binary.

Known: at 200,000 traces about 4 differ, all where a segment grazes a brush edge within
float precision (the C code works in 32-bit floats, the port in doubles). The default
20,000-query run has none. Inputs are rounded to float32 before both sides see them.

Next: `pmove.c` / rerelease `p_move.cpp` frame-by-frame comparison, and inline-model
(`CM_TransformedBoxTrace`) traces for doors and plats.
