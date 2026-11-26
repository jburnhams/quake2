import { describe, it, expect } from 'vitest';
import { BspBuilder } from '../../../src/builder/BspBuilder.js';
import { box, hollowBox } from '../../../src/builder/primitives.js';
import { BspCompiler } from '../../../src/compiler/BspCompiler.js';
import { Vec3 } from '@quake2ts/shared';

describe('BspCompiler Integration - Lighting Styles', () => {
  it('should compile a map and compute multiple light styles correctly', () => {
    const builder = new BspBuilder();

    // Small room
    const roomBrushes = hollowBox({
      origin: {x: 0, y: 0, z: 0} as Vec3,
      size: {x: 256, y: 256, z: 256} as Vec3,
      wallThickness: 16,
      texture: 'test_wall'
    });

    roomBrushes.forEach(b => builder.addBrush(b));

    // A white point light (default style 0)
    builder.addEntity({
        classname: 'light',
        properties: {
            origin: '-64 0 0',
            light: '3000',
            _color: '1 1 1'
            // No style means 0
        }
    });

    // A red point light with a specific style (e.g. style 11 - pulsate)
    builder.addEntity({
        classname: 'light',
        properties: {
            origin: '64 0 0',
            light: '3000',
            _color: '1 0 0',
            _style: '11'
        }
    });

    const brushes = (builder as any).brushes;
    const entities = [{ classname: 'worldspawn', properties: new Map() }, ...(builder as any).entities];

    // Compile with fast lighting to trigger direct light style packing
    const compiler = new BspCompiler({ fastLighting: true });

    const result = compiler.compile(brushes, entities);
    const bsp = result.bsp;

    // Output should have multiple lightmaps.
    // Faces facing the center should be lit by both lights, meaning they will get 2 light styles.
    expect(bsp.lightMaps.length).toBeGreaterThan(0);

    let hasMultiStyleFace = false;
    for (const face of bsp.faces) {
        if (face.lightOffset >= 0) {
            // style array should be e.g. [0, 11, 255, 255]
            const s = face.styles;
            if (s[0] !== 255 && s[1] !== 255) {
                expect(s[0]).toBe(0);
                expect(s[1]).toBe(11);
                hasMultiStyleFace = true;
            }
        }
    }

    // Make sure we actually generated multi-style faces
    expect(hasMultiStyleFace).toBe(true);
  });
});
