// clc_move as SV_ExecuteClientMessage (server/sv_user.c) runs it: every command runs as its
// packet arrives, and when packets were lost the commands the next packet repeats stand in for
// theirs (net_drop), with the last command run again beyond two.
import { describe, it, expect, vi } from 'vitest';
import { DedicatedServer } from '../../src/dedicated';
import { ClientState } from '../../src/client';
import type { NetworkTransport } from '../../src/transport';
import { NetChan, ClientCommand, BinaryWriter, writeMoveCommands, type NetDriver, type UserCommand } from '@quake2ts/shared';
import { MockNetDriver } from '@quake2ts/test-utils';

class Transport implements NetworkTransport {
  listen(): Promise<void> { return Promise.resolve(); }
  close(): void {}
  onConnection(cb: (driver: NetDriver) => void): void { this.connect = cb; }
  onError(): void {}
  connect: ((driver: NetDriver) => void) | null = null;
}

/** Command n has n msec, so the runs say which commands ran. */
const command = (n: number): UserCommand => ({
  msec: n, buttons: 0, angles: { x: 0, y: 0, z: 0 }, forwardmove: 0, sidemove: 0, upmove: 0,
  sequence: n, lightlevel: 0, impulse: 0,
});

function setup() {
  const server = new DedicatedServer({ transport: new Transport(), maxPlayers: 1 }) as any;
  server.svs.initialized = true;
  const driver = new MockNetDriver();
  server.handleConnection(driver);
  const client = server.svs.clients[0];
  client.state = ClientState.Active;
  client.edict = { index: 1 };
  const ran: number[] = [];
  server.game = { clientThink: vi.fn((_ent: unknown, cmd: UserCommand) => ran.push(cmd.msec)) };

  const chan = new NetChan();
  chan.setup(client.netchan.qport);
  const history: UserCommand[] = [];
  /** The client makes command n and sends it with the two before it; `lost` packets never arrive. */
  const send = (n: number, lost = false) => {
    history.push(command(n));
    const writer = new BinaryWriter();
    writer.writeByte(ClientCommand.move);
    writer.writeByte(0);
    writer.writeLong(0);
    writeMoveCommands(writer, history);
    const packet = chan.transmit(writer.getData());
    if (!lost) driver.receiveMessage(packet);
  };
  const read = () => server.SV_ReadPackets();
  return { send, read, ran };
}

describe('clc_move on the server', () => {
  it('runs every command that arrives, not only the newest per frame', () => {
    const { send, read, ran } = setup();
    send(1);
    send(2);
    send(3);
    read();
    expect(ran).toEqual([1, 2, 3]);
  });

  it('runs the commands of up to two lost packets from the next one', () => {
    const { send, read, ran } = setup();
    send(1);
    send(2, true);
    send(3, true);
    send(4);
    read();
    expect(ran).toEqual([1, 2, 3, 4]);
  });

  it('repeats the last command for losses beyond two', () => {
    const { send, read, ran } = setup();
    send(1);
    send(2, true);
    send(3, true);
    send(4, true);
    send(5, true);
    send(6);
    read();
    // Two repeats of command 1 stand in for 2 and 3; 4 and 5 come from the packet.
    expect(ran).toEqual([1, 1, 1, 4, 5, 6]);
  });
});
