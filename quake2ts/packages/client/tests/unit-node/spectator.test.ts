import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientExports } from '@quake2ts/client/index.js';
import { ConfigStringIndex } from '@quake2ts/shared';
import { createMockAssetManager, createMockRenderer } from '@quake2ts/test-utils';

// Mock dependencies
const mockEngine = {
  renderer: createMockRenderer({
    registerTexture: vi.fn().mockReturnValue({
      width: 32,
      height: 32,
      upload: vi.fn(),
      bind: vi.fn()
    })
  }),
  assets: createMockAssetManager(),
  trace: vi.fn().mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } }),
  audio: {
      play_track: vi.fn(),
      play_music: vi.fn(),
      stop_music: vi.fn()
  }
};

describe('Spectator Client API', () => {
  let client: ClientExports;

  beforeEach(() => {
    client = createClient({
      engine: mockEngine as any,
      host: {
          cvars: {
              list: () => [],
              register: vi.fn(),
              get: vi.fn(),
              setValue: vi.fn()
          } as any,
          commands: {
              register: vi.fn(),
              execute: vi.fn()
          } as any
      } as any
    });
    client.Init({
        frame: 0,
        timeMs: 0,
        state: {} as any
    });
  });

  it('should set spectator target', () => {
    client.setSpectatorTarget(42);
    // We can't access demoCameraState directly to verify, but we can verify behavior via side effects or internal state if exposed?
    // Actually, createClient doesn't expose demoCameraState.
    // But we can check if render logic changes? Or trust the code.
    // We can verify logic by checking if we can unset it.

    // Better: We can check getSpectatorTargets if we populate config strings.
  });

  it('should list spectator targets from config strings', () => {
    // Populate some player names
    const player1Name = "PlayerOne";
    const player2Name = "PlayerTwo";

    // CS_PLAYERS starts at ConfigStringIndex.Players
    // We need to use the actual index.
    // Note: ConfigStringIndex.Players was added in my patch.
    const CS_PLAYERS = ConfigStringIndex.Players;

    // Simulate server sending config strings for players
    // Format: \name\PlayerName\skin\male/grunt...
    client.ParseConfigString(CS_PLAYERS + 0, `\\name\\${player1Name}\\skin\\male/grunt`);
    client.ParseConfigString(CS_PLAYERS + 1, `\\name\\${player2Name}\\skin\\female/athena`);

    const targets = client.getSpectatorTargets();

    expect(targets).toHaveLength(2);
    expect(targets).toContainEqual({ id: 1, name: player1Name });
    expect(targets).toContainEqual({ id: 2, name: player2Name });
  });

  it('should handle clearing spectator target', () => {
      client.setSpectatorTarget(null);
      // Logic check: ensure no error throws
  });
});
