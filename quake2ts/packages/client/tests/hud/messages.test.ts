import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageSystem } from '../../src/hud/messages.js';
import { Renderer } from '@quake2ts/engine';

describe('MessageSystem', () => {
  let mockRenderer: Renderer;
  let messageSystem: MessageSystem;

  beforeEach(() => {
    mockRenderer = {
      width: 640,
      height: 480,
      drawString: vi.fn(),
      drawPic: vi.fn(),
      renderFrame: vi.fn(),
      registerPic: vi.fn(),
      begin2D: vi.fn(),
      end2D: vi.fn(),
      drawfillRect: vi.fn(),
    };

    messageSystem = new MessageSystem();
  });

  it('should draw center print message', () => {
    const now = 1000;
    messageSystem.addCenterPrint("Test Message", now);

    messageSystem.drawCenterPrint(mockRenderer, now + 100);

    expect(mockRenderer.drawString).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), "Test Message");
  });

  it('should not draw expired center print message', () => {
    const now = 1000;
    messageSystem.addCenterPrint("Test Message", now);

    messageSystem.drawCenterPrint(mockRenderer, now + 4000); // Duration is 3000

    expect(mockRenderer.drawString).not.toHaveBeenCalled();
  });

  it('should draw notifications', () => {
    const now = 1000;
    messageSystem.addNotify("Notify 1", now);
    messageSystem.addNotify("Notify 2", now);

    messageSystem.drawNotifications(mockRenderer, now + 100);

    expect(mockRenderer.drawString).toHaveBeenCalledTimes(2);
    expect(mockRenderer.drawString).toHaveBeenCalledWith(10, 10, "Notify 1");
    expect(mockRenderer.drawString).toHaveBeenCalledWith(10, 20, "Notify 2");
  });
});
