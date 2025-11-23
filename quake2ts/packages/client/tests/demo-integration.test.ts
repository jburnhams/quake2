import { describe, it, expect, vi } from 'vitest';
import { createClient } from '../src/index.js';
import { ClientNetworkHandler } from '../src/demo/handler.js';
import { PlaybackState, createEmptyProtocolPlayerState } from '@quake2ts/engine';

describe('Client Demo Integration', () => {
  it('should instantiate ClientNetworkHandler and wire it to DemoPlaybackController', () => {
    const mockEngine = {
      renderer: {
          begin2D: vi.fn(),
          end2D: vi.fn(),
          drawPic: vi.fn(),
          drawString: vi.fn(),
          measureString: vi.fn(),
      },
      trace: vi.fn(),
      pointcontents: vi.fn(),
      linkentity: vi.fn(),
      sound: vi.fn(),
      centerprintf: vi.fn(),
    } as any;

    const client = createClient({ engine: mockEngine });

    expect(client.demoPlayback).toBeDefined();
    expect(client.demoHandler).toBeInstanceOf(ClientNetworkHandler);
  });

  it('should return demo state during playback', () => {
     const mockEngine = {
      renderer: {
          begin2D: vi.fn(),
          end2D: vi.fn(),
          drawPic: vi.fn(),
          drawString: vi.fn(),
          measureString: vi.fn(),
      },
      trace: vi.fn(),
      pointcontents: vi.fn(),
      linkentity: vi.fn(),
      sound: vi.fn(),
      centerprintf: vi.fn(),
    } as any;

    const client = createClient({ engine: mockEngine });

    // Manually populate handler state
    const mockFrame = {
        serverFrame: 1,
        deltaFrame: 0,
        surpressCount: 0,
        areaBytes: 0,
        areaBits: new Uint8Array(),
        playerState: createEmptyProtocolPlayerState(),
        packetEntities: { delta: false, entities: [] }
    };
    mockFrame.playerState.origin = { x: 100, y: 200, z: 300 };
    mockFrame.playerState.stats[1] = 50; // Health

    client.demoHandler.onFrame(mockFrame);

    // Mock playback state to Playing
    vi.spyOn(client.demoPlayback, 'getState').mockReturnValue(PlaybackState.Playing);

    // Render
    client.render({
        alpha: 0,
        nowMs: 0,
        accumulatorMs: 0,
        frame: 0
    });

    // Check if lastRendered reflects demo state
    expect(client.lastRendered).toBeDefined();
    expect(client.lastRendered?.origin).toEqual({ x: 100, y: 200, z: 300 });
    expect(client.lastRendered?.health).toBe(50);
  });
});
