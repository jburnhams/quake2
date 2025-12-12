# Streaming Parser Implementation Plan

## Overview

Implement stateful streaming parser that handles continuous network message data, matching vanilla Quake 2 architecture. Same code path for both demo playback and live network streams.

## Vanilla Q2 Architecture Reference

### How Vanilla Q2 Handles Messages

**Source**: `/home/user/quake2/full/client/cl_main.c`

```c
// Line 976-1019: CL_ReadPackets() - Gets packets into net_message buffer
void CL_ReadPackets (void) {
    while (NET_GetPacket (NS_CLIENT, &net_from, &net_message)) {
        // Fills net_message.data with packet data
        // net_message.cursize = packet length
        Netchan_Process(&cls.netchan, &net_message);
    }
}

// Line 1798-1799: Buffer initialization
net_message.data = net_message_buffer;  // Static buffer
net_message.maxsize = sizeof(net_message_buffer);
```

**Source**: `/home/user/quake2/full/client/cl_parse.c`

```c
// CL_ParseServerMessage() - Parses commands from net_message
void CL_ParseServerMessage (void) {
    while (1) {
        cmd = MSG_ReadByte (&net_message);
        switch (cmd) {
            case svc_serverdata: CL_ParseServerData(); break;
            case svc_frame: CL_ParseFrame(); break;
            // ... other commands
        }
    }
}
```

**Key Insight**: Vanilla uses ONE global buffer (`net_message`) that:
- For network: Gets filled by `NET_GetPacket()` for each packet
- For demos: Would get filled by reading demo blocks
- Parser reads from this buffer, maintaining read position

## Current Code Issues

### Files to Modify

1. **`packages/engine/src/demo/demoReader.ts`**
   - Current: Returns individual blocks
   - Issue: Forces per-block parsing

2. **`packages/engine/src/demo/parser.ts`**
   - Current: `NetworkMessageParser` assumes complete messages in constructor
   - Issue: Creates new parser per block

3. **`packages/engine/tests/integration/pak-integration.test.ts:111-130`**
   - Current: Creates new parser per block
   - Issue: Loses state between blocks

4. **`packages/engine/tests/demo/real_demo.test.ts:63-83`**
   - Current: Creates new parser per block
   - Issue: Loses state between blocks

## Implementation Tasks

### Task 1: Create Streaming Buffer Class

**New File**: `packages/engine/src/stream/streamingBuffer.ts`

**Class**: `StreamingBuffer`
```typescript
class StreamingBuffer {
    // Maintains continuous buffer like vanilla net_message
    private buffer: ArrayBuffer;
    private readOffset: number;
    private writeOffset: number;

    // Append new data (for demos: append blocks; for network: append packets)
    append(data: ArrayBuffer | Uint8Array): void;

    // Check if we have N bytes available from current read position
    hasBytes(count: number): boolean;

    // Read operations (maintain read position)
    readByte(): number;
    readShort(): number;
    readLong(): number;
    readString(): string;
    // ... etc

    // Grow buffer when needed (for live streams)
    private grow(): void;

    // Compact buffer (remove consumed data to free memory)
    compact(): void;

    // Get current read position
    getReadPosition(): number;
}
```

**Reference**: `/home/user/quake2/full/qcommon/msg.c` - MSG_ReadByte, MSG_ReadShort, etc.

**Test File**: `packages/engine/tests/stream/streamingBuffer.test.ts`

Test Cases:
- Append single block, read all data
- Append multiple blocks, read continuously across boundaries
- Read operations spanning block boundaries (e.g., 4-byte long split across 2 blocks)
- String reading across block boundaries
- hasBytes() returns false when insufficient data
- Buffer growth when appending to full buffer
- Compact removes consumed data

---

### Task 2: Modify NetworkMessageParser for Streaming

**File**: `packages/engine/src/demo/parser.ts`

**Changes to `NetworkMessageParser` class**:

#### 2.1: Update Constructor
```typescript
// OLD (current):
constructor(stream: BinaryStream, handler?: NetworkMessageHandler, strictMode: boolean = false)

// NEW:
constructor(stream: StreamingBuffer, handler?: NetworkMessageHandler, strictMode: boolean = false)
```

