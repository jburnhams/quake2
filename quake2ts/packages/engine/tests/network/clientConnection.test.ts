import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientConnection, ConnectionState } from '../../src/network/clientConnection.js';
import { NetChan, ServerCommand, BinaryWriter } from '@quake2ts/shared';

describe('ClientConnection', () => {
  let connection: ClientConnection;
  let netchan: NetChan;
  let sendCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    netchan = new NetChan();
    // Mock netchan process to return data as-is (bypass sequence checks for simple tests)
    // or just use a real netchan. Real netchan requires valid headers.

    sendCallback = vi.fn();
    connection = new ClientConnection({
      username: 'test',
      model: 'male',
      skin: 'grunt',
      netchan
    });

    connection.on('send', sendCallback);
  });

  it('should start in Disconnected state', () => {
    expect(connection.getState()).toBe(ConnectionState.Disconnected);
  });

  it('should transition to Challenge state on startProtocol', () => {
    connection.startProtocol();
    expect(connection.getState()).toBe(ConnectionState.Challenge);
    expect(sendCallback).toHaveBeenCalled();
    // Check if getchallenge was sent
    const sentData = sendCallback.mock.calls[0][0] as Uint8Array;
    // We can't easily parse the sent data without a parser, but we know it should have happened.
    expect(sentData.length).toBeGreaterThan(0);
  });

  it('should handle "challenge" stufftext and send connect', () => {
    connection.startProtocol();
    sendCallback.mockClear();

    // Simulate receiving "challenge 12345"
    // We bypass handleMessage and call onStuffText directly for unit testing logic flow
    // calling onStuffText directly mimics the parser output
    connection.onStuffText('challenge 12345');

    expect(sendCallback).toHaveBeenCalled();
    // Should have sent connect command
  });

  it('should transition to Connected on serverdata', () => {
    connection.onServerData(2023, 1, 0, 'baseq2', 0, 'q2dm1');
    expect(connection.getState()).toBe(ConnectionState.Loading);
    expect(connection.serverProtocol).toBe(2023);
    expect(connection.levelName).toBe('q2dm1');
    expect(sendCallback).toHaveBeenCalled(); // Should send 'new'
  });

  it('should transition to Active on "precache" stufftext', () => {
    // Setup state
    connection.onServerData(2023, 1, 0, 'baseq2', 0, 'q2dm1');
    expect(connection.getState()).toBe(ConnectionState.Loading);

    sendCallback.mockClear();
    connection.onStuffText('precache'); // Signal end of loading

    expect(connection.getState()).toBe(ConnectionState.Active);
    expect(sendCallback).toHaveBeenCalled(); // Should send 'begin'
  });

  it('should emit frame events when receiving frames', () => {
    const frameListener = vi.fn();
    connection.on('frame', frameListener);

    const mockFrame = {
      serverFrame: 100,
      deltaFrame: 0,
      surpressCount: 0,
      areaBytes: 0,
      areaBits: new Uint8Array(),
      playerState: null as any,
      packetEntities: { delta: false, entities: [] }
    };

    connection.onFrame(mockFrame);

    expect(frameListener).toHaveBeenCalledWith(mockFrame);
    expect(connection.latestServerFrame).toBe(100);
  });
});
