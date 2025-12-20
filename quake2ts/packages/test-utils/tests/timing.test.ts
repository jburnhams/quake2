
import { describe, it, expect, vi } from 'vitest';
import {
    createControlledTimer,
    createMockRAF,
    simulateFramesWithMock
} from '../src/index';

// Expose vi to global for the helper to pick it up if needed
// verify environment.
if (typeof global !== 'undefined') {
    (global as any).vi = vi;
}

describe('createMockRAF', () => {
    it('should control time and execute callbacks', () => {
        const mockRAF = createMockRAF();
        const callback = vi.fn();

        mockRAF.enable();
        requestAnimationFrame(callback);
        mockRAF.tick(100);

        expect(callback).toHaveBeenCalledWith(100);
        mockRAF.disable();
    });

    it('should simulate frames', () => {
        const mockRAF = createMockRAF();
        let frameCount = 0;
        const callback = () => frameCount++;

        simulateFramesWithMock(mockRAF, 5, 16.6, callback);
        expect(frameCount).toBe(5);
    });
});

describe('createControlledTimer', () => {
    it('should control setTimeout', () => {
        const timer = createControlledTimer();
        const callback = vi.fn();

        setTimeout(callback, 50);
        expect(callback).not.toHaveBeenCalled();
        timer.advanceBy(50);
        expect(callback).toHaveBeenCalled();

        timer.restore();
    });

    it('should control setInterval', () => {
        const timer = createControlledTimer();
        const callback = vi.fn();

        setInterval(callback, 100);
        timer.advanceBy(100);
        expect(callback).toHaveBeenCalledTimes(1);
        timer.advanceBy(100);
        expect(callback).toHaveBeenCalledTimes(2);

        clearInterval(undefined as any); // Cleanup
        timer.restore();
    });
});
