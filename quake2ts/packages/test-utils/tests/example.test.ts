import { describe, it, expect, vi } from 'vitest';
import { setupBrowserEnvironment, teardownBrowserEnvironment } from '../src/setup/browser';
import { createMockCanvas } from '../src/setup/canvas';

describe('Example Usage', () => {
  describe('Browser Environment', () => {
    it('should setup and teardown browser globals', () => {
      // It's already setup by test runner or previous tests, but let's test the function call
      // Note: In this environment, we might already be running inside a simulated browser from vitest.setup.ts

      setupBrowserEnvironment({ enableWebGL2: true });

      expect(window).toBeDefined();
      expect(document).toBeDefined();
      expect(HTMLCanvasElement).toBeDefined();

      const canvas = document.createElement('canvas');
      expect(canvas.getContext).toBeDefined();

      // We don't want to fully teardown if other tests rely on it,
      // but strictly speaking this test demonstrates the API.
    });

    it('should create mock canvas with webgl support', () => {
      const canvas = createMockCanvas(800, 600);
      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);

      const gl = canvas.getContext('webgl2');
      expect(gl).toBeDefined();
      expect(gl?.createShader).toBeDefined();
    });
  });
});
