import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoPlaybackController, PlaybackState } from '../../src/demo/playback.js';

describe('DemoPlaybackController Metadata & Seek', () => {
  let controller: DemoPlaybackController;
  let buffer: ArrayBuffer;

  beforeEach(() => {
    // Create a synthetic buffer with 10 empty messages
    const messageCount = 10;
    const messageSize = 4; // 0 length + 4 bytes overhead
    buffer = new ArrayBuffer(messageCount * 4);
    const view = new DataView(buffer);
    for (let i = 0; i < messageCount; i++) {
        view.setInt32(i * 4, 0, true); // Length 0
    }

    controller = new DemoPlaybackController();
    controller.loadDemo(buffer);
  });

  it('should report correct total frames', () => {
    expect(controller.getTotalFrames()).toBe(10);
  });

  it('should report correct duration (default 10Hz)', () => {
    // 10 frames * 100ms = 1000ms = 1.0s
    expect(controller.getDuration()).toBe(1.0);
  });

  it('should update current frame during playback', () => {
    expect(controller.getCurrentFrame()).toBe(0);
    controller.stepForward();
    expect(controller.getCurrentFrame()).toBe(1);
    controller.stepForward();
    expect(controller.getCurrentFrame()).toBe(2);
  });

  it('should seek to specific frame', () => {
    controller.seek(5);
    expect(controller.getCurrentFrame()).toBe(5);

    // Verify playback continues from there
    controller.stepForward();
    expect(controller.getCurrentFrame()).toBe(6);
  });

  it('should clamp seek to bounds', () => {
    controller.seek(-5);
    expect(controller.getCurrentFrame()).toBe(0);

    controller.seek(100);
    expect(controller.getCurrentFrame()).toBe(9); // Last valid index
  });

  it('should reset accumulators on seek', () => {
      // Simulate some playback time
      controller.play();
      controller.update(0.05); // 50ms
      expect(controller.getCurrentTime()).toBeGreaterThan(0);

      controller.seek(2);
      expect(controller.getCurrentTime()).toBe(0);
  });
});
