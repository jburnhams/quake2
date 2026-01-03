import { describe, test, expect, vi } from 'vitest';
import { createNullRenderer } from '../../../../../test-utils/src/engine/renderers.js';
import { Camera } from '../../../../src/render/camera.js';
import { DebugMode } from '../../../../src/render/debugMode.js';
import type { Md2Model } from '../../../../src/assets/md2.js';
import type { InstanceData } from '../../../../src/render/instancing.js';

describe('NullRenderer', () => {
  test('logs renderFrame calls', () => {
    const renderer = createNullRenderer();
    const camera = new Camera();

    renderer.renderFrame({ camera }, []);

    expect(renderer.getCallLog()[0]).toContain('renderFrame');
    expect(renderer.getFrameCount()).toBe(1);
  });

  test('logs 2D drawing calls', () => {
    const renderer = createNullRenderer();

    renderer.begin2D();
    renderer.drawString(10, 20, "Test");
    renderer.drawCenterString(30, "Center");
    renderer.drawfillRect(0, 0, 100, 100, [1, 1, 1, 1]);
    renderer.end2D();

    const log = renderer.getCallLog();
    expect(log).toContain('begin2D()');
    expect(log).toContain('drawString(10, 20, "Test")');
    expect(log).toContain('drawCenterString(30, "Center")');
    expect(log).toContain('drawfillRect(0, 0, 100, 100)');
    expect(log).toContain('end2D()');
  });

  test('logs asset registration', async () => {
    const renderer = createNullRenderer();
    const pic = await renderer.registerPic('test.pcx', new ArrayBuffer(10));

    expect(renderer.getCallLog()).toContain('registerPic(test.pcx)');
    expect(pic).toEqual({ width: 256, height: 256 });

    const texPic = renderer.registerTexture('tex', { width: 32, height: 32 });
    expect(renderer.getCallLog()).toContain('registerTexture(tex)');
    expect(texPic).toEqual({ width: 32, height: 32 });
  });

  test('logs drawPic calls', () => {
    const renderer = createNullRenderer();
    const pic = { width: 10, height: 10, texture: null };

    renderer.drawPic(50, 60, pic);
    expect(renderer.getCallLog()).toContain('drawPic(50, 60)');
  });

  test('handles dispose', () => {
    const renderer = createNullRenderer();
    renderer.dispose();
    expect(renderer.getCallLog()).toContain('dispose()');
  });

  test('provides dummy performance report', () => {
    const renderer = createNullRenderer();
    const report = renderer.getPerformanceReport();

    expect(report).toBeDefined();
    expect(report.frameTimeMs).toBe(0);
    expect(report.drawCalls).toBe(0);
  });

  test('provides dummy memory usage', () => {
    const renderer = createNullRenderer();
    const memory = renderer.getMemoryUsage();

    expect(memory).toBeDefined();
    expect(memory.totalBytes).toBe(0);
  });

  test('resetCallLog clears logs', () => {
    const renderer = createNullRenderer();
    renderer.begin2D();
    expect(renderer.getCallLog().length).toBeGreaterThan(0);

    renderer.resetCallLog();
    expect(renderer.getCallLog().length).toBe(0);
  });
});
