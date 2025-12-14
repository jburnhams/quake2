# WebSocket Protocol Documentation

This document describes the WebSocket-based network protocol used by Quake2TS for client-server communication. The protocol encapsulates Quake II network messages (NetChan) over a WebSocket connection.

## Overview

The protocol is binary-based and mirrors the original Quake II `NetChan` protocol but adapted for WebSocket transport. It supports reliable message delivery, fragmentation, and sequencing.

## Connection Lifecycle

1. **Connection**: Client establishes a WebSocket connection to the server (e.g., `ws://server:port`).
2. **Handshake**: There is no explicit HTTP-based handshake beyond the standard WebSocket upgrade. The game protocol begins immediately.
3. **Challenge**:
   - Client sends a `getchallenge` command (in a connectionless packet format, or just text if supported). *Note: Current implementation may skip challenge for simplified WebSocket connections, check `server/src/index.ts`.*
   - If utilizing standard Q2 connection flow: Server responds with a challenge value.
   - Client sends `connect <protocol> <qport> <challenge> <userinfo>`.
4. **Game Loop**:
   - Client sends `clc_move` commands (user input) periodically (approx 60Hz or dependent on framerate).
   - Server sends snapshots (gamestate) periodically (approx 10Hz-20Hz).
5. **Disconnect**: Either party can close the WebSocket. The protocol also supports an in-band `disconnect` command.

## Packet Structure

Each WebSocket binary message corresponds to a `NetChan` packet. The packet consists of a header followed by optional reliable data and optional unreliable data.

### Header (10 bytes)

| Offset | Type | Name | Description |
|---|---|---|---|
| 0 | uint32 | Sequence | Outgoing sequence number. High bits contain flags. |
| 4 | uint32 | Ack | Acknowledged incoming sequence number. High bit is reliable ack. |
| 8 | uint16 | QPort | Unique identifier for the client instance. |

**Sequence Flags**:
- `0x80000000`: Packet contains reliable data.
- `0x40000000`: Reliable sequence bit (toggles 0/1 for stop-and-wait reliable protocol).

**Ack Flags**:
- `0x80000000`: Reliable acknowledge bit (echoes the received reliable sequence bit).

### Reliable Data Section

Present if `Sequence & 0x80000000` is set.

| Offset | Type | Name | Description |
|---|---|---|---|
| 0 | uint16 | Length | Length of reliable data. High bit (`0x8000`) indicates fragmentation. |

**If Not Fragmented (`Length & 0x8000 == 0`)**:
- The next `Length` bytes are the reliable message payload.

**If Fragmented (`Length & 0x8000 != 0`)**:
- `Length &= 0x7FFF` is the size of this chunk.

| Offset | Type | Name | Description |
|---|---|---|---|
| 2 | uint32 | FragStart | Start offset of this fragment in total message. |
| 6 | uint32 | FragTotal | Total length of the complete reliable message. |
| 10 | byte[] | Data | `Length` bytes of fragment data. |

### Unreliable Data Section

Any remaining bytes in the packet after the Header (and Reliable Data, if present) are treated as unreliable data (e.g., entity updates, temporary events).

## Message Types (Commands)

The payload (reliable or unreliable) consists of a sequence of commands.

### Server to Client (`ServerCommand`)

Defined in `packages/shared/src/protocol/ops.ts`:

- `print` (10): Console text output.
- `serverdata` (12): Initial connection data (protocol version, map name).
- `configstring` (13): Update configuration strings (models, sounds, etc.).
- `spawnbaseline` (14): Baseline entity states.
- `centerprint` (15): Center screen message.
- `packetentities` (18): Delta-compressed entity snapshot.
- `frame` (20): Client frame execution marker.
- `sound` (9): Play sound event.
- ... and others.

### Client to Server (`ClientCommand`)

Defined in `packages/shared/src/protocol/ops.ts`:

- `move` (2): User command (movement, buttons, angles).
- `userinfo` (3): Update user information (name, skin, handedness).
- `stringcmd` (4): Arbitrary console command string (e.g., "say hello").

## Reliability Mechanism

The protocol uses a simple Stop-and-Wait mechanism for reliable messages:
1. Sender toggles the "Reliable Sequence Bit" (`0x40000000`) in the header when sending a NEW reliable message.
2. Sender continuously includes the current reliable message data in every outgoing packet until acknowledged.
3. Receiver processes reliable data only when the "Reliable Sequence Bit" differs from the last seen one.
4. Receiver echoes the seen "Reliable Sequence Bit" back in the Ack field's high bit (`0x80000000`).
5. Sender detects the Ack bit flip and clears the reliable buffer, ready for the next message.

## Error Codes & Disconnects

- **Timeout**: If no packets are received for 30 seconds (configurable).
- **Protocol Mismatch**: If `serverdata` indicates an incompatible protocol version.
- **WebSocket Close Codes**: Standard WebSocket close codes are used (1000 for normal, 1006 for abnormal).

## implementation Details

- **Endianness**: Little-endian is used for all multi-byte integers.
- **Max Packet Size**: `MAX_MSGLEN` is typically 1400 bytes. Reliable messages larger than this are fragmented.
- **Delta Compression**: `packetentities` uses delta compression against a previous frame (specified in the message) to reduce bandwidth.

For implementation details, refer to:
- `packages/shared/src/net/netchan.ts`: Network channel logic.
- `packages/shared/src/protocol/ops.ts`: Opcode definitions.
- `packages/server/src/protocol.ts`: Server-side protocol handling.
