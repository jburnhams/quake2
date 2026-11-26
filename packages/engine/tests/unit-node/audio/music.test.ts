import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MusicSystem } from '../../../src/audio/music.js';
import type { AudioElementLike } from '../../../src/audio/music.js';

class FakeAudioElement implements AudioElementLike {
  src = '';
  loop = false;
  volume = 1;
  currentTime = 0;
  paused = true;
  ended = false;
  playCount = 0;
  pauseCount = 0;

  async play(): Promise<void> {
    this.paused = false;
    this.ended = false;
    this.playCount += 1;
  }

  pause(): void {
    this.paused = true;
    this.pauseCount += 1;
  }

  load(): void {}
}

describe('MusicSystem', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves sources and plays music with restart and resume semantics', async () => {
    let created = 0;
    const system = new MusicSystem({
      createElement: () => {
        created += 1;
        return new FakeAudioElement();
      },
      resolveSource: async (path) => `media/${path}`,
      crossfadeDuration: 0, // Disable crossfade for this test
    });

    await system.play('track1.ogg');
    // Fast forward any potential timers (though duration 0 should be instant-ish, implementation uses interval)
    vi.advanceTimersByTime(100);

    const state = system.getState();
    expect(state.track).toBe('track1.ogg');
    expect(state.playing).toBe(true);
    expect(state.volume).toBe(1);
    expect(created).toBe(1);

    await system.play('track1.ogg', { restart: true });
    vi.advanceTimersByTime(100);
    expect(system.getState().playing).toBe(true);

    system.pause();
    expect(system.getState().paused).toBe(true);
    await system.resume();
    expect(system.getState().paused).toBe(false);
  });

  it('switches tracks, respects loop flag, and applies volume changes with crossfade', async () => {
    const elements: FakeAudioElement[] = [];
    const system = new MusicSystem({
      createElement: () => {
        const element = new FakeAudioElement();
        elements.push(element);
        return element;
      },
      crossfadeDuration: 1.0,
      volume: 1.0
    });

    // 1. Play first track
    await system.play('level1.ogg', { loop: false });
    const el1 = elements[0];

    // Initially volume should start incrementing (we tick immediately)
    // 50ms / 1000ms * 1.0 = 0.05 per tick
    // Initial call runs one tick: 0 -> 0.05
    expect(el1.volume).toBeCloseTo(0.05);

    // Advance halfway through fade
    vi.advanceTimersByTime(500);
    expect(el1.volume).toBeGreaterThan(0.5);
    expect(el1.volume).toBeLessThan(1);

    // Advance to end of fade
    vi.advanceTimersByTime(600);
    expect(el1.volume).toBeCloseTo(1);
    expect(el1.loop).toBe(false);

    // 2. Change volume
    system.setVolume(0.2);
    expect(el1.volume).toBeCloseTo(0.2);

    // 3. Switch track (should crossfade)
    await system.play('level2.ogg');
    const el2 = elements[1];

    expect(system.getState().track).toBe('level2.ogg');

    // New track starts at first tick
    // Target volume is now 0.2 (from setVolume)
    // Step: 0.2 / 20 steps = 0.01 per tick
    expect(el2.volume).toBeCloseTo(0.01);
    // Old track starts fading out from 0.2
    // 0.2 - 0.01 = 0.19
    expect(el1.volume).toBeCloseTo(0.19);

    // Advance timers
    vi.advanceTimersByTime(1100);

    // Old track should be paused/gone
    expect(el1.paused).toBe(true);
    // New track should be at target volume (0.2)
    expect(el2.volume).toBeCloseTo(0.2);

    system.stop();
    expect(system.getState().track).toBeUndefined();
    expect(el2.paused).toBe(true);
  });

  it('playTrack helper formats track name correctly', async () => {
      let lastSrc = '';
      const system = new MusicSystem({
          createElement: () => new FakeAudioElement(),
          resolveSource: async (path) => {
              lastSrc = path;
              return path;
          }
      });

      await system.playTrack(2);
      expect(lastSrc).toBe('music/track02.ogg');

      await system.playTrack(10);
      expect(lastSrc).toBe('music/track10.ogg');
  });

  it('reuses existing elements while updating loop state and volume on repeat plays', async () => {
    const elements: FakeAudioElement[] = [];
    const system = new MusicSystem({
      createElement: () => {
        const element = new FakeAudioElement();
        elements.push(element);
        return element;
      },
      volume: 0.4,
      crossfadeDuration: 0 // Instant
    });

    await system.play('looped.ogg');
    vi.advanceTimersByTime(100);
    expect(elements).toHaveLength(1);
    expect(elements[0].loop).toBe(true);
    system.setVolume(0.6);

    await system.play('looped.ogg', { loop: false });
    vi.advanceTimersByTime(100);

    // Should reuse the same element
    expect(elements).toHaveLength(1);
    expect(elements[0].loop).toBe(false);
    expect(elements[0].volume).toBeCloseTo(0.6);
  });
});
