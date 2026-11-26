// clc_move as CL_SendCmd (client/cl_input.c) writes it: the checksum byte is
// COM_BlockSequenceCRCByte over everything after it, keyed by the packet's sequence.
import { describe, it, expect } from 'vitest';
import { BinaryWriter, ClientCommand, blockSequenceCrcByte, writeMove, writeMoveCommands, type UserCommand } from '../../src/index.js';

const cmd = (msec: number): UserCommand => ({
  msec, buttons: 1, angles: { x: 10, y: 20, z: 0 }, forwardmove: 200, sidemove: -100, upmove: 0,
  impulse: 0, lightlevel: 0, sequence: 0,
});

describe('writeMove', () => {
  it('writes the command, a checksum of the rest, the last frame and three commands', () => {
    const history = [cmd(10), cmd(11), cmd(12)];
    const writer = new BinaryWriter();
    writeMove(writer, 1234, history, 77);
    const data = writer.getData();

    const rest = new BinaryWriter();
    rest.writeLong(1234);
    writeMoveCommands(rest, history);
    const after = rest.getData();

    expect(data[0]).toBe(ClientCommand.move);
    expect([...data.subarray(2)]).toEqual([...after]);
    expect(data[1]).toBe(blockSequenceCrcByte(after, 77));
  });

  it('gives a different checksum for another sequence', () => {
    const at = (sequence: number) => {
      const writer = new BinaryWriter();
      writeMove(writer, 5, [cmd(16)], sequence);
      return writer.getData()[1];
    };
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(at)).size).toBeGreaterThan(4);
  });
});
