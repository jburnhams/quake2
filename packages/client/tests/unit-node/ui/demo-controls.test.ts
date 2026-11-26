import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoControls } from '@quake2ts/client/ui/demo-controls.js';
import { DemoPlaybackController, PlaybackState, Renderer } from '@quake2ts/engine';
import { createMockRenderer } from '@quake2ts/test-utils';

describe('DemoControls', () => {
  let controls: DemoControls;
  let mockPlayback: DemoPlaybackController;
  let mockRenderer: Renderer;

  beforeEach(() => {
    mockPlayback = new DemoPlaybackController();
    // Mock methods we use
    mockPlayback.getState = vi.fn().mockReturnValue(PlaybackState.Playing);
    mockPlayback.play = vi.fn();
    mockPlayback.pause = vi.fn();
    mockPlayback.stop = vi.fn();
    mockPlayback.setSpeed = vi.fn();
    mockPlayback.getSpeed = vi.fn().mockReturnValue(1.0);
    mockPlayback.stepForward = vi.fn();
    mockPlayback.stepBackward = vi.fn();
    mockPlayback.getCurrentTime = vi.fn().mockReturnValue(65000); // 1:05

    mockRenderer = createMockRenderer({
        width: 800,
        height: 600
    });

    controls = new DemoControls(mockPlayback);
  });

  it('renders controls overlay with time and timeline', () => {
    controls.render(mockRenderer, 800, 600);
    expect(mockRenderer.drawfillRect).toHaveBeenCalledWith(0, 540, 800, 60, expect.any(Array));
    expect(mockRenderer.drawString).toHaveBeenCalledWith(20, expect.any(Number), 'PAUSE');
    expect(mockRenderer.drawCenterString).toHaveBeenCalledWith(expect.any(Number), 'Speed: 1x');

    // Check for time string (65000ms = 01:05)
    expect(mockRenderer.drawString).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), expect.stringContaining('01:05'));

    // Check for timeline bars
    // Background bar
    expect(mockRenderer.drawfillRect).toHaveBeenCalledWith(20, 545, 760, 4, expect.any(Array));
    // Marker (red)
    expect(mockRenderer.drawfillRect).toHaveBeenCalledWith(expect.any(Number), 543, 4, 8, [1.0, 0.0, 0.0, 1.0]);
  });

  it('toggles play/pause on Space', () => {
    // Initially Playing
    controls.handleInput(' ', true);
    expect(mockPlayback.pause).toHaveBeenCalled();

    // Now Paused
    mockPlayback.getState = vi.fn().mockReturnValue(PlaybackState.Paused);
    controls.handleInput(' ', true);
    expect(mockPlayback.play).toHaveBeenCalled();
  });

  it('stops playback on Escape', () => {
    controls.handleInput('escape', true);
    expect(mockPlayback.stop).toHaveBeenCalled();
  });

  it('adjusts speed on brackets', () => {
    // Decrease speed
    controls.handleInput('[', true);
    expect(mockPlayback.setSpeed).toHaveBeenCalledWith(0.5);

    // Increase speed
    mockPlayback.getSpeed = vi.fn().mockReturnValue(0.5);
    controls.handleInput(']', true);
    expect(mockPlayback.setSpeed).toHaveBeenCalledWith(1.0);
  });

  it('steps forward/backward on arrows', () => {
      controls.handleInput('ArrowRight', true);
      expect(mockPlayback.stepForward).toHaveBeenCalled();

      controls.handleInput('ArrowLeft', true);
      expect(mockPlayback.stepBackward).toHaveBeenCalled();
  });
});
