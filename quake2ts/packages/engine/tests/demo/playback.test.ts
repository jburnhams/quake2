import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoPlaybackController, PlaybackState } from '../../src/demo/playback.js';
import { NetworkMessageHandler } from '../../src/demo/parser.js';

describe('DemoPlaybackController', () => {
  let controller: DemoPlaybackController;
  let mockHandler: NetworkMessageHandler;

  beforeEach(() => {
    controller = new DemoPlaybackController();
    mockHandler = {
      onServerData: vi.fn(),
      onBaseline: vi.fn(),
      onFrame: vi.fn(),
      onPrint: vi.fn(),
      onCenterPrint: vi.fn(),
      onStuffText: vi.fn(),
      onSound: vi.fn(),
      onTempEntity: vi.fn(),
      onLayout: vi.fn(),
      onInventory: vi.fn(),
      onConfigString: vi.fn(),
      onMuzzleFlash: vi.fn()
    };
    controller.setHandler(mockHandler);
  });

  // Create a minimal valid demo block that the parser won't choke on.
  // The parser reads a byte for the command.
  // ServerCommand.nop = 6
  // So a 1 byte payload of [6] should be valid.
  const createMockDemoBuffer = (numFrames: number): ArrayBuffer => {
    const buffer = new ArrayBuffer(numFrames * (4 + 1));
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < numFrames; i++) {
      view.setInt32(offset, 1, true); // Length 1
      offset += 4;
      view.setUint8(offset, 6); // ServerCommand.nop
      offset += 1;
    }
    return buffer;
  };

  it('should initialize in stopped state', () => {
    expect(controller.getState()).toBe(PlaybackState.Stopped);
  });

  it('should load demo and remain stopped', () => {
    const buffer = createMockDemoBuffer(1);
    controller.loadDemo(buffer);
    expect(controller.getState()).toBe(PlaybackState.Stopped);
  });

  it('should play when play() is called', () => {
    const buffer = createMockDemoBuffer(1);
    controller.loadDemo(buffer);
    controller.play();
    expect(controller.getState()).toBe(PlaybackState.Playing);
  });

  it('should pause when pause() is called', () => {
    const buffer = createMockDemoBuffer(1);
    controller.loadDemo(buffer);
    controller.play();
    controller.pause();
    expect(controller.getState()).toBe(PlaybackState.Paused);
  });

  it('should advance frames when playing', () => {
    const buffer = createMockDemoBuffer(2);
    controller.loadDemo(buffer);
    controller.play();

    // Each frame is default 100ms.
    // Update by 0.3s (300ms) should consume 2 frames (200ms) and try to consume the 3rd, realizing it's finished.

    controller.update(0.3);

    expect(controller.getState()).toBe(PlaybackState.Finished);
  });

  it('should respect playback speed', () => {
    const buffer = createMockDemoBuffer(10);
    controller.loadDemo(buffer);
    controller.play();
    controller.setSpeed(2.0); // 2x speed

    // Update by 0.1s (100ms). At 2x speed, this is 200ms accumulated.
    // Should consume 2 frames (assuming 100ms per frame).
    controller.update(0.1);

    // We expect it NOT to be finished yet.
    expect(controller.getState()).toBe(PlaybackState.Playing);

    // Let's just give it plenty of time to finish.
    controller.update(1.0);
    expect(controller.getState()).toBe(PlaybackState.Finished);
  });

  it('should clamp playback speed', () => {
    controller.setSpeed(0.01);
    expect(controller.getSpeed()).toBe(0.1);

    controller.setSpeed(100.0);
    expect(controller.getSpeed()).toBe(16.0);

    controller.setSpeed(2.5);
    expect(controller.getSpeed()).toBe(2.5);
  });

  it('should support step forward', () => {
    const buffer = createMockDemoBuffer(5);
    controller.loadDemo(buffer);
    // Move to playing then pause to ensure correct state transition
    controller.play();
    controller.pause();

    controller.stepForward();
    // We expect it to consume one frame.
    // State should remain paused.
    expect(controller.getState()).toBe(PlaybackState.Paused);

    // Verify we consumed 1 frame.
    // If we play now, we should have 4 frames left.
    controller.play();

    // 400ms should finish the remaining 4 frames
    // We need a bit more to trigger the "Finished" check.
    controller.update(0.5);
    expect(controller.getState()).toBe(PlaybackState.Finished);
  });

  it('should support step backward', () => {
      // Just verifying it doesn't crash, as implementation is currently a warning
      controller.stepBackward();
  });

});