#### 2.2: Add Streaming Parse Method
```typescript
// New method for incremental parsing
parseAvailableMessages(): ParseResult {
    // Parse commands until buffer is exhausted or mid-command
    // Return number of commands parsed and current parse state
}

interface ParseResult {
    commandsParsed: number;
    parseState: ParseState;  // e.g., 'awaiting_data', 'complete', 'error'
    bytesConsumed: number;
}
```

#### 2.3: Update parseMessage() Method
```typescript
// Current behavior: Parse until end of stream or svc_bad
// NEW behavior: Parse until no more complete commands available
public parseMessage(): void {
    while (this.stream.hasBytes(1)) {  // Instead of hasMore()
        const cmd = this.tryReadCommand();
        if (cmd === null) {
            // Not enough bytes for complete command
            return;
        }
        // ... process command
    }
}
```

#### 2.4: Add Try-Read Methods
```typescript
// Returns null if insufficient data, otherwise reads and returns value
private tryReadCommand(): number | null;
private tryReadServerData(): boolean;  // Returns true if complete
private tryReadFrame(): boolean;
// ... etc for each command parser
```

**Reference Implementation**: `/home/user/quake2/full/client/cl_parse.c:720-780` (CL_ParseFrame)
- Note how it reads multiple fields sequentially
- Each MSG_Read call advances position in net_message buffer

**Test File**: `packages/engine/tests/demo/parser.streaming.test.ts`

Test Cases:
- Parse complete message in one buffer
- Parse message split across 3 buffers (serverdata in buffer 1, configstrings in buffer 2-3)
- Parse frame split mid-entity (frame header in one buffer, entities in next)
- Parse with svc_playerinfo command spanning buffers (command byte in one buffer, data in next)
- Protocol detection across buffer boundary (serverdata command at end of buffer)
- Verify protocol state preserved across buffer appends

---

### Task 3: Create Demo Stream Adapter

**New File**: `packages/engine/src/demo/demoStream.ts`

**Class**: `DemoStream`
```typescript
class DemoStream {
    // Wraps DemoReader and StreamingBuffer
    private reader: DemoReader;
    private buffer: StreamingBuffer;

    constructor(demoData: ArrayBuffer);

    // Load all demo blocks into streaming buffer (for complete demos)
    loadComplete(): void;

    // Load next N blocks (for incremental/realtime playback)
    loadNextBlocks(count: number): boolean;

    // Check if demo is complete
    isComplete(): boolean;

    // Get the underlying streaming buffer for parsing
    getBuffer(): StreamingBuffer;
}
```

**Reference**: `/home/user/quake2/full/client/cl_main.c:113-121` (CL_WriteDemoMessage)
- Shows how demo blocks are just length-prefixed network data

**Test File**: `packages/engine/tests/demo/demoStream.test.ts`

Test Cases:
- loadComplete() loads all blocks from demo1.dm2
- loadNextBlocks(1) loads one block at a time
- isComplete() returns true after all blocks loaded
- Buffer contains continuous data across blocks
- Verify no data loss at block boundaries

---

### Task 4: Update Demo Reader (Optional Enhancement)

**File**: `packages/engine/src/demo/demoReader.ts`

**Add Method**:
```typescript
class DemoReader {
    // Existing methods stay...

    // NEW: Read all remaining blocks into single buffer
    readAllBlocksToBuffer(): ArrayBuffer {
        const blocks: Uint8Array[] = [];
        let totalLength = 0;

        while (this.hasMore()) {
            const block = this.readNextBlock();
            if (!block) break;
            blocks.push(new Uint8Array(block.data.buffer));
            totalLength += block.length;
        }

        // Concatenate all blocks
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const block of blocks) {
            result.set(block, offset);
            offset += block.length;
        }

        return result.buffer;
    }
}
```

**Reference**: None (convenience method for demo-specific use case)

**Test File**: `packages/engine/tests/demo/demoReader.test.ts` (add test case)

