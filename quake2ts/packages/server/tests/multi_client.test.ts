import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DedicatedServer } from '../src/dedicated';
import { createGame, GameExports } from '@quake2ts/game';
import { ClientState, Client } from '../src/client';
import { UserCommand, UPDATE_BACKUP } from '@quake2ts/shared';
import { WebSocketNetDriver } from '../src/net/nodeWsDriver';

// Mock dependencies
vi.mock('ws', () => ({
  WebSocketServer: class MockWebSocketServer {
    on(event: string, cb: any) { this._onConnection = cb; }
    close() {}
    _onConnection: any;
  }
}));

vi.mock('../src/net/nodeWsDriver', () => ({
  WebSocketNetDriver: vi.fn().mockImplementation(() => ({
    attach: vi.fn(),
    onMessage: vi.fn(),
    onClose: vi.fn(),
    disconnect: vi.fn()
  }))
}));

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

const FRAME_TIME_MS = 100; // 10Hz

describe('DedicatedServer Multi-Client', () => {
  let server: DedicatedServer;
  let mockGame: GameExports;
  let wssInstance: any;

  beforeEach(async () => {
    vi.useFakeTimers();

    mockGame = {
      init: vi.fn(),
      shutdown: vi.fn(),
      spawnWorld: vi.fn(),
      clientBegin: vi.fn(() => ({ id: 1, classname: 'player' })),
      clientThink: vi.fn(),
      frame: vi.fn().mockReturnValue({
        state: {
          packetEntities: [],
          gravity: { x: 0, y: 0, z: -800 },
          origin: { x: 0, y: 0, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
          viewangles: { x: 0, y: 0, z: 0 },
          deltaAngles: { x: 0, y: 0, z: 0 },
          kick_angles: { x: 0, y: 0, z: 0 },
          gunoffset: { x: 0, y: 0, z: 0 },
          gunangles: { x: 0, y: 0, z: 0 },
          blend: [0, 0, 0, 0],
          stats: new Array(32).fill(0),
          pmFlags: 0,
          pmType: 0,
          gunindex: 0
        }
      }),
      entities: {
          forEachEntity: vi.fn(),
          getByIndex: vi.fn()
      },
      clientDisconnect: vi.fn(),
      clientConnect: vi.fn().mockReturnValue(true)
    } as unknown as GameExports;

    (createGame as vi.Mock).mockReturnValue(mockGame);

    server = new DedicatedServer();
    await server.start('test.bsp');

    // Capture the wss instance
    wssInstance = (server as any).wss;
  });

  afterEach(() => {
    server.stop();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should handle multiple clients connecting', () => {
    // Simulate Client 1 connecting
    const ws1 = { _socket: { remoteAddress: '::1' }, close: vi.fn() };
    wssInstance._onConnection(ws1);

    // Get the driver created for Client 1
    const driver1 = (WebSocketNetDriver as any).mock.results.slice(-1)[0].value;
    expect(driver1.attach).toHaveBeenCalledWith(ws1);

    // Simulate Client 2 connecting
    const ws2 = { _socket: { remoteAddress: '::1' }, close: vi.fn() };
    wssInstance._onConnection(ws2);

    const driver2 = (WebSocketNetDriver as any).mock.results.slice(-1)[0].value;
    expect(driver2.attach).toHaveBeenCalledWith(ws2);

    // Verify slots
    const clients = (server as any).svs.clients;
    const activeClients = clients.filter((c: any) => c && c.state !== ClientState.Free);

    expect(activeClients.length).toBe(2);
    expect(activeClients[0].index).toBe(0);
    expect(activeClients[1].index).toBe(1);
  });

  it('should reuse slots after disconnect', () => {
    // Connect Client 1
    const ws1 = { _socket: { remoteAddress: '::1' }, close: vi.fn() };
    wssInstance._onConnection(ws1);
    const driver1 = (WebSocketNetDriver as any).mock.results.slice(-1)[0].value;

    // Capture onClose callback.
    // In handleConnection: driver.onClose(() => this.onClientDisconnect(client));
    // driver1.onClose was called with the callback.
    const onCloseCall = driver1.onClose.mock.calls[0];
    const disconnectFn = onCloseCall[0];

    // Verify slot 0 taken
    const clients = (server as any).svs.clients;
    expect(clients[0].state).toBe(ClientState.Connected);

    // Disconnect Client 1
    disconnectFn();

    // Verify slot 0 free (null)
    expect(clients[0]).toBeNull();

    // Connect Client 2
    const ws2 = { _socket: { remoteAddress: '::1' }, close: vi.fn() };
    wssInstance._onConnection(ws2);

    // Should take slot 0 again
    expect(clients[0].state).toBe(ClientState.Connected);
    expect(clients[1]).toBeNull();
  });

  it('should correctly map messages to clients even with same IP', () => {
    // 1. Connect Client 0
    const ws0 = { _socket: { remoteAddress: '::1' }, close: vi.fn() };
    wssInstance._onConnection(ws0);
    const driver0 = (WebSocketNetDriver as any).mock.results.slice(-1)[0].value;

    // Capture onMessage callback
    const onMessage0 = driver0.onMessage.mock.calls[0][0];

    // 2. Connect Client 1
    const ws1 = { _socket: { remoteAddress: '::1' }, close: vi.fn() };
    wssInstance._onConnection(ws1);
    const driver1 = (WebSocketNetDriver as any).mock.results.slice(-1)[0].value;

    // Capture onMessage callback
    const onMessage1 = driver1.onMessage.mock.calls[0][0];

    const clients = (server as any).svs.clients;
    const client0 = clients[0];
    const client1 = clients[1];

    expect(client0.index).toBe(0);
    expect(client1.index).toBe(1);

    // 3. Send message from Client 0
    const msg0 = new Uint8Array([0xAB]);
    onMessage0(msg0);

    // Verify Client 0 queue has message
    expect(client0.messageQueue.length).toBe(1);
    expect(client0.messageQueue[0]).toEqual(msg0);
    expect(client1.messageQueue.length).toBe(0);

    // 4. Send message from Client 1
    const msg1 = new Uint8Array([0xCD]);
    onMessage1(msg1);

    // Verify Client 1 queue has message
    expect(client0.messageQueue.length).toBe(1);
    expect(client1.messageQueue.length).toBe(1);
    expect(client1.messageQueue[0]).toEqual(msg1);
  });
});
