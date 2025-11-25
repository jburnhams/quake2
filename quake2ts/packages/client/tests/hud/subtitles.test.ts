import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubtitleSystem } from '../../src/hud/subtitles.js';
import { Renderer } from '@quake2ts/engine';

const mockRenderer = {
  drawCenterString: vi.fn(),
  height: 480,
} as unknown as Renderer;

describe('SubtitleSystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not draw anything if there are no subtitles', () => {
    const system = new SubtitleSystem();
    system.drawSubtitles(mockRenderer, 0);
    expect(mockRenderer.drawCenterString).not.toHaveBeenCalled();
  });

  it('should add and draw a subtitle', () => {
    const system = new SubtitleSystem();
    system.addSubtitle('Hello, world!', 1000);
    system.drawSubtitles(mockRenderer, 1500);
    expect(mockRenderer.drawCenterString).toHaveBeenCalledWith(440, 'Hello, world!');
  });

  it('should not draw an expired subtitle', () => {
    const system = new SubtitleSystem();
    system.addSubtitle('Fading away...', 1000);
    // SUBTITLE_DURATION is 3000ms, so at time 4001 it should be expired.
    system.drawSubtitles(mockRenderer, 4001);
    expect(mockRenderer.drawCenterString).not.toHaveBeenCalled();
  });

  it('should replace an existing subtitle with a new one', () => {
    const system = new SubtitleSystem();
    system.addSubtitle('First message', 1000);
    system.drawSubtitles(mockRenderer, 1100);
    expect(mockRenderer.drawCenterString).toHaveBeenCalledWith(440, 'First message');

    system.addSubtitle('Second message', 1200);
    system.drawSubtitles(mockRenderer, 1300);
    expect(mockRenderer.drawCenterString).toHaveBeenCalledWith(440, 'Second message');
    expect(mockRenderer.drawCenterString).toHaveBeenCalledTimes(2);
  });
});
