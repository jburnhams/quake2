import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DedicatedServer } from '../src/dedicated.js';
import { createGame, GameExports } from '@quake2ts/game';
import { ClientState, createClient } from '../src/client.js';
import { ServerCommand, BinaryStream, NetDriver } from '@quake2ts/shared';
import { createMockTransport, MockTransport } from '@quake2ts/test-utils';

// Mock dependencies
// ws mock removed
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn().mockResolvedValue(Buffer.from([0])),
  },
}));
vi.mock('@quake2ts/engine', () => ({
  parseBsp: vi.fn().mockReturnValue({}),
}));
vi.mock('@quake2ts/game', () => ({
  createGame: vi.fn(),
  createPlayerInventory: vi.fn(),
  createPlayerWeaponStates: vi.fn(),
}));

describe('DedicatedServer Connection Flow', () => {
  let server: DedicatedServer;
  let mockGame: GameExports;
  let sentMessages: Uint8Array[] = [];
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let transport: MockTransport;

  beforeEach(async () => {
    sentMessages = [];
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockGame = {
      init: vi.fn(),
      shutdown: vi.fn(),
      spawnWorld: vi.fn(),
      clientConnect: vi.fn().mockReturnValue(true),
      clientDisconnect: vi.fn(),
      clientBegin: vi.fn(() => ({ id: 1, classname: 'player' })),
      clientThink: vi.fn(),
      frame: vi.fn().mockReturnValue({ state: {} }),
      entities: {
          forEachEntity: vi.fn(),
          getByIndex: vi.fn()
      }
    } as unknown as GameExports;

    (createGame as vi.Mock).mockReturnValue(mockGame);

    transport = createMockTransport();
    server = new DedicatedServer({ transport });
    await server.startServer('test.bsp');
  });

  afterEach(() => {
    server.stopServer();
    vi.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should handle "connect" command', () => {
    // 1. Setup a client using proper factory
    const mockNet: NetDriver = {
        send: vi.fn((data) => {
            sentMessages.push(data);
        }),
        disconnect: vi.fn(),
        connect: vi.fn(),
        onMessage: vi.fn(),
        onClose: vi.fn(),
        onError: vi.fn(),
        isConnected: vi.fn().mockReturnValue(true)
    };

    const client = createClient(0, mockNet);
    client.state = ClientState.Connected;

    // Inject client
    // @ts-ignore
    server.svs.clients[0] = client;

    // 2. Simulate "connect" string command
    // Use private access for unit testing
    // @ts-ignore
    server.handleStringCmd(client, 'connect \\name\\Player\\skin\\male/grunt');

    // 3. Verify clientConnect was called
    expect(mockGame.clientConnect).toHaveBeenCalledWith(null, '\\name\\Player\\skin\\male/grunt');

    // 4. Verify response (ServerData)
    // Check if any messages were sent
    expect(sentMessages.length).toBeGreaterThan(0);

    // Just verify that client.net.send was called.
    expect(mockNet.send).toHaveBeenCalled();
  });
});
