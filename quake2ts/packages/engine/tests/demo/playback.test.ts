import { describe, it, expect, vi } from 'vitest';
import { DemoPlaybackController, PlaybackState } from '../../src/demo/playback.js';

describe('DemoPlaybackController', () => {
  it('should load a demo and start in Stopped state', () => {
    const controller = new DemoPlaybackController();
    const buffer = new ArrayBuffer(100);
    controller.loadDemo(buffer);
    expect(controller.getState()).toBe(PlaybackState.Stopped);
  });

  it('should transition states correctly', () => {
    const controller = new DemoPlaybackController();
    const buffer = new ArrayBuffer(100);
    controller.loadDemo(buffer);

    controller.play();
    expect(controller.getState()).toBe(PlaybackState.Playing);

    controller.pause();
    expect(controller.getState()).toBe(PlaybackState.Paused);

    controller.play();
    expect(controller.getState()).toBe(PlaybackState.Playing);

    controller.stop();
    expect(controller.getState()).toBe(PlaybackState.Stopped);
  });

  it('should update time and read blocks during playback', () => {
    // Create a dummy buffer with 2 blocks
    // Block 1: Length 4, Data 0,0,0,0 (nop x4)
    // Block 2: Length 4, Data 0,0,0,0
    const buffer = new ArrayBuffer(8 + 8);
    const view = new DataView(buffer);
    view.setInt32(0, 4, true);
    view.setInt32(8, 4, true);

    const controller = new DemoPlaybackController();
    controller.loadDemo(buffer);
    controller.play();

    // Update with enough time for 1 frame (100ms = 0.1s)
    // The logic subtracts frameDuration (100ms) per block.

    // 1st update: 0.15s -> Should process 1 block (accum 150 -> 50)
    controller.update(0.15);

    // We can't easily spy on internal reader without exposing it,
    // but we can verify state isn't finished.
    expect(controller.getState()).toBe(PlaybackState.Playing);

    // 2nd update: 0.1s -> accum 50+100 = 150 -> process block 2 -> 50
    controller.update(0.1);

    // Now we should have consumed both blocks.
    // Next update will find no blocks and finish.
    controller.update(0.1);

    expect(controller.getState()).toBe(PlaybackState.Finished);
  });
});
