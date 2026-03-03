
import { describe, it, expect, beforeAll } from 'vitest';
import { setupBrowserEnvironment } from '@quake2ts/test-utils';

describe('Unit Test with Browser Setup', () => {
  beforeAll(() => {
    setupBrowserEnvironment({
      enableWebGL2: true,
      enablePointerLock: true
    });
  });

  it('should have access to window and document', () => {
    expect(window).toBeDefined();
    expect(document).toBeDefined();
  });

  it('should have mock WebGL2 context', () => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    expect(gl).not.toBeNull();
    expect(gl?.createShader).toBeDefined();
  });

  it('should simulate pointer lock', () => {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    canvas.requestPointerLock();
    expect(document.pointerLockElement).toBe(canvas);
    document.exitPointerLock();
    expect(document.pointerLockElement).toBeNull();
  });
});
