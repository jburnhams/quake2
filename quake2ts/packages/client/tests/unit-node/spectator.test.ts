import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientExports } from '@quake2ts/client/index.js';
import { ConfigStringIndex } from '@quake2ts/shared';
import { createMockAssetManager, createMockRenderer } from '@quake2ts/test-utils';

// Mock dependencies
const mockRenderer = createMockRenderer();
const mockAssets = createMockAssetManager();
const mockTrace = vi.fn();

const mockEngine = {
  renderer: mockRenderer,
  assets: mockAssets,
  trace: mockTrace,
  audio: {
      play_track: vi.fn(),
      play_music: vi.fn(),
      stop_music: vi.fn()
  }
};

describe('Spectator Client API', () => {
  let client: ClientExports;

  beforeEach(async () => {
    vi.clearAllMocks(); // Resets implementations if mockReset: true

    // Re-setup mocks
    mockRenderer.registerPic.mockResolvedValue({ width: 32, height: 32 });
    mockRenderer.registerTexture.mockReturnValue({ width: 32, height: 32, upload: vi.fn(), bind: vi.fn() });

    mockTrace.mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } });

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

    await client.Init({
        state: {} as any,
        timeMs: 0,
        serverFrame: 0
    });
  });

  it('should set spectator target', () => {
    client.setSpectatorTarget(42);
  });

  it('should list spectator targets from config strings', () => {
    const player1Name = "PlayerOne";
    const player2Name = "PlayerTwo";
    const CS_PLAYERS = ConfigStringIndex.Players;

    client.ParseConfigString(CS_PLAYERS + 0, `\\name\\${player1Name}\\skin\\male/grunt`);
    client.ParseConfigString(CS_PLAYERS + 1, `\\name\\${player2Name}\\skin\\female/athena`);

    const targets = client.getSpectatorTargets();

    expect(targets).toHaveLength(2);
    expect(targets).toContainEqual({ id: 1, name: player1Name });
    expect(targets).toContainEqual({ id: 2, name: player2Name });
  });

  it('should handle clearing spectator target', () => {
      client.setSpectatorTarget(null);
  });
});
