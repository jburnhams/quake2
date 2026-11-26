// clc_move as SV_ExecuteClientMessage (server/sv_user.c) runs it: every command runs as its
// packet arrives, and when packets were lost the commands the next packet repeats stand in for
// theirs (net_drop), with the last command run again beyond two.
import { describe, it, expect, vi } from 'vitest';
import { DedicatedServer } from '../../src/dedicated';
import { ClientState } from '../../src/client';
import type { NetworkTransport } from '../../src/transport';
import { NetChan, ClientCommand, BinaryWriter, writeMove, type NetDriver, type UserCommand } from '@quake2ts/shared';
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

function setup(options: { floodLimit?: number } = {}) {
  const server = new DedicatedServer({ transport: new Transport(), maxPlayers: 1, ...options }) as any;
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
    writeMove(writer, 0, history, chan.outgoingSequence + 1);
    const packet = chan.transmit(writer.getData());
    if (!lost) driver.receiveMessage(packet);
  };
  /** Sends `payload` as the next packet, as written (for broken or doubled moves). */
  const sendRaw = (payload: Uint8Array) => driver.receiveMessage(chan.transmit(payload));
  const read = () => server.SV_ReadPackets();
  return { send, sendRaw, read, ran, client, chan, history, server };
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

  it('refuses movement beyond the time the server gave (SV_ClientThink, sv_enforcetime)', () => {
    const { send, read, ran, client } = setup();
    client.commandMsec = 50;
    send(20);
    send(20);
    send(20);
    read();
    // 50 ms buys the first two 20 ms commands; the third would overdraw it.
    expect(ran).toEqual([20, 20]);
  });

  it('runs no commands from a client over the flood limit', () => {
    const { send, read, ran } = setup({ floodLimit: 2 });
    send(1);
    send(2);
    send(3);
    send(4);
    read();
    expect(ran).toEqual([1, 2]);
  });

  describe('the checksum (COM_BlockSequenceCRCByte, keyed by the packet sequence)', () => {
    const move = (n: number, sequence: number, history: UserCommand[]) => {
      history.push(command(n));
      const writer = new BinaryWriter();
      writeMove(writer, 0, history, sequence);
      return writer.getData();
    };

    it('runs a move whose checksum matches its packet', () => {
      const { sendRaw, read, ran, chan, history } = setup();
      sendRaw(move(1, chan.outgoingSequence + 1, history));
      read();
      expect(ran).toEqual([1]);
    });

    it('drops a move keyed by another sequence, and the rest of its packet', () => {
      const { sendRaw, read, ran, chan, history, server } = setup();
      const said = vi.spyOn(server, 'handleStringCmd');
      const bad = move(1, chan.outgoingSequence + 2, history);
      const stringcmd = new BinaryWriter();
      stringcmd.writeByte(ClientCommand.stringcmd);
      stringcmd.writeString('say hello');
      const payload = new Uint8Array(bad.length + stringcmd.getData().length);
      payload.set(bad);
      payload.set(stringcmd.getData(), bad.length);
      sendRaw(payload);
      read();
      expect(ran).toEqual([]);
      expect(said).not.toHaveBeenCalled();
    });

    it('drops a move whose commands were changed after the checksum', () => {
      const { sendRaw, read, ran, chan, history } = setup();
      const data = move(1, chan.outgoingSequence + 1, history);
      data[data.length - 2] ^= 1; // the last command's msec
      sendRaw(data);
      read();
      expect(ran).toEqual([]);
    });

    it('runs only the first of two moves in one packet (move_issued)', () => {
      const { sendRaw, read, ran, chan, history } = setup();
      const sequence = chan.outgoingSequence + 1;
      const first = move(1, sequence, history);
      const second = move(2, sequence, history);
      const payload = new Uint8Array(first.length + second.length);
      payload.set(first);
      payload.set(second, first.length);
      sendRaw(payload);
      read();
      expect(ran).toEqual([1]);
    });

    it('keeps reading the packet after a move from a client not yet in the game', () => {
      const { sendRaw, read, ran, chan, history, client } = setup();
      client.state = ClientState.Connected;
      const data = move(1, chan.outgoingSequence + 1, history);
      const nop = new Uint8Array(data.length + 1);
      nop.set(data);
      nop[data.length] = ClientCommand.nop;
      sendRaw(nop);
      expect(() => read()).not.toThrow();
      expect(ran).toEqual([]);
    });
  });
});
