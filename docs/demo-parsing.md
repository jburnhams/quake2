# Quake 2 Demo Parsing

This document describes the findings and implementation details for parsing Quake 2 demo files across different protocol versions.

## Protocol Versions

Quake 2 has several protocol versions with different server command enumerations:

### Protocol 25 (Quake 2 v3.00 / v3.14)
- Original retail Quake 2 version
- Demo files from original game PAK files use this protocol
- **Key difference**: Commands 1-5 (game DLL commands) did not exist in the network protocol

### Protocol 26
- Similar to protocol 25
- One difference: `svc_frame` does not include `suppressCount` byte (see `parser.ts:1064`)

### Protocol 34 (Quake 2 v3.20+)
- Added commands 1-5: muzzleflash, muzzleflash2, temp_entity, layout, inventory
- All subsequent commands shifted by +5

### Protocol 2023 (Kex Rerelease)
- Extended enum with additional commands after `svc_frame`
- Commands like splitclient (21), configblast (22), spawnbaselineblast (23) are rerelease additions

## Source Code Evidence

### Vanilla Q2 Enum (Protocol 34)

From `/home/user/quake2/full/qcommon/qcommon.h`:

```c
enum svc_ops_e
{
    svc_bad,                    // 0

    // these ops are known to the game dll
    svc_muzzleflash,           // 1
    svc_muzzleflash2,          // 2
    svc_temp_entity,           // 3
    svc_layout,                // 4
    svc_inventory,             // 5

    // the rest are private to the client and server
    svc_nop,                   // 6
    svc_disconnect,            // 7
    svc_reconnect,             // 8
    svc_sound,                 // 9
    svc_print,                 // 10
    svc_stufftext,             // 11
    svc_serverdata,            // 12
    svc_configstring,          // 13
    svc_spawnbaseline,         // 14
    svc_centerprint,           // 15
    svc_download,              // 16
    svc_playerinfo,            // 17
    svc_packetentities,        // 18
    svc_deltapacketentities,   // 19
    svc_frame                  // 20
};
```

## Protocol 25/26 Command Translation

Since protocol 25/26 lacks commands 1-5, all command bytes need translation when parsing:

**Protocol 25 byte → Modern enum value**
- 0 → 0 (svc_bad)
- 1 → 6 (svc_nop)
- 2 → 7 (svc_disconnect)
- 3 → 8 (svc_reconnect)
- 4 → 9 (svc_sound)
- 5 → 10 (svc_print)
- 6 → 11 (svc_stufftext)
- **7 → 12 (svc_serverdata)** ← Critical for parsing
- 8 → 13 (svc_configstring)
- 9 → 14 (svc_spawnbaseline)
- 10 → 15 (svc_centerprint)
- 11 → 16 (svc_download)
- 12 → 17 (svc_playerinfo)
- 13 → 18 (svc_packetentities)
- 14 → 19 (svc_deltapacketentities)
- 15 → 20 (svc_frame)

### Implementation

See `packages/engine/src/demo/parser.ts:280-337` for the `translateCommand()` method.

**Key points:**
- Protocol 25/26 commands 1-15 get +5 offset
- Command 0 (svc_bad) maps to itself
- Commands beyond 15 did not exist in vanilla protocol 25
- Translation must be applied before switch statement in `parseMessage()`

## Demo File Verification

### Real Demo Analysis (demo1.dm2 from PAK)

Hex dump of first message block:
```
00000000: 07 00 00 00 19 00 00 00 4a 24 01 00 01 00 6d 61  ........J$....ma
```

Breakdown:
- Bytes 0-3: `07 00 00 00` (little-endian 7) = Protocol 25 command for svc_serverdata
- Bytes 4-7: `19 00 00 00` (little-endian 25) = Protocol version
- Bytes 8-11: `4a 24 01 00` (little-endian 74826) = Server count
- Byte 12: `01` = Attractloop flag

This confirms:
1. Protocol 25 demos start with command byte 7 (not 12)
2. Byte 7 must translate to ServerCommand.serverdata (12) for correct parsing

## Nested Parser Considerations

When creating nested parsers (e.g., for compressed data in `svc_spawnbaselineblast`), the protocol version MUST be propagated.

**Example from `parser.ts:650-652`:**
```typescript
const blastStream = new BinaryStream(decompressed.buffer);
const blastParser = new NetworkMessageParser(blastStream, this.handler, this.strictMode);
blastParser.setProtocolVersion(this.protocolVersion);  // Critical!
```

Without this, nested parsers will fail to translate commands correctly.

## Current Status

### Working
- ✓ Protocol 25 serverdata detection (command 7 → 12)
- ✓ Protocol 25 configstring parsing (command 8 → 13)
- ✓ pak-integration.test.ts: 0 parsing errors

### Issues
- ✗ real_demo.test.ts: frameCount = 0 (frames not being detected)
- Frames should appear starting around message 186
- Investigation ongoing: command 18 appearing where it shouldn't

## References

- Vanilla Q2 source: `/home/user/quake2/full/`
- Rerelease source: `/home/user/quake2/rerelease/`
- Parser implementation: `packages/engine/src/demo/parser.ts`
- Integration test: `packages/engine/tests/integration/pak-integration.test.ts`
- Demo test: `packages/engine/tests/demo/real_demo.test.ts`
