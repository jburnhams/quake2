import { describe, it, expect } from 'vitest';
import { BspBuilder } from '../../../src/builder/BspBuilder.js';
import { box, hollowBox } from '../../../src/builder/primitives.js';
import { BspCompiler } from '../../../src/compiler/BspCompiler.js';
import { BspWriter } from '../../../src/output/bspWriter.js';
import { Vec3 } from '@quake2ts/shared';

// We import the engine's bsp parsing directly
import { parseBsp } from '@quake2ts/engine';

describe('BspCompiler & Engine Integration', () => {
  it('should compile a map and allow the engine to successfully parse the resulting binary BSP', () => {
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
            origin: '0 0 0',
            light: '3000',
            _color: '1 1 1'
        }
    });

    const brushes = builder.getBrushes();
    const entities = [{ classname: 'worldspawn', properties: builder.getWorldspawnProps() }, ...builder.getEntities()];

    // Compile
    const compiler = new BspCompiler({ fastLighting: true });
    const result = compiler.compile(brushes, entities);
    const compiledBsp = result.bsp;

    expect(compiledBsp.lightMaps.length).toBeGreaterThan(0);

    // Serialize to binary
    const binaryData = BspWriter.write(compiledBsp);

    // Convert Uint8Array to ArrayBuffer for the engine's parser
    const arrayBuffer = binaryData.buffer.slice(binaryData.byteOffset, binaryData.byteOffset + binaryData.byteLength);

    // Parse the data using the engine's parser
    const engineBspData = parseBsp(arrayBuffer);

    // Assert that the engine parsed something valid
    expect(engineBspData).toBeDefined();
    expect(engineBspData.header.version).toBe(38);
    expect(engineBspData.lightMaps).toBeDefined();

    // Lengths should match
    expect(engineBspData.lightMaps.length).toBe(compiledBsp.lightMaps.length);
    expect(engineBspData.nodes.length).toBe(compiledBsp.nodes.length);
    expect(engineBspData.faces.length).toBe(compiledBsp.faces.length);
  });
});
