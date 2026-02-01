import { describe, expect, it, vi } from 'vitest';
import { EngineHost } from '../../../src/host.js';

describe('EngineHost Integration', () => {
  it('should cleanup game if client initialization fails', () => {
    const game = {
      init: vi.fn(() => ({ frame: 0, timeMs: 0 })),
      frame: vi.fn(),
      shutdown: vi.fn(),
    };

    const client = {
      init: vi.fn(() => {
        throw new Error('Client init failed');
      }),
      render: vi.fn(),
      shutdown: vi.fn(),
    };

    const host = new EngineHost(game, client, {
      loop: { schedule: () => {}, now: () => 0 },
    });

    expect(() => host.start()).toThrow('Client init failed');

    // Current behavior expectation (likely to fail if not implemented)
    expect(game.shutdown).toHaveBeenCalled();
  });

  it('should handle errors during simulation step', () => {
    const game = {
      init: vi.fn(() => ({ frame: 0, timeMs: 0 })),
      frame: vi.fn(() => {
        throw new Error('Simulation failed');
      }),
      shutdown: vi.fn(),
    };

    const host = new EngineHost(game, undefined, {
      loop: { schedule: () => {}, now: () => 0, fixedDeltaMs: 10 },
    });

    host.start();

    // Pump the loop to trigger simulation
    expect(() => host.pump(20)).toThrow('Simulation failed');

    // Check if it's still running or stopped?
    // Ideally it should stop or handle the error.
    // But FixedTimestepLoop might catch it?
  });
});
