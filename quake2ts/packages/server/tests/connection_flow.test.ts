import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DedicatedServer } from '../src/dedicated';
import { createGame, GameExports } from '@quake2ts/game';
import { ClientState, Client } from '../src/client';
import { ServerCommand, BinaryStream } from '@quake2ts/shared';

// Mock dependencies
vi.mock('ws');
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

  beforeEach(async () => {
    sentMessages = [];

    mockGame = {
      init: vi.fn(),
      shutdown: vi.fn(),
      spawnWorld: vi.fn(),
      clientConnect: vi.fn().mockReturnValue(true),
      clientBegin: vi.fn(() => ({ id: 1, classname: 'player' })),
      clientThink: vi.fn(),
      frame: vi.fn().mockReturnValue({ state: {} }),
    } as unknown as GameExports;

    (createGame as vi.Mock).mockReturnValue(mockGame);

    server = new DedicatedServer();
    await server.start('test.bsp');
  });

  afterEach(() => {
    server.stop();
    vi.clearAllMocks();
  });

  it('should handle "connect" command', () => {
    // 1. Setup a client in Free state (or check how handleConnection works)
    // We can simulate a connection via the wss mock, but simpler to inject a client into svs

    const mockSend = vi.fn((data) => {
        sentMessages.push(data);
    });

    const fakeClient: Client = {
      index: 0,
      state: ClientState.Connected, // Just connected at TCP level
      edict: null,
      net: { send: mockSend },
      messageQueue: [],
      userInfo: ''
    } as unknown as Client;

    // Inject client
    // @ts-ignore
    server.svs.clients[0] = fakeClient;

    // 2. Simulate "connect" string command
    // We can call handleStringCmd directly or go through onClientMessage
    // Let's use handleStringCmd via private access for precision, or simulate message parsing

    // @ts-ignore
    server.handleStringCmd(fakeClient, 'connect \\name\\Player\\skin\\male/grunt');

    // 3. Verify clientConnect was called
    expect(mockGame.clientConnect).toHaveBeenCalledWith(null, '\\name\\Player\\skin\\male/grunt');

    // 4. Verify response (ServerData)
    expect(mockSend).toHaveBeenCalled();

    // Check for ServerCommand.serverdata (12)
    // We need to parse the binary data to verify content
    const data = sentMessages[0];
    const reader = new BinaryStream(data.buffer);
    const cmd = reader.readByte();
    expect(cmd).toBe(ServerCommand.serverdata);

    // Check for "precache" (ServerCommand.stufftext)
    // It might be in the same packet or next one.
    // In current impl, it sends separate packets.
    const data2 = sentMessages[1];
    const reader2 = new BinaryStream(data2.buffer);
    const cmd2 = reader2.readByte();
    expect(cmd2).toBe(ServerCommand.stufftext);
    const text = reader2.readString();
    expect(text).toBe("precache\n");
  });
});
