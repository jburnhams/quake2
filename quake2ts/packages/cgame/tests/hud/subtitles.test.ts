import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubtitleSystem } from '../../src/hud/subtitles.js';
import { CGameImport } from '../../src/types.js';

const mockCgi = {
  SCR_DrawCenterString: vi.fn(),
  CL_ClientTime: vi.fn(),
} as unknown as CGameImport;

describe('SubtitleSystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not draw anything if there are no subtitles', () => {
    const system = new SubtitleSystem();
    system.drawSubtitles(mockCgi, 0);
    expect(mockCgi.SCR_DrawCenterString).not.toHaveBeenCalled();
  });

  it('should add and draw a subtitle', () => {
    const system = new SubtitleSystem();
    system.addSubtitle('Hello, world!', 1000);
    system.drawSubtitles(mockCgi, 1500);
    // 200 is the hardcoded Y currently
    expect(mockCgi.SCR_DrawCenterString).toHaveBeenCalledWith(200, 'Hello, world!');
  });

  it('should not draw an expired subtitle', () => {
    const system = new SubtitleSystem();
    system.addSubtitle('Fading away...', 1000);
    // SUBTITLE_DURATION is 3000ms, so at time 4001 it should be expired.
    system.drawSubtitles(mockCgi, 4001);
    expect(mockCgi.SCR_DrawCenterString).not.toHaveBeenCalled();
  });

  it('should replace an existing subtitle with a new one', () => {
    const system = new SubtitleSystem();
    system.addSubtitle('First message', 1000);
    system.drawSubtitles(mockCgi, 1100);
    expect(mockCgi.SCR_DrawCenterString).toHaveBeenCalledWith(200, 'First message');

    system.addSubtitle('Second message', 1200);
    system.drawSubtitles(mockCgi, 1300);
    expect(mockCgi.SCR_DrawCenterString).toHaveBeenCalledWith(200, 'Second message');
    expect(mockCgi.SCR_DrawCenterString).toHaveBeenCalledTimes(2);
  });
});
