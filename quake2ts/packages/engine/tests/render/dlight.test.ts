import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DynamicLightManager, DLight } from '../../src/render/dlight.js';

describe('DynamicLightManager', () => {
  let manager: DynamicLightManager;

  beforeEach(() => {
    manager = new DynamicLightManager();
  });

  it('should add a new light', () => {
    const light: DLight = {
      origin: { x: 0, y: 0, z: 0 },
      color: { x: 1, y: 1, z: 1 },
      intensity: 200,
      die: 10
    };
    manager.addLight(light, 0);
    expect(manager.getActiveLights()).toHaveLength(1);
    expect(manager.getActiveLights()[0]).toBe(light);
  });

  it('should update an existing light with the same key', () => {
    const light1: DLight = {
      key: 1,
      origin: { x: 0, y: 0, z: 0 },
      color: { x: 1, y: 1, z: 1 },
      intensity: 200,
      die: 10
    };
    const light2: DLight = {
      key: 1,
      origin: { x: 10, y: 10, z: 10 },
      color: { x: 0, y: 0, z: 1 },
      intensity: 300,
      die: 12
    };

    manager.addLight(light1, 0);
    expect(manager.getActiveLights()).toHaveLength(1);
    expect(manager.getActiveLights()[0]).toBe(light1);

    manager.addLight(light2, 5);
    expect(manager.getActiveLights()).toHaveLength(1);
    expect(manager.getActiveLights()[0]).toBe(light2);
    expect(manager.getActiveLights()[0].intensity).toBe(300);
  });

  it('should treat lights without keys as separate', () => {
    const light1: DLight = {
      origin: { x: 0, y: 0, z: 0 },
      color: { x: 1, y: 1, z: 1 },
      intensity: 200,
      die: 10
    };
    const light2: DLight = {
      origin: { x: 10, y: 10, z: 10 },
      color: { x: 0, y: 0, z: 1 },
      intensity: 300,
      die: 12
    };

    manager.addLight(light1, 0);
    manager.addLight(light2, 0);
    expect(manager.getActiveLights()).toHaveLength(2);
  });

  it('should remove expired lights on update', () => {
    const light1: DLight = {
      origin: { x: 0, y: 0, z: 0 },
      color: { x: 1, y: 1, z: 1 },
      intensity: 200,
      die: 10
    };
    const light2: DLight = {
      origin: { x: 0, y: 0, z: 0 },
      color: { x: 1, y: 1, z: 1 },
      intensity: 200,
      die: 20
    };

    manager.addLight(light1, 0);
    manager.addLight(light2, 0);

    manager.update(5);
    expect(manager.getActiveLights()).toHaveLength(2);

    manager.update(15);
    expect(manager.getActiveLights()).toHaveLength(1);
    expect(manager.getActiveLights()[0]).toBe(light2);

    manager.update(25);
    expect(manager.getActiveLights()).toHaveLength(0);
  });

  it('should clear all lights', () => {
    const light: DLight = {
      origin: { x: 0, y: 0, z: 0 },
      color: { x: 1, y: 1, z: 1 },
      intensity: 200,
      die: 10
    };
    manager.addLight(light, 0);
    manager.clear();
    expect(manager.getActiveLights()).toHaveLength(0);
  });
});
