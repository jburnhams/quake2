import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DedicatedServer } from '../../src/dedicated.js';
import { createGame, GameExports } from '@quake2ts/game';
import { ClientState } from '../../src/client.js';
import { createMockTransport, MockTransport, createMockServerClient, createMockNetDriver, createMockGameExports, createMockConnection, createMockFsPromises, createMockEngineParseBsp } from '@quake2ts/test-utils';
import fsPromises from 'node:fs/promises';
import { parseBsp } from '@quake2ts/engine';

vi.mock('node:fs/promises');
vi.mock('@quake2ts/engine');
vi.mock('@quake2ts/game');

describe('DedicatedServer Connection Flow', () => {
  let server: DedicatedServer;
  let mockGame: GameExports;
  let sentMessages: Uint8Array[] = [];
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let transport: MockTransport;

  beforeEach(async () => {
    // Setup global mocks from shared factories
    const fsMocks = createMockFsPromises();
    vi.mocked(fsPromises.readFile).mockImplementation(fsMocks.readFile as any);

    const engineMocks = createMockEngineParseBsp();
    vi.mocked(parseBsp).mockImplementation(engineMocks.parseBsp as any);

    sentMessages = [];
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockGame = createMockGameExports({
      clientConnect: vi.fn().mockReturnValue(true),
      clientBegin: vi.fn(() => ({ id: 1, classname: 'player' } as any)),
    });

    vi.mocked(createGame).mockReturnValue(mockGame);

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
    const mockNet = createMockNetDriver({
        send: vi.fn((data) => {
            sentMessages.push(data);
        })
    });

    // Use createMockConnection for more semantic setup, overriding with our mockNet
    const client = createMockConnection(ClientState.Connected, {
        net: mockNet,
        edict: null, // Explicitly null edict as player hasn't entered game yet
        index: 0
    });

    // Make sure transmit returns something so client.net.send is called with it
    (client.netchan.transmit as any).mockReturnValue(new Uint8Array([1, 2, 3]));


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
