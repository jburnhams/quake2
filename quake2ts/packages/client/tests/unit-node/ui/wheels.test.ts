import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WheelMenuSystem } from '@quake2ts/client/ui/wheels/index.js';
import { Renderer } from '@quake2ts/engine';

describe('WheelMenuSystem', () => {
    let wheelSystem: WheelMenuSystem;
    let renderer: Renderer;

    beforeEach(() => {
        wheelSystem = new WheelMenuSystem();
        renderer = {
            drawfillRect: vi.fn(),
            drawCenterString: vi.fn(),
        } as unknown as Renderer;
    });

    it('should initially be closed', () => {
        expect(wheelSystem.isOpen()).toBe(false);
    });

    it('should open and close', () => {
        wheelSystem.open('weapon');
        expect(wheelSystem.isOpen()).toBe(true);

        wheelSystem.close();
        expect(wheelSystem.isOpen()).toBe(false);
    });

    it('should render when active', () => {
        wheelSystem.open('weapon');
        wheelSystem.render(renderer, 800, 600, {} as any);
        expect(renderer.drawfillRect).toHaveBeenCalled();
        expect(renderer.drawCenterString).toHaveBeenCalled();
    });

    it('should not render when inactive', () => {
        wheelSystem.render(renderer, 800, 600, {} as any);
        expect(renderer.drawfillRect).not.toHaveBeenCalled();
    });
});
