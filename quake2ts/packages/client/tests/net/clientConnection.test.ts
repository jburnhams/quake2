import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ClientConnection, ConnectionState } from '../../src/net/clientConnection.js';
import { MessageWriter } from '@quake2ts/engine';
import { createMockSnapshot } from '@quake2ts/test-utils';

describe('ClientConnection', () => {
  let connection: ClientConnection;

  beforeEach(() => {
    connection = new ClientConnection();
  });

  it('starts in Disconnected state', () => {
    expect(connection.state).toBe(ConnectionState.Disconnected);
  });

  it('updates state on setState', () => {
    const spy = vi.fn();
    connection.onStateChange = spy;
    connection.setState(ConnectionState.Connecting);
    expect(connection.state).toBe(ConnectionState.Connecting);
    expect(spy).toHaveBeenCalledWith(ConnectionState.Connecting);
  });

  it('handles svc_serverdata correctly', () => {
    // Construct a serverdata message
    const writer = new MessageWriter();
    writer.writeServerData(34, 1234, 1, 'baseq2', 0, 'maps/q2dm1.bsp');

    connection.handleMessage(writer.getData());

    expect(connection.state).toBe(ConnectionState.Connected);
    expect(connection.serverProtocol).toBe(34);
    expect(connection.serverCount).toBe(1234);
    expect(connection.gameDir).toBe('baseq2');
    expect(connection.levelName).toBe('maps/q2dm1.bsp');
  });

  it('handles svc_configstring correctly', () => {
    const writer = new MessageWriter();
    writer.writeConfigString(1, 'some value', 34); // Protocol 34

    connection.handleMessage(writer.getData());

    expect(connection.configStrings.get(1)).toBe('some value');
  });

  it('handles svc_frame and updates latestServerFrame', () => {
    const writer = new MessageWriter();
    // Use test-utils to create mock snapshot
    const frameData = createMockSnapshot(100, [], {
        origin: { x: 10, y: 20, z: 30 },
        gravity: 800
    }, 99);

    // We need to ensure we parse serverdata first so protocol matches?
    // NetworkMessageParser defaults to 0.
    // Let's set connection protocol first by sending serverdata
    const initWriter = new MessageWriter();
    initWriter.writeServerData(34, 1, 0, '', 0, '');
    connection.handleMessage(initWriter.getData());

    writer.writeFrame(frameData, 34);
    connection.handleMessage(writer.getData());

    expect(connection.latestServerFrame).toBe(100);
  });

  it('resets state correctly', () => {
      connection.configStrings.set(1, 'test');
      connection.latestServerFrame = 50;
      connection.setState(ConnectionState.Active);

      connection.reset();

      expect(connection.state).toBe(ConnectionState.Disconnected);
      expect(connection.configStrings.size).toBe(0);
      expect(connection.latestServerFrame).toBe(0);
  });
});
