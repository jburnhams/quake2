import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoPlaybackController, PlaybackState } from '../../src/demo/playback.js';
import { NetworkMessageHandler, createEmptyEntityState, createEmptyProtocolPlayerState } from '../../src/demo/parser.js';

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
      onMuzzleFlash: vi.fn(),
      onSpawnBaseline: vi.fn(),
      // Mock optional methods
      getEntities: vi.fn().mockReturnValue(new Map()),
      getPlayerState: vi.fn().mockReturnValue(createEmptyProtocolPlayerState())
    };
    controller.setHandler(mockHandler);
  });

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

  it('should fire onPlaybackStateChange event', () => {
      const callback = vi.fn();
      controller.setCallbacks({ onPlaybackStateChange: callback });
      const buffer = createMockDemoBuffer(1);
      controller.loadDemo(buffer);

      controller.play();
      expect(callback).toHaveBeenCalledWith(PlaybackState.Playing);

      controller.pause();
      expect(callback).toHaveBeenCalledWith(PlaybackState.Paused);
  });

  it('should seek to specific frame', () => {
      const buffer = createMockDemoBuffer(10);
      controller.loadDemo(buffer);
      const onSeekComplete = vi.fn();
      controller.setCallbacks({ onSeekComplete });

      controller.seekToFrame(5);

      expect(controller.getCurrentFrame()).toBe(5);
      expect(onSeekComplete).toHaveBeenCalled();
  });

  it('should get frame data', () => {
      const buffer = createMockDemoBuffer(5);
      controller.loadDemo(buffer);

      const frameData = controller.getFrameData(2);
      expect(frameData).toBeDefined();
      expect(controller.getCurrentFrame()).toBe(2);
  });

  it('should get frame entities via handler', () => {
      const buffer = createMockDemoBuffer(5);
      controller.loadDemo(buffer);

      // Need to seek first so currentFrameIndex matches requested index for the optimization
      // Or rely on seek being called internally.
      // If we request frame 3, it seeks to 3.
      // `getEntities` optimization checks if `frameIndex === currentFrameIndex`.

      const entities = controller.getFrameEntities(3);

      // The optimization inside getFrameEntities checks `frameIndex === this.currentFrameIndex`.
      // Internal seek updates `currentFrameIndex` to 3.
      // So optimization should pass and `handler.getEntities` should be called.

      expect(mockHandler.getEntities).toHaveBeenCalled();
      expect(entities).toEqual([]); // Mock returns empty map
      expect(controller.getCurrentFrame()).toBe(3);
  });

  it('should get frame player state via handler', () => {
      const buffer = createMockDemoBuffer(5);
      controller.loadDemo(buffer);

      // Seek internal should work.
      // Note: `seek` implementation sets `currentFrameIndex` to `targetFrame`.
      // The optimization in `getFramePlayerState` is:
      // if (frameIndex === this.currentFrameIndex && this.handler?.getPlayerState)

      // But initially `currentFrameIndex` is -1.
      // So `getFramePlayerState(1)` calls `getFrameData(1)`.
      // `getFrameData(1)` calls `seek(1)`.
      // `seek(1)` sets `currentFrameIndex` to 1.
      // `getFrameData` returns `lastFrameData`.
      // `getFramePlayerState` returns `frame.playerState`.

      // Wait! `getFramePlayerState` calls `getFrameData` if the initial check FAILS.
      // So if I call `getFramePlayerState(1)` when at -1:
      // 1. check fails (-1 != 1)
      // 2. calls `getFrameData(1)` -> seeks -> returns frame
      // 3. returns frame.playerState.
      // So `mockHandler.getPlayerState` is NOT CALLED in this path!

      // To test the optimization (handler call), we must be AT the frame.
      controller.seekToFrame(1);

      const state = controller.getFramePlayerState(1);
      expect(mockHandler.getPlayerState).toHaveBeenCalled();
      expect(state).toBeDefined();
      expect(controller.getCurrentFrame()).toBe(1);
  });

});