Test Cases:
- readAllBlocksToBuffer() returns single continuous buffer
- Verify total length matches sum of all block lengths
- Verify first bytes match first block, last bytes match last block

---

### Task 5: Update Integration Test

**File**: `packages/engine/tests/integration/pak-integration.test.ts`

**Changes to Lines 111-130**:

```typescript
// OLD (current approach - per-block parsing):
case '.dm2': {
    const reader = new DemoReader(buffer);
    let blockCount = 0;
    let protocolVersion = 0;
    let totalErrors = 0;
    while (reader.hasMore()) {
        const block = reader.readNextBlock();
        if (!block) break;
        blockCount++;
        const parser = new NetworkMessageParser(block.data);
        // ... parse per block
    }
}

// NEW (streaming approach):
case '.dm2': {
    const demoStream = new DemoStream(buffer);
    demoStream.loadComplete();  // Load all blocks into continuous buffer

    const streamingBuffer = demoStream.getBuffer();
    const parser = new NetworkMessageParser(streamingBuffer, undefined, false);

    parser.parseMessage();  // Parse entire demo as one continuous stream

    const totalErrors = parser.getErrorCount();
    if (totalErrors > 0) {
        throw new Error(`Demo file ${entry.name} had ${totalErrors} parsing errors`);
    }
    break;
}
```

**Test Expectations**:
- Should parse demo1.dm2 without errors
- Should handle frames spanning multiple blocks (blocks 7-8 boundary)
- Should detect protocol 25 from first block
- Should parse all entities across all blocks

---

### Task 6: Update Demo Test

**File**: `packages/engine/tests/demo/real_demo.test.ts`

**Changes to Lines 63-83**:

```typescript
// OLD (current approach):
while (demoReader.hasMore()) {
    const msg = demoReader.readNextBlock();
    if (!msg) break;
    messageCount++;
    const parser = new NetworkMessageParser(msg.data, handler, false);
    parser.setProtocolVersion(protocolVersion);
    parser.parseMessage();
    protocolVersion = parser.getProtocolVersion();
}

// NEW (streaming approach):
const demoStream = new DemoStream(demoBuffer);
demoStream.loadComplete();

const streamingBuffer = demoStream.getBuffer();
const parser = new NetworkMessageParser(streamingBuffer, handler, false);

parser.parseMessage();  // Parse entire demo continuously

const protocol = parser.getProtocolVersion();
```

**Test Expectations**:
- `expect(serverDataFound).toBe(true)` - PASS
- `expect(frameCount).toBeGreaterThan(0)` - PASS (currently fails)
- `expect(protocol).toBe(25)` - PASS
- Should detect 396 frames (or similar based on demo content)

---

### Task 7: Add End-to-End Test

**New File**: `packages/engine/tests/demo/streaming.e2e.test.ts`

**Test Cases**:

