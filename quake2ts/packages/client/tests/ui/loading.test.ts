import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoadingScreen } from '../../src/ui/loading/screen.js';
import { Renderer } from '@quake2ts/engine';

describe('LoadingScreen', () => {
    let loadingScreen: LoadingScreen;
    let renderer: Renderer;

    beforeEach(() => {
        loadingScreen = new LoadingScreen();
        renderer = {
            width: 800,
            height: 600,
            drawfillRect: vi.fn(),
            drawCenterString: vi.fn(),
        } as unknown as Renderer;
    });

    it('should not render initially', () => {
        loadingScreen.render(renderer);
        expect(renderer.drawfillRect).not.toHaveBeenCalled();
    });

    it('should render when started', () => {
        loadingScreen.start(100, 'Loading...');
        loadingScreen.render(renderer);
        expect(renderer.drawfillRect).toHaveBeenCalled();
        expect(renderer.drawCenterString).toHaveBeenCalledWith(expect.any(Number), 'Loading...');
    });

    it('should update progress', () => {
        loadingScreen.start(100);
        loadingScreen.update(50);
        loadingScreen.render(renderer);

        // Check for 50% text (implied by drawCenterString logic)
        expect(renderer.drawCenterString).toHaveBeenCalledWith(expect.any(Number), '50%');
    });

    it('should stop rendering after finish', () => {
        loadingScreen.start(100);
        loadingScreen.finish();
        // Clear mocks from start/render calls if any
        vi.clearAllMocks();

        loadingScreen.render(renderer);
        expect(renderer.drawfillRect).not.toHaveBeenCalled();
    });
});
