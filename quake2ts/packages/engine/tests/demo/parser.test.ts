
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
    const writer = new MessageWriter();
    writer.writeServerData(34, 123, 1, "baseq2", 1, "q2dm1");

    const stream = createStreamFromWriter(writer);
    const handler = {
        onServerData: vi.fn(),
    } as unknown as NetworkMessageHandler;

    const parser = new NetworkMessageParser(stream, handler);
    parser.parseMessage();

    expect(handler.onServerData).toHaveBeenCalledWith(34, 123, 1, "baseq2", 1, "q2dm1", undefined, undefined);
    expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_frame for protocol 34', () => {
    const writer = new MessageWriter();

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
        onSpawnBaseline: vi.fn(), // implicitly called or ignored
    } as unknown as NetworkMessageHandler;

    const parser = new NetworkMessageParser(stream, handler);
    parser.parseMessage(); // ServerData
    parser.parseMessage(); // Frame

    expect(handler.onServerData).toHaveBeenCalled();
    // Frame parsing triggers player state parsing which might fail if protocol isn't set right,
    // but here we expect success.
    expect(handler.onFrame).toHaveBeenCalled();
    const frameArg = (handler.onFrame as any).mock.calls[0][0];
    expect(frameArg.serverFrame).toBe(100);
    expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_playerinfo', () => {
    // Isolated playerinfo check using MessageWriter
    // Note: Parser expects playerinfo only inside Frame usually, or strictly?
    // parseMessage has case for playerinfo.

    const writer = new MessageWriter();
    const ps = createEmptyProtocolPlayerState();
    ps.pm_type = 1;
    writer.writeCommand(ServerCommand.playerinfo, 0); // use Proto 0 for simpler check
    writer.writePlayerState(ps);

    const stream = createStreamFromWriter(writer);
    // Mock handler with getPlayerState? No, parsePlayerState just parses and returns logic usually
    // But NetworkMessageParser.parsePlayerState() actually *consumes* it.
    // It doesn't call a handler method for playerinfo directly, it returns the state.
    // Wait, parseMessage case for playerinfo calls `this.parsePlayerState()`.
    // Does it do anything with the result?
    // It calls `this.parsePlayerState()`, ignoring return value.
    // So isolated playerinfo is effectively a no-op in parseMessage loop unless strict check fails.

    const parser = new NetworkMessageParser(stream);
    parser.parseMessage();
    expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_packetentities', () => {
      const writer = new MessageWriter();
      const ent = createEmptyEntityState();
      ent.number = 1;
      writer.writePacketEntities([ent], false, 0); // Proto 0

      const stream = createStreamFromWriter(writer);
      const handler = {
          onFrame: vi.fn() // parsePacketEntities calls onFrame with partial data
      } as unknown as NetworkMessageHandler;

      const parser = new NetworkMessageParser(stream, handler);
      parser.parseMessage();

      expect(handler.onFrame).toHaveBeenCalled();
      expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_temp_entity', () => {
      const writer = new MessageWriter();
      writer.writeTempEntity(TempEntity.EXPLOSION1, {x:100, y:200, z:300});

      const stream = createStreamFromWriter(writer);
      const handler = {
          onTempEntity: vi.fn(),
      } as unknown as NetworkMessageHandler;

      const parser = new NetworkMessageParser(stream, handler);
      parser.parseMessage();

      // parseTempEntity always passes initialized Vec3s for pos2 and dir
      expect(handler.onTempEntity).toHaveBeenCalledWith(
          TempEntity.EXPLOSION1,
          expect.objectContaining({x:100}),
          expect.objectContaining({x:0, y:0, z:0}), // pos2
          expect.objectContaining({x:0, y:0, z:0}), // dir
          undefined,
          undefined,
          undefined,
          undefined,
          undefined
      );
      expect(stream.hasMore()).toBe(false);
  });

  it('should be resilient to unknown commands', () => {
      // Manual bad byte
      const stream = new BinaryStream(new Uint8Array([255]));
      const parser = new NetworkMessageParser(stream);
      parser.parseMessage();
      expect(stream.hasMore()).toBe(false);
  });
});