```typescript
describe('Streaming Parser E2E', () => {
    it('should parse demo1.dm2 with frames spanning blocks', () => {
        // Load demo
        const demo = loadDemoFile('demo1.dm2');
        const demoStream = new DemoStream(demo);
        demoStream.loadComplete();

        // Parse
        const handler = createMockHandler();
        const parser = new NetworkMessageParser(demoStream.getBuffer(), handler);
        parser.parseMessage();

        // Verify
        expect(handler.onServerData).toHaveBeenCalledTimes(1);
        expect(handler.onServerData.mock.calls[0][0]).toBe(25); // protocol
        expect(handler.onFrame).toHaveBeenCalled();
        expect(handler.onFrame.mock.calls.length).toBeGreaterThan(390);
    });

    it('should handle incremental block loading', () => {
        // Simulate loading blocks one at a time (like network stream)
        const demo = loadDemoFile('demo1.dm2');
        const reader = new DemoReader(demo);
        const buffer = new StreamingBuffer();
        const handler = createMockHandler();
        const parser = new NetworkMessageParser(buffer, handler);

        let totalFrames = 0;
        while (reader.hasMore()) {
            const block = reader.readNextBlock();
            buffer.append(block.data.buffer);

            parser.parseMessage();  // Parse available data
            totalFrames = handler.onFrame.mock.calls.length;
        }

        expect(totalFrames).toBeGreaterThan(390);
    });

    it('should handle partial commands at buffer boundary', () => {
        // Create synthetic demo with command split across blocks
        const builder = new DemoBuilder();

        // Block 1: serverdata command + first 3 bytes of protocol number
        builder.startBlock();
        builder.writeByte(0x07);  // svc_serverdata in protocol 25
        builder.writePartialLong(25, 3);  // Only write 3 of 4 bytes
        const block1 = builder.endBlock();

        // Block 2: last byte of protocol + rest of serverdata
        builder.startBlock();
        builder.writePartialLong(25, 1, 3);  // Write 4th byte
        builder.writeLong(12345);  // servercount
        builder.writeByte(0);  // attractloop
        builder.writeString("");  // gamedir
        builder.writeShort(0);  // playernum
        builder.writeString("test");  // level
        const block2 = builder.endBlock();

        // Parse
        const buffer = new StreamingBuffer();
        const handler = createMockHandler();
        const parser = new NetworkMessageParser(buffer, handler);

        buffer.append(block1);
        parser.parseMessage();  // Should NOT parse incomplete serverdata
        expect(handler.onServerData).not.toHaveBeenCalled();

        buffer.append(block2);
        parser.parseMessage();  // Should NOW parse complete serverdata
        expect(handler.onServerData).toHaveBeenCalledTimes(1);
        expect(handler.onServerData.mock.calls[0][0]).toBe(25);
    });
});
```

---

## Implementation Order

1. **Task 1**: StreamingBuffer class (foundation)
2. **Task 4**: DemoReader.readAllBlocksToBuffer() (simple utility)
3. **Task 3**: DemoStream adapter (uses StreamingBuffer + DemoReader)
4. **Task 2**: Update NetworkMessageParser (core logic)
5. **Task 5**: Update pak-integration.test.ts (validation)
6. **Task 6**: Update real_demo.test.ts (validation)
7. **Task 7**: Add E2E tests (comprehensive validation)

## Success Criteria

### Must Pass
- ✓ All existing tests continue to pass
- ✓ `pak-integration.test.ts` parses demo1.dm2 with 0 errors
- ✓ `real_demo.test.ts` detects frameCount > 0
- ✓ Protocol 25 command translation works across block boundaries
- ✓ Frames spanning multiple blocks parse correctly

### Should Handle
- ✓ Commands split at any byte boundary
- ✓ Strings split across blocks
- ✓ Multi-byte integers (long/short) split across blocks
- ✓ Entity data spanning 3+ blocks
- ✓ Protocol detection when serverdata spans blocks

### Performance
- Memory: Reasonable (no unbounded growth)
- Speed: Parse demo1.dm2 in < 100ms
- Streaming: Can handle block-at-a-time loading

## Reference Materials

### Vanilla Q2 Source Files
- `/home/user/quake2/full/qcommon/msg.c` - MSG_Read* functions
- `/home/user/quake2/full/qcommon/common.c` - sizebuf_t structure
- `/home/user/quake2/full/client/cl_parse.c` - Message parsing loop
- `/home/user/quake2/full/client/cl_ents.c:660-780` - Frame parsing
- `/home/user/quake2/full/client/cl_main.c:976-1019` - Packet reading
- `/home/user/quake2/full/client/cl_main.c:113-121` - Demo writing

### Our Current Code
- `packages/engine/src/demo/demoReader.ts` - Demo block reading
- `packages/engine/src/demo/parser.ts` - NetworkMessageParser
- `packages/shared/src/io/binaryStream.ts` - Current stream implementation
- `packages/engine/tests/integration/pak-integration.test.ts:111-130`
- `packages/engine/tests/demo/real_demo.test.ts:63-83`

## Notes

- StreamingBuffer replaces per-block BinaryStream usage
- Same code path for demos and live network (just different data sources)
- Parser maintains state across buffer appends
- No protocol changes needed - just architectural refactor
