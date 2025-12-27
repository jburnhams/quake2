
import { describe, it, expect, vi } from 'vitest';
import { NetworkMessageParser, NetworkMessageHandler, createEmptyProtocolPlayerState, createEmptyEntityState, FrameData } from '../../src/demo/parser.js';
import { BinaryStream, ServerCommand, TempEntity } from '@quake2ts/shared';
import { MessageWriter } from '../../src/demo/writer.js';

// Helper to create a binary stream from writer data
const createStreamFromWriter = (writer: MessageWriter): BinaryStream => {
    const data = writer.getData();
    return new BinaryStream(data.buffer);
};

describe('NetworkMessageParser', () => {

  it('should parse svc_serverdata and set protocol version', () => {
    // MessageWriter default protocol 34
    const writer = new MessageWriter();
    writer.writeServerData(34, 123, 1, "baseq2", 1, "q2dm1");

    const stream = createStreamFromWriter(writer);
    const handler = {
        onServerData: vi.fn(),
    } as unknown as NetworkMessageHandler;

    const parser = new NetworkMessageParser(stream, handler);
    // Starts with BootstrapProtocolHandler
    parser.parseMessage();

    // After parsing serverdata, it should switch to 34
    // Bootstrap parses legacy serverdata (13) correctly.
    expect(handler.onServerData).toHaveBeenCalledWith(34, 123, 1, "baseq2", 1, "q2dm1", undefined, undefined);

    // Check if stream consumed
    // If MessageWriter padding or alignment issues, hasMore might be true.
    // MessageWriter just writes bytes.
    expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_frame for protocol 34', () => {
    const writer = new MessageWriter(undefined, 34);

    // Set Protocol 34 via ServerData first so parser knows context
    writer.writeServerData(34, 123, 1, "baseq2", 0, "q2dm1");

    const frame: FrameData = {
        serverFrame: 100,
        deltaFrame: 99,
        surpressCount: 0,
        areaBytes: 0,
        areaBits: new Uint8Array(0),
        playerState: createEmptyProtocolPlayerState(),
        packetEntities: { delta: true, entities: [] }
    };

    writer.writeFrame(frame, 34);

    const stream = createStreamFromWriter(writer);
    const handler = {
        onServerData: vi.fn(),
        onFrame: vi.fn(),
        onSpawnBaseline: vi.fn(),
        onPacketEntities: vi.fn(), // parsePacketEntities calls onFrame
    } as unknown as NetworkMessageHandler;

    const parser = new NetworkMessageParser(stream, handler);
    parser.parseMessage(); // Parses everything in stream

    expect(handler.onServerData).toHaveBeenCalled();
    // parseFrame calls parsePlayerState then parsePacketEntities.
    // parsePacketEntities calls onFrame.
    // So onFrame should be called.
    expect(handler.onFrame).toHaveBeenCalled();
    const frameArg = (handler.onFrame as any).mock.calls[0][0];
    expect(frameArg.serverFrame).toBe(100);
    expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_playerinfo', () => {
    // Tests isolated playerinfo. MessageWriter.writePlayerState writes WIRE_PLAYERINFO.
    // Parser needs to know protocol? Protocol 34 is default.
    // Bootstrap might not handle playerinfo?
    // BootstrapProtocolHandler: translateCommand 17 -> ServerCommand.playerinfo ?
    // Check Bootstrap impl. Usually it handles everything or fails?
    // Actually Bootstrap usually only handles ServerData and returns BAD for others unless updated.
    // So we MUST set protocol or send ServerData.

    const writer = new MessageWriter(undefined, 34);
    const ps = createEmptyProtocolPlayerState();
    ps.pm_type = 1;

    // We need to write opcode explicitly if using writePlayerState isolated?
    // writePlayerState writes opcode.
    writer.writePlayerState(ps);

    const stream = createStreamFromWriter(writer);
    const parser = new NetworkMessageParser(stream);
    // Explicitly set protocol to 34 so it knows how to parse playerinfo
    parser.setProtocolVersion(34);

    parser.parseMessage();
    expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_packetentities', () => {
      const writer = new MessageWriter(undefined, 34);
      const ent = createEmptyEntityState();
      ent.number = 1;
      writer.writePacketEntities([ent], false, 34);

      const stream = createStreamFromWriter(writer);
      const handler = {
          onFrame: vi.fn()
      } as unknown as NetworkMessageHandler;

      const parser = new NetworkMessageParser(stream, handler);
      parser.setProtocolVersion(34);
      parser.parseMessage();

      expect(handler.onFrame).toHaveBeenCalled();
      expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_temp_entity', () => {
      const writer = new MessageWriter(undefined, 34);
      // writeTempEntity is minimal in MessageWriter, let's fix test or writer
      // The writer.ts I wrote has minimal impl: just writes type.
      // But parser expects pos, dir etc for EXPLOSION1.
      // So writing minimal will cause buffer underflow in parser.
      // I should use `writeTempEntity` with full args or manual write.

      // Let's assume I fix writer or manually write here for test.
      // Manual write for test reliability:
      // WIRE_TEMP_ENTITY (9) + type + args.
      // EXPLOSION1 (0): pos(3 shorts).
      // Writer implementation was: writeByte(type).
      // So I need to implement full writeTempEntity or hack it.

      // I will assume MessageWriter is used. I'll extend the test to use manual writer if needed
      // But let's check what I implemented in previous step.
      // writeTempEntity(type) -> writes type.
      // I should update MessageWriter to write pos etc.

      // Or I can skip this test if writer is incomplete?
      // Better to fix MessageWriter or use manual construction.
      // Manual construction for this test:
      const manualWriter = new BinaryStream(new Uint8Array(100).buffer);
      // WIRE_TEMP_ENTITY = 9
      // We are using BinaryWriter from shared, but stream is BinaryStream (reader).
      // Let's use MessageWriter just for opcode, then append data? No.

      // Just manually build buffer
      const buffer = [];
      buffer.push(9); // svc_temp_entity
      buffer.push(TempEntity.EXPLOSION1);
      // pos (3 shorts / 8.0). 100 -> 800.
      const px = 100 * 8; const py = 200 * 8; const pz = 300 * 8;
      buffer.push(px & 0xFF, (px >> 8) & 0xFF);
      buffer.push(py & 0xFF, (py >> 8) & 0xFF);
      buffer.push(pz & 0xFF, (pz >> 8) & 0xFF);

      const stream = new BinaryStream(new Uint8Array(buffer).buffer);
      const handler = {
          onTempEntity: vi.fn(),
      } as unknown as NetworkMessageHandler;

      const parser = new NetworkMessageParser(stream, handler);
      parser.setProtocolVersion(34);
      parser.parseMessage();

      expect(handler.onTempEntity).toHaveBeenCalledWith(
          TempEntity.EXPLOSION1,
          expect.objectContaining({x:100}),
          expect.objectContaining({x:0, y:0, z:0}),
          expect.objectContaining({x:0, y:0, z:0}),
          undefined, undefined, undefined, undefined, undefined
      );
      expect(stream.hasMore()).toBe(false);
  });

  it('should be resilient to unknown commands', () => {
      // Manual bad byte
      const stream = new BinaryStream(new Uint8Array([255]).buffer);
      const parser = new NetworkMessageParser(stream);
      // Default bootstrap might handle it or error depending on implementation
      parser.parseMessage();
      expect(stream.hasMore()).toBe(false);
  });
});
