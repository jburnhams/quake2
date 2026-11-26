import { describe, expect, it } from 'vitest';
import { FrameStats } from '../src/play/stats';

describe('frame stats', () => {
  it('reads nothing until two frames are drawn', () => {
    const stats = new FrameStats();
    expect(stats.read()).toBeNull();
    stats.frame(1000, 2);
    expect(stats.read()).toBeNull();
  });

  it('gives the rate, the worst gap and the CPU time over the last second', () => {
    const stats = new FrameStats();
    let t = 0;
    for (let i = 0; i < 60; i++) stats.frame((t += 1000 / 60), 2);
    stats.frame((t += 50), 4); // one hitch
    const read = stats.read()!;
    expect(read.fps).toBeGreaterThan(50);
    expect(read.fps).toBeLessThan(60);
    expect(read.worstFrameMs).toBeCloseTo(50);
    expect(read.cpuMs).toBeGreaterThan(2);
  });

  it('forgets frames older than a second', () => {
    const stats = new FrameStats();
    stats.frame(0, 1);
    stats.frame(100, 1); // a 100 ms gap
    for (let t = 1200; t <= 2200; t += 10) stats.frame(t, 1);
    expect(stats.read()!.worstFrameMs).toBe(10);
  });
});
