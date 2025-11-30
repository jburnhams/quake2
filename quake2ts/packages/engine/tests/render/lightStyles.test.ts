import { describe, it, expect } from 'vitest';
import { LightStyleManager } from '../../src/render/lightStyles.js';

describe('LightStyleManager', () => {
  it('should initialize with defaults', () => {
    const manager = new LightStyleManager();
    manager.update(0);
    const values = manager.getValues();

    // Style 0 is 'm' -> 1.0
    expect(values[0]).toBeCloseTo(1.0);
  });

  it('should animate styles over time', () => {
    const manager = new LightStyleManager();
    // Style 1: "mmn..."
    // t=0: 'm' -> 1.0
    manager.update(0);
    expect(manager.getValues()[1]).toBeCloseTo(1.0);

    // t=0.1: 'm' -> 1.0
    manager.update(0.15); // frame 1
    expect(manager.getValues()[1]).toBeCloseTo(1.0);

    // t=0.2: 'n' -> 13/12 ~= 1.083
    manager.update(0.25); // frame 2
    expect(manager.getValues()[1]).toBeCloseTo(13/12);
  });

  it('should handle custom styles', () => {
    const manager = new LightStyleManager();
    manager.setStyle(32, 'az'); // 0 -> 2.083

    manager.update(0);
    expect(manager.getValues()[32]).toBe(0); // 'a' -> 0

    manager.update(0.1);
    expect(manager.getValues()[32]).toBeCloseTo(25/12); // 'z' -> 25/12
  });
});
