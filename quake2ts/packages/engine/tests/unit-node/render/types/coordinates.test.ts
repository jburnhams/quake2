import { describe, test, expect } from 'vitest';
import { CoordinateSystem, type CoordinateConvention } from '../../../../src/render/types/coordinates.js';

describe('Coordinate Systems', () => {
  test('CoordinateSystem enum values are correct', () => {
    expect(CoordinateSystem.QUAKE).toBe('quake');
    expect(CoordinateSystem.OPENGL).toBe('opengl');
    expect(CoordinateSystem.WEBGPU).toBe('webgpu');
  });

  test('CoordinateConvention type allows valid configurations', () => {
    const quake: CoordinateConvention = {
      system: CoordinateSystem.QUAKE,
      handedness: 'right',
      forward: '+X',
      up: '+Z',
      ndcDepthRange: [0, 0] // Not applicable for Quake space, but type safe
    };

    const webgpu: CoordinateConvention = {
      system: CoordinateSystem.WEBGPU,
      handedness: 'left',
      forward: '+Z',
      up: '+Y',
      ndcDepthRange: [0, 1]
    };

    expect(quake.system).toBe(CoordinateSystem.QUAKE);
    expect(webgpu.system).toBe(CoordinateSystem.WEBGPU);
  });
});
