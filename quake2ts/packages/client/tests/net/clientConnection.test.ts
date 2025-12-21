import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ClientConnection, ConnectionState } from '../../src/net/clientConnection.js';
import { MessageWriter } from '@quake2ts/engine';

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
    // We need to write a frame.
    // writeFrame signature: (frame: FrameData, protocolVersion: number)
    // Construct a minimal frame
    const frameData = {
        serverFrame: 100,
        deltaFrame: 99,
        surpressCount: 0,
        areaBytes: 0,
        areaBits: new Uint8Array(),
        playerState: {
            pm_type: 0,
            origin: { x: 10, y: 20, z: 30 },
            velocity: { x: 0, y: 0, z: 0 },
            pm_time: 0,
            pm_flags: 0,
            gravity: 800,
            delta_angles: { x: 0, y: 0, z: 0 },
            viewoffset: { x: 0, y: 0, z: 0 },
            viewangles: { x: 0, y: 0, z: 0 },
            kick_angles: { x: 0, y: 0, z: 0 },
            gun_index: 0,
            gun_frame: 0,
            gun_offset: { x: 0, y: 0, z: 0 },
            gun_angles: { x: 0, y: 0, z: 0 },
            blend: [0, 0, 0, 0],
            fov: 90,
            rdflags: 0,
            stats: [],
            gunskin: 0,
            gunrate: 0,
            damage_blend: [0, 0, 0, 0],
            team_id: 0,
            watertype: 0
        },
        packetEntities: { delta: false, entities: [] }
    };

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
