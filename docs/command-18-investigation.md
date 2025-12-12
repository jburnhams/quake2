# Command 18 Investigation

## Summary

Protocol 25 demo files (demo1.dm2 from original Quake 2 PAK) contain message blocks that start with byte 0x12 (decimal 18). This byte is NOT a valid server command in protocol 25.

## Evidence

### Block Structure

Analyzing demo1.dm2 from pak.pak:

```
Block 1:  first byte = 0x07 (serverdata)      length = 1345
Block 2:  first byte = 0x08 (configstring)    length = 1359
Block 3:  first byte = 0x08 (configstring)    length = 1355
Block 4:  first byte = 0x08 (configstring)    length = 1364
Block 5:  first byte = 0x08 (configstring)    length = 1349
Block 6:  first byte = 0x09 (spawnbaseline)   length = 1349
Block 7:  first byte = 0x09 (spawnbaseline)   length = 649
Block 8:  first byte = 0x12 (UNKNOWN/18)      length = 364
Block 9:  first byte = 0x12 (UNKNOWN/18)      length = 363
Block 10: first byte = 0x12 (UNKNOWN/18)      length = 364
...
Block 100: first byte = 0x12 (UNKNOWN/18)     length = 857
Block 200: first byte = 0x12 (UNKNOWN/18)     length = 370
Block 300: first byte = 0x12 (UNKNOWN/18)     length = 616
Block 400: first byte = 0x12 (UNKNOWN/18)     length = 506
Block 500: first byte = 0x12 (UNKNOWN/18)     length = 447
```

### Protocol 25 Command Range

Vanilla Quake 2 protocol 25 supports commands 0-15:
- 0: svc_bad
- 1-15: nop, disconnect, reconnect, sound, print, stufftext, serverdata, configstring, spawnbaseline, centerprint, download, playerinfo, packetentities, deltapacketentities, frame

**Command 18 does NOT exist in protocol 25's enum.**

### Current Behavior

When our parser encounters command 18:
1. `translateCommand(18)` is called
2. Protocol 25 range check (1-15) fails
3. Returns `ServerCommand.bad` (0)
4. Switch statement hits `case ServerCommand.bad`
5. Parser returns immediately, stopping all further parsing

This is why:
- `pak-integration.test.ts` shows "0 parsing errors" (because parser stops before incrementing errorCount)
- `real_demo.test.ts` shows `frameCount=0` (frames in blocks 8+ are never parsed)

## Hypotheses

### Hypothesis 1: Blocks 8+ are not server messages
Blocks starting with 0x12 might be:
- Client commands recorded to demo
- Frame/entity deltas in a different format
- Continuation blocks for multi-block frames
- Demo metadata or markers

### Hypothesis 2: Command 18 is valid but undocumented
The vanilla source might have protocol 25 commands beyond 15 that aren't in the public enum.

### Hypothesis 3: Parser misalignment
Earlier blocks (1-7) might not be consuming all their data correctly, causing block 8+ to be offset/corrupted.

## Next Steps

1. **Check vanilla Q2 demo playback code** - See how CL_ReadDemoMessage processes these blocks
2. **Inspect block 8 hex dump** - Determine if 0x12 is actually a command or data
3. **Compare with working demo parser** - Check if other Q2 ports handle this differently
4. **Test hypothesis 3** - Add validation that blocks 1-7 consume exactly their advertised length

## Source References

- Demo write: `/home/user/quake2/full/client/cl_main.c:CL_WriteDemoMessage()`
- Demo read: (need to find CL_ReadDemoMessage)
- Protocol 25 enum: `/home/user/quake2/full/qcommon/qcommon.h:svc_ops_e`
- Our parser: `/home/user/quake2/quake2ts/packages/engine/src/demo/parser.ts`

## Current Status

**Root cause identified but not resolved.**

The parser correctly detects byte 0x12 as invalid for protocol 25, but we need to understand WHY the demo file contains these bytes before we can fix it properly.
