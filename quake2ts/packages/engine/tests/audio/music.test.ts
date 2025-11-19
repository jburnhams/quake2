import { describe, expect, it } from 'vitest';
import { MusicSystem } from '../../src/audio/music.js';
import type { AudioElementLike } from '../../src/audio/music.js';

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
  it('resolves sources and plays music with restart and resume semantics', async () => {
    let created = 0;
    const system = new MusicSystem({
      createElement: () => {
        created += 1;
        return new FakeAudioElement();
      },
      resolveSource: async (path) => `media/${path}`,
    });

    await system.play('track1.ogg');
    const state = system.getState();
    expect(state.track).toBe('track1.ogg');
    expect(state.playing).toBe(true);
    expect(state.volume).toBe(1);
    expect(created).toBe(1);

    await system.play('track1.ogg', { restart: true });
    expect(system.getState().playing).toBe(true);

    system.pause();
    expect(system.getState().paused).toBe(true);
    await system.resume();
    expect(system.getState().paused).toBe(false);
  });

  it('switches tracks, respects loop flag, and applies volume changes', async () => {
    const elements: FakeAudioElement[] = [];
    const system = new MusicSystem({
      createElement: () => {
        const element = new FakeAudioElement();
        elements.push(element);
        return element;
      },
    });

    await system.play('level1.ogg', { loop: false });
    expect(elements[0].loop).toBe(false);
    system.setVolume(0.2);
    expect(elements[0].volume).toBeCloseTo(0.2);

    await system.play('level2.ogg');
    expect(system.getState().track).toBe('level2.ogg');
    expect(elements[1].volume).toBeCloseTo(0.2);

    system.stop();
    expect(system.getState().track).toBeUndefined();
    expect(elements[1].paused).toBe(true);
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
    });

    await system.play('looped.ogg');
    expect(elements).toHaveLength(1);
    expect(elements[0].loop).toBe(true);
    system.setVolume(0.6);

    await system.play('looped.ogg', { loop: false });
    expect(elements).toHaveLength(1);
    expect(elements[0].loop).toBe(false);
    expect(elements[0].volume).toBeCloseTo(0.6);
  });
});
