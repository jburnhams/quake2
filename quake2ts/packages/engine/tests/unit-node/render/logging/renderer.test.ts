import { describe, test, expect, vi } from 'vitest';
import { createLoggingRenderer } from '../../../../../test-utils/src/engine/renderers.js';
import { CoordinateSystem } from '../../../../src/render/types/coordinates.js';
import { Camera } from '../../../../src/render/camera.js';
import { mat4, vec3 } from 'gl-matrix';

describe('LoggingRenderer', () => {
  test('validates coordinate transforms (WebGPU)', () => {
    const renderer = createLoggingRenderer(CoordinateSystem.WEBGPU, {
      validateTransforms: true,
      verbose: false
    });

    const camera = new Camera();
    camera.setPosition(100, 200, 50);

    renderer.renderFrame({
      camera,
      cameraState: camera.toState()
    }, []);

    const logs = renderer.getLogs();
    expect(logs.some(log => log.includes('Transform Validation'))).toBe(true);
    expect(logs.some(log => log.includes('Expected WebGPU transform'))).toBe(true);
  });

  test('validates coordinate transforms (OpenGL)', () => {
    const renderer = createLoggingRenderer(CoordinateSystem.OPENGL, {
      validateTransforms: true,
      verbose: false
    });

    const camera = new Camera();
    renderer.renderFrame({ camera, cameraState: camera.toState() }, []);

    const logs = renderer.getLogs();
    expect(logs.some(log => log.includes('Expected GL transform'))).toBe(true);
  });

  test('verbose mode logs matrices', () => {
    const renderer = createLoggingRenderer(CoordinateSystem.QUAKE, {
      verbose: true
    });

    const camera = new Camera();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    renderer.renderFrame({ camera, cameraState: camera.toState() }, []);

    const logs = renderer.getLogs();
    expect(logs.some(log => log.includes('View Matrix'))).toBe(true);

    spy.mockRestore();
  });

  test('logs entity count', () => {
    const renderer = createLoggingRenderer(CoordinateSystem.QUAKE, { verbose: false });
    const camera = new Camera();
    const entities = [{ type: 'test', model: null }] as any;

    renderer.renderFrame({ camera, cameraState: camera.toState() }, entities);

    const logs = renderer.getLogs();
    expect(logs).toContain('Entities: 1');
  });

  test('logs asset operations', async () => {
    const renderer = createLoggingRenderer();
    await renderer.registerPic('test.jpg', new ArrayBuffer(0));

    const logs = renderer.getLogs();
    expect(logs.some(log => log.includes('registerPic'))).toBe(true);
  });

  test('logs 2D operations', () => {
    const renderer = createLoggingRenderer();
    renderer.begin2D();
    renderer.drawString(0, 0, "Test");
    renderer.end2D();

    const logs = renderer.getLogs();
    expect(logs).toContain('begin2D()');
    expect(logs.some(log => log.includes('drawString'))).toBe(true);
  });

  test('resetLogs clears history', () => {
    const renderer = createLoggingRenderer();
    renderer.log('test'); // Private method, but accessed via public side effect methods usually
    renderer.begin2D();

    expect(renderer.getLogs().length).toBeGreaterThan(0);
    renderer.resetLogs();
    expect(renderer.getLogs().length).toBe(0);
  });

  test('formats vectors correctly', () => {
    const renderer = createLoggingRenderer();
    const camera = new Camera();
    camera.setPosition(10.5, 20.123, 30);

    renderer.renderFrame({ camera, cameraState: camera.toState() }, []);

    const logs = renderer.getLogs();
    // Check for [10.50, 20.12, 30.00] formatting
    expect(logs.some(l => l.includes('Position: [10.50, 20.12, 30.00]'))).toBe(true);
  });
});
