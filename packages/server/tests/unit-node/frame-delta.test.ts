// SV_WriteFrameToClient and SV_EmitPacketEntities (server/sv_ents.c): each frame is a delta from
// the frame the client last said it has (clc_move's lastframe), so a lost frame costs nothing,
// and the client (CL_ParseFrame) rebuilds every frame from the one it names. These run the
// server's bytes through the client's parser and frame history.
import { describe, it, expect } from 'vitest';
import { DedicatedServer } from '../../src/dedicated';
import { ClientState } from '../../src/client';
import type { NetworkTransport } from '../../src/transport';
import { BinaryStream, NetChan, type EntityState, type NetDriver } from '@quake2ts/shared';
import { ClientFrames, NetworkMessageParser, type FrameData, type NetworkMessageHandler } from '@quake2ts/engine';
import { MockNetDriver } from '@quake2ts/test-utils';

class Transport implements NetworkTransport {
  listen(): Promise<void> { return Promise.resolve(); }
  close(): void {}
  onConnection(cb: (driver: NetDriver) => void): void { this.connect = cb; }
  onError(): void {}
  connect: ((driver: NetDriver) => void) | null = null;
}

const zero = { x: 0, y: 0, z: 0 };
const entity = (number: number, x: number, frame = 0): EntityState => ({
  number, origin: { x, y: 0, z: 0 }, angles: zero, modelIndex: 2, frame, skinNum: 0, effects: 0, renderfx: 0, solid: 0,
});

function snapshot(entities: EntityState[], player: Record<string, unknown> = {}) {
  return {
    pmType: 0, origin: zero, velocity: zero, pm_time: 0, pmFlags: 0, gravity: { x: 0, y: 0, z: -800 },
    deltaAngles: zero, viewangles: zero, kick_angles: zero, gunindex: 0, gun_frame: 0, gunoffset: zero,
    gunangles: zero, blend: [0, 0, 0, 0], fov: 90, rdflags: 0, stats: new Array(32).fill(0), watertype: 0,
    packetEntities: entities,
    ...player,
  };
}

function setup() {
  const server = new DedicatedServer({ transport: new Transport(), maxPlayers: 1 }) as any;
  server.svs.initialized = true;
  const driver = new MockNetDriver();
  server.handleConnection(driver);
  const client = server.svs.clients[0];
  client.state = ClientState.Active;

  const chan = new NetChan();
  chan.setup(client.netchan.qport);
  const frames = new ClientFrames();
  const parsed: {
    serverFrame: number; deltaFrame: number; valid: boolean; entities: Map<number, EntityState>;
    playerState: any; bits: number | undefined;
  }[] = [];
  const handler = new Proxy({}, {
    get: (_t, name) => name === 'onFrame'
      ? (frame: FrameData) => {
        const f = frames.parse(frame, new Map());
        parsed.push({
          serverFrame: f.serverFrame, deltaFrame: f.deltaFrame, valid: f.valid, entities: new Map(f.entities as any),
          playerState: f.playerState, bits: frame.playerState.bits,
        });
      }
      : () => {},
  }) as NetworkMessageHandler;

  /** The server sends frame n; `lost` frames never reach the client. */
  const send = (n: number, entities: EntityState[], lost = false, player: Record<string, unknown> = {}) => {
    server.sv.frame = n;
    const before = driver.state.messagesSent.length;
    server.SV_SendClientFrame(client, snapshot(entities, player));
    const packet = driver.state.messagesSent[before];
    if (lost) return;
    const data = chan.process(packet);
    if (!data || data.length === 0) return;
    const parser = new NetworkMessageParser(new BinaryStream(data), handler);
    parser.setProtocolVersion(34); // what the server's svc_serverdata says
    parser.parseMessage();
  };
  /** The client's clc_move reaches the server, saying which frame it has. */
  const ack = () => { client.lastFrame = frames.acknowledged; };
  return { send, ack, parsed, client };
}

const xs = (entities: Map<number, EntityState>) => [...entities].map(([n, e]) => [n, e.origin.x]);

describe('frames delta from the frame the client has', () => {
  it('sends a whole frame until the client says it has one', () => {
    const { send, parsed } = setup();
    send(1, [entity(5, 10)]);
    send(2, [entity(5, 20)]);
    expect(parsed.map((f) => f.deltaFrame)).toEqual([-1, -1]);
    expect(xs(parsed[1]!.entities)).toEqual([[5, 20]]);
  });

  it('deltas from the acknowledged frame, so a lost frame leaves nothing wrong', () => {
    const { send, ack, parsed } = setup();
    send(1, [entity(5, 10), entity(6, 0)]);
    ack();
    // Frame 2 moves 5 and removes 6, and is lost; frame 3 deltas from 1, which the client has.
    send(2, [entity(5, 20)], true);
    send(3, [entity(5, 30), entity(7, 4)]);
    const last = parsed.at(-1)!;
    expect(last).toMatchObject({ serverFrame: 3, deltaFrame: 1, valid: true });
    expect(xs(last.entities)).toEqual([[5, 30], [7, 4]]);
  });

  it('keeps unchanged entities without sending them', () => {
    const { send, ack, parsed } = setup();
    send(1, [entity(5, 10), entity(6, 50, 3)]);
    ack();
    send(2, [entity(5, 11), entity(6, 50, 3)]);
    expect(xs(parsed.at(-1)!.entities)).toEqual([[5, 11], [6, 50]]);
    expect(parsed.at(-1)!.entities.get(6)).toMatchObject({ frame: 3 });
  });

  it('sends a whole frame again when the acknowledged frame is too old', () => {
    const { send, ack, parsed, client } = setup();
    send(1, [entity(5, 10)]);
    ack();
    for (let n = 2; n <= 14; n++) send(n, [entity(5, n)], true);
    send(15, [entity(5, 15)]);
    expect(client.lastFrame).toBe(1);
    expect(parsed.at(-1)).toMatchObject({ serverFrame: 15, deltaFrame: -1, valid: true });
  });
});

// SV_WritePlayerstateToClient and CL_ParsePlayerstate: the player state is a delta from the same
// frame the entities are, so a field that is not sent keeps the client's old value.
describe('the player state deltas from the frame the client has', () => {
  const PS_FOV = 2048;
  const withHealth = (health: number) => { const stats = new Array(32).fill(0); stats[1] = health; return stats; };

  it('sends only what changed, and a field going back to zero', () => {
    const { send, ack, parsed } = setup();
    send(1, [], false, { stats: withHealth(100), fov: 90 });
    ack();
    send(2, [], false, { stats: withHealth(0), fov: 90 });
    expect(parsed[1].deltaFrame).toBe(1);
    expect(parsed[1].bits! & PS_FOV).toBe(0); // the fov did not change, so it is not sent
    expect(parsed[1].playerState.fov).toBe(90); // and the client keeps it
    expect(parsed[1].playerState.stats[1]).toBe(0); // health 0 did reach the client
  });

  it('deltas from the acknowledged frame past a lost one', () => {
    const { send, ack, parsed } = setup();
    send(1, [], false, { fov: 90 });
    ack();
    send(2, [], true, { fov: 110 }); // lost
    send(3, [], false, { fov: 110 });
    expect(parsed[1].deltaFrame).toBe(1);
    expect(parsed[1].bits! & PS_FOV).toBe(PS_FOV); // against frame 1, which had 90
    expect(parsed[1].playerState.fov).toBe(110);
  });
});
