import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientPrediction } from '../../src/prediction/index';
import type { UserCommand, PmoveTraceFn } from '@quake2ts/shared';

describe('ClientPrediction Command Buffering', () => {
  let prediction: ClientPrediction;
  const mockTrace: PmoveTraceFn = vi.fn().mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 }, plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 } });
  const mockPointContents = vi.fn().mockReturnValue(0);
  const settings = {
    pmFriction: 6,
    pmStopSpeed: 100,
    pmAccelerate: 10,
    pmAirAccelerate: 1,
    pmWaterAccelerate: 4,
    pmWaterFriction: 1,
    pmMaxSpeed: 300,
    pmDuckSpeed: 100,
    pmWaterSpeed: 400,
    groundIsSlick: false,
  };

  beforeEach(() => {
    mockTrace.mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 }, plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 } });
    mockPointContents.mockReturnValue(0);
    prediction = new ClientPrediction({ trace: mockTrace, pointContents: mockPointContents }, settings);
  });

  const createCommand = (sequence: number): UserCommand => ({
    msec: 10,
    angles: { x: 0, y: 0, z: 0 },
    buttons: 0,
    forwardmove: 0,
    sidemove: 0,
    upmove: 0,
    impulse: 0,
    lightlevel: 0,
    sequence: sequence,
  });

  it('should store commands in the buffer', () => {
    const cmd1 = createCommand(1);
    const cmd2 = createCommand(2);

    prediction.enqueueCommand(cmd1);
    prediction.enqueueCommand(cmd2);

    // Accessing private commands array via type assertion for testing purposes
    const commands = (prediction as any).commands as UserCommand[];
    expect(commands).toHaveLength(2);
    expect(commands[0].sequence).toBe(1);
    expect(commands[1].sequence).toBe(2);
  });

  it('should limit buffer size to CMD_BACKUP (64)', () => {
    for (let i = 0; i < 70; i++) {
        prediction.enqueueCommand(createCommand(i + 1));
    }

    const commands = (prediction as any).commands as UserCommand[];
    expect(commands).toHaveLength(64);
    // Should have kept the most recent commands (70 - 64 + 1 = 7) to 70
    expect(commands[0].sequence).toBe(7);
    expect(commands[63].sequence).toBe(70);
  });

  it('should allow retrieving command by sequence', () => {
    const cmd = createCommand(42);
    prediction.enqueueCommand(cmd);

    const retrieved = prediction.getCommand(42);
    expect(retrieved).toBeDefined();
    expect(retrieved?.sequence).toBe(42);
  });

  it('should return undefined for missing command', () => {
      const retrieved = prediction.getCommand(999);
      expect(retrieved).toBeUndefined();
  });
});
