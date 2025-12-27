import { describe, test, expect } from 'vitest';
import { CoordinateSystem } from '../../../src/render/types/coordinates.js';

describe('CoordinateSystem', () => {
  test('defines correct system constants', () => {
    expect(CoordinateSystem.QUAKE).toBe('quake');
    expect(CoordinateSystem.OPENGL).toBe('opengl');
    expect(CoordinateSystem.WEBGPU).toBe('webgpu');
  });
});
