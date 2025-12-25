import { describe, it, expect, beforeAll, vi } from 'vitest';
import { setupBrowserEnvironment } from '../../../src/setup/browser';
import { createInputInjector, InputInjector, createMockPointerLock } from '../../../src/client/mocks/input';

describe('Input API Substitutes', () => {
  let injector: InputInjector;

  beforeAll(() => {
    setupBrowserEnvironment({
        url: 'http://localhost:3000/',
        pretendToBeVisual: true,
        resources: 'usable',
        enableWebGL2: true,
        enablePointerLock: true
    });
    injector = createInputInjector(document);
  });

  it('should support pointer lock simulation', () => {
    const canvas = document.createElement('canvas');
    const lockListener = vi.fn();
    document.addEventListener('pointerlockchange', lockListener);

    expect(document.pointerLockElement).toBeNull();

    // Ensure the mock Pointer Lock is set up
    const mockLock = createMockPointerLock();

    // Request lock
    mockLock.request(canvas);
    expect(document.pointerLockElement).toBe(canvas);
    expect(lockListener).toHaveBeenCalledTimes(1);

    // Exit lock
    mockLock.exit();
    expect(document.pointerLockElement).toBeNull();
    expect(lockListener).toHaveBeenCalledTimes(2);
  });

  it('should dispatch keyboard events via injector', () => {
    const keyListener = vi.fn();
    window.addEventListener('keydown', keyListener);

    injector.keyDown('Space', 'Space');

    expect(keyListener).toHaveBeenCalled();
    const event = keyListener.mock.calls[0][0] as KeyboardEvent;
    expect(event.key).toBe('Space');
    expect(event.code).toBe('Space');
    expect(event.type).toBe('keydown');
  });

  it('should dispatch mouse movement events', () => {
    const moveListener = vi.fn();
    document.addEventListener('mousemove', moveListener);

    injector.mouseMove(10, 20);

    expect(moveListener).toHaveBeenCalled();
    const event = moveListener.mock.calls[0][0] as MouseEvent;
    expect(event.movementX).toBe(10);
    expect(event.movementY).toBe(20);
  });

  it('should route events to pointer lock element if locked', () => {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const canvasListener = vi.fn();
    const docListener = vi.fn();

    canvas.addEventListener('mousedown', canvasListener);
    document.addEventListener('mousedown', docListener);

    // Without lock
    injector.mouseDown(0);
    // document listener fires because event bubbles from document (default target when no lock)
    // Wait, injector uses doc as target if no lock.
    expect(docListener).toHaveBeenCalledTimes(1);
    expect(canvasListener).not.toHaveBeenCalled();

    // With lock
    const mockLock = createMockPointerLock();
    mockLock.request(canvas);
    injector.mouseDown(0);

    expect(canvasListener).toHaveBeenCalledTimes(1);
    // Bubbles to document
    expect(docListener).toHaveBeenCalledTimes(2);

    mockLock.exit();
  });
});
