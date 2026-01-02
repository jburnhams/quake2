import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageSystem } from '@quake2ts/client/hud/messages.js';
import { Renderer } from '@quake2ts/engine';
import { getHudLayout } from '@quake2ts/client/hud/layout.js';

describe('MessageSystem', () => {
  let mockRenderer: Renderer;
  let messageSystem: MessageSystem;

  beforeEach(() => {
    mockRenderer = {
      width: 640,
      height: 480,
      drawString: vi.fn(),
      drawCenterString: vi.fn(),
      drawPic: vi.fn(),
      renderFrame: vi.fn(),
      registerPic: vi.fn(),
      begin2D: vi.fn(),
      end2D: vi.fn(),
      drawfillRect: vi.fn(),
    } as unknown as Renderer;

    messageSystem = new MessageSystem();
  });

  it('should draw center print message', () => {
    const now = 1000;
    const layout = getHudLayout(640, 480);
    messageSystem.addCenterPrint("Test Message", now);

    messageSystem.drawCenterPrint(mockRenderer, now + 100, layout);

    expect(mockRenderer.drawCenterString).toHaveBeenCalledWith(expect.any(Number), "Test Message");
  });

  it('should not draw expired center print message', () => {
    const now = 1000;
    const layout = getHudLayout(640, 480);
    messageSystem.addCenterPrint("Test Message", now);

    messageSystem.drawCenterPrint(mockRenderer, now + 4000, layout); // Duration is 3000

    expect(mockRenderer.drawCenterString).not.toHaveBeenCalled();
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
