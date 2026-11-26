# Quake 2 Demo Parsing

Which `.dm2` files the parser (`quake2ts/packages/engine/src/demo/parser.ts`) reads, and what is known about the ones it does not. Rewritten 2026-11-26: the earlier version of this page described protocol 25 as 3.20 with every opcode shifted by 5, which the demo's own bytes contradict (see below).

## Supported

| Protocol | Version | Notes |
|---|---|---|
| 26 to 34 | 3.05 to 3.20 | 3.20's `svc_ops_e` (`full/qcommon/qcommon.h`); `svc_frame` has no suppress byte in 26 only |
| 2023 | Kex rerelease | own handler (`protocol/rerelease.ts`) |

Frames are deltas: each `svc_frame` names the frame it deltas from, and `ClientFrames` (`engine/src/network/frames.ts`) rebuilds the entities and the player state from it, as `CL_ParseFrame` does. A demo is a record of what reached the client, so the same rebuild applies.

Each demo block is a whole network message (`CL_WriteDemoMessage` writes `net_message` past the netchan header), so blocks parse one at a time with the protocol carried over (`DemoPlaybackController`).

**Test demo:** `demos/q2demo1.dm2` in the demo pak0 (Quake 2 3.14 demo, protocol 31; fetched by `quake2ts/scripts/fetch-paks.sh`). All 632 frames parse with no errors and every one rebuilds from the frame it names (`engine/tests/unit-node/demo/real_demo.test.ts`).

## Not supported: protocol 25 (Quake 2 3.00)

The committed `quake2ts/pak.pak` holds `demos/demo1.dm2`, a 3.00 demo. The parser refuses it (`UnsupportedProtocolError`; `DemoValidator` gives the reason). Jonathan's decision, 2026-11-26: use the 3.14 demo rather than reverse-engineer 3.00.

Why: no source or spec covers 3.00. id released 3.21's source; the DM2 spec ([demospecs.half-empty.de/dm2](http://demospecs.half-empty.de/dm2)) starts at 3.05 and removed the 3.00 codes. What the file itself shows, if someone takes it up:

- Opcodes differ, not by a constant: serverdata 7, configstring 8, spawnbaseline 9, playerinfo 14, packetentities 16, frame 18 (3.20: 12, 13, 14, 17, 18, 20). Every frame block starts with 18.
- `svc_frame` is serverframe (long), areabytes (byte), areabits; no deltaframe, no suppress byte.
- Player-state flags differ: the demo uses only 0x04|0x10 (20 bytes: three vectors and a short), 0x08 (8 bytes, the gun) and 0x01 (4 bytes, the blend, read last), then a 32-bit stat mask and shorts as in 3.20.
- Entity bits differ too (the first entity's header does not decode with 3.20's U_* bits).

## Nested parsers

A nested parser (the rerelease's `svc_spawnbaselineblast`) must be given the outer parser's protocol (`setProtocolVersion`), or it reads with the bootstrap handler.

## References

- Vanilla Q2 source: `full/` (3.21); rerelease: `rerelease/`
- Parser: `quake2ts/packages/engine/src/demo/parser.ts`, handlers in `demo/protocol/`
- Frame history: `quake2ts/packages/engine/src/network/frames.ts`
