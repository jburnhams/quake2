import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageSystem } from '../../../src/hud/messages.js';
import type { CGameImport } from '../../../src/types.js';

describe('MessageSystem', () => {
  let messageSystem: MessageSystem;
  let mockCgi: CGameImport;

  beforeEach(() => {
    messageSystem = new MessageSystem();
    mockCgi = {
      SCR_DrawFontString: vi.fn(),
      SCR_FontLineHeight: vi.fn().mockReturnValue(12), // Mocking a specific line height
    } as unknown as CGameImport;
  });

  it('should use SCR_FontLineHeight for line spacing in drawNotifications', () => {
    const now = 1000;
    messageSystem.addNotify('Message 1', now);
    messageSystem.addNotify('Message 2', now);

    messageSystem.drawNotifications(mockCgi, now);

    expect(mockCgi.SCR_FontLineHeight).toHaveBeenCalled();

    // First message should be at y = 10
    expect(mockCgi.SCR_DrawFontString).toHaveBeenCalledWith(10, 10, 'Message 1');

    // Second message should be at y = 10 + 12 = 22
    expect(mockCgi.SCR_DrawFontString).toHaveBeenCalledWith(10, 22, 'Message 2');
  });

  it('should respect the configured line height', () => {
    const now = 1000;
    mockCgi.SCR_FontLineHeight = vi.fn().mockReturnValue(20); // Different height

    messageSystem.addNotify('Message 1', now);
    messageSystem.addNotify('Message 2', now);

    messageSystem.drawNotifications(mockCgi, now);

    expect(mockCgi.SCR_DrawFontString).toHaveBeenCalledWith(10, 10, 'Message 1');
    expect(mockCgi.SCR_DrawFontString).toHaveBeenCalledWith(10, 30, 'Message 2');
  });
});
