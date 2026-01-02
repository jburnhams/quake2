import { describe, it, expect } from 'vitest';
import { parseBsp, BspMap, BspEntity } from '../../../src/assets/bsp.js';

// Helper to create a minimal BspMap for testing
function createTestMap(
  entities: BspEntity[],
  models: any[] = [],
  brushes: any[] = [],
  faces: any[] = []
): BspMap {
  const map: any = {
    entities: {
      entities,
      getUniqueClassnames() {
        const set = new Set(entities.map(e => e.classname).filter(c => !!c));
        return Array.from(set).sort();
      }
    },
    models,
    pickEntity: null // Placeholder
  };

  // Attach pickEntity implementation similar to parseBsp
  map.pickEntity = function(ray: { origin: [number, number, number], direction: [number, number, number] }) {
    // ... copy implementation or reuse if I could extract it
    // But since I cannot easily import the private function from bsp.ts,
    // I will rely on creating a buffer and parsing it for pickEntity test
    // OR just manually constructing the object if I trust the manual logic matches.
    // Ideally I should test `parseBsp` result.
    return null;
  };
  return map as BspMap;
}

// Better approach: Test the logic by creating a synthetic BSP buffer if possible,
// OR simpler: Since I modified `parseBsp` to attach methods, I should call `parseBsp` with a minimal valid buffer.
// Constructing a valid BSP buffer is hard.
// Alternative: Modify `bsp.ts` to export the logic or the class.
// But I can't easily do that.

// However, I can test `getUniqueClassnames` logic easily if I just access it on the result of `parseBsp` if I can create one.
// Creating a minimal valid BSP buffer is tedious but possible (headers + empty lumps).

import {
  BspLump,
} from '../../../src/assets/bsp.js';

function createMinimalBspBuffer(entityString: string, models: any[] = []): ArrayBuffer {
  // We need enough buffer for header + lumps
  // Header: 4 (magic) + 4 (version) + 19*8 (lumps) = 8 + 152 = 160 bytes

  const buffer = new ArrayBuffer(10000); // Sufficient size
  const view = new DataView(buffer);

  // Magic IBSP
  view.setUint8(0, 73); // I
  view.setUint8(1, 66); // B
  view.setUint8(2, 83); // S
  view.setUint8(3, 80); // P

  // Version 38
  view.setInt32(4, 38, true);

  // Initialize lumps to point to end of header
  let offset = 160;

  // Entities
  const entBytes = new TextEncoder().encode(entityString);
  view.setInt32(8 + BspLump.Entities * 8, offset, true);
  view.setInt32(12 + BspLump.Entities * 8, entBytes.length, true);
  new Uint8Array(buffer, offset).set(entBytes);
  offset += entBytes.length;
  // Pad to 4 bytes? Not strictly required by parser but good practice.
  while (offset % 4 !== 0) offset++;

  // Models
  // Each model is 48 bytes
  const modelOffset = offset;
  const modelLength = models.length * 48;
  view.setInt32(8 + BspLump.Models * 8, modelOffset, true);
  view.setInt32(12 + BspLump.Models * 8, modelLength, true);

  for (let i = 0; i < models.length; i++) {
    const m = models[i];
    const base = modelOffset + i * 48;
    // mins
    view.setFloat32(base + 0, m.mins[0], true);
    view.setFloat32(base + 4, m.mins[1], true);
    view.setFloat32(base + 8, m.mins[2], true);
    // maxs
    view.setFloat32(base + 12, m.maxs[0], true);
    view.setFloat32(base + 16, m.maxs[1], true);
    view.setFloat32(base + 20, m.maxs[2], true);
    // origin
    view.setFloat32(base + 24, 0, true);
    view.setFloat32(base + 28, 0, true);
    view.setFloat32(base + 32, 0, true);

    // headNode, firstFace, numFaces
    view.setInt32(base + 36, 0, true);
    view.setInt32(base + 40, m.firstFace || 0, true);
    view.setInt32(base + 44, m.numFaces || 0, true);
  }
  offset += modelLength;

  // Other lumps empty, offset at end
  for (let i = 0; i < 19; i++) {
    if (i === BspLump.Entities || i === BspLump.Models) continue;
    view.setInt32(8 + i * 8, offset, true);
    view.setInt32(12 + i * 8, 0, true);
  }

  return buffer;
}

describe('Bsp Features', () => {
  it('getUniqueClassnames returns sorted unique classnames', () => {
    const entityStr = `
{
"classname" "worldspawn"
}
{
"classname" "func_door"
}
{
"classname" "info_player_start"
}
{
"classname" "func_door"
}
`;
    const buffer = createMinimalBspBuffer(entityStr);
    const map = parseBsp(buffer);

    expect(map.entities.getUniqueClassnames()).toEqual([
      'func_door',
      'info_player_start',
      'worldspawn'
    ]);
  });

  it('pickEntity finds the closest brush entity', () => {
    const entityStr = `
{
"classname" "worldspawn"
}
{
"classname" "func_wall"
"model" "*1"
}
{
"classname" "func_door"
"model" "*2"
}
`;

    // Model 0 is usually worldspawn (ignored by pickEntity logic usually? No, properties['model'] check.
    // Worldspawn doesn't have model property usually, it IS the world.)
    // But brush entities have model="*1" etc.

    // Model 1: func_wall at (100, 0, 0) size 10
    // Mins: 95, -5, -5. Maxs: 105, 5, 5.
    const model1 = {
      mins: [95, -5, -5],
      maxs: [105, 5, 5]
    };

    // Model 2: func_door at (200, 0, 0) size 10
    const model2 = {
      mins: [195, -5, -5],
      maxs: [205, 5, 5]
    };

    // Dummy model 0
    const model0 = { mins: [0,0,0], maxs:[0,0,0] };

    const buffer = createMinimalBspBuffer(entityStr, [model0, model1, model2]);
    const map = parseBsp(buffer);

    // Ray from 0,0,0 pointing +X
    const ray = {
      origin: [0, 0, 0] as [number, number, number],
      direction: [1, 0, 0] as [number, number, number]
    };

    const result = map.pickEntity(ray);

    expect(result).not.toBeNull();
    expect(result?.entity.classname).toBe('func_wall');
    expect(result?.distance).toBeCloseTo(95);
  });

  it('pickEntity returns null if no intersection', () => {
     const entityStr = `
{
"classname" "func_wall"
"model" "*1"
}
`;
    const model1 = {
      mins: [95, -5, -5],
      maxs: [105, 5, 5]
    };
    const model0 = { mins: [0,0,0], maxs:[0,0,0] };

    const buffer = createMinimalBspBuffer(entityStr, [model0, model1]);
    const map = parseBsp(buffer);

    // Ray pointing away (-X)
    const ray = {
      origin: [0, 0, 0] as [number, number, number],
      direction: [-1, 0, 0] as [number, number, number]
    };

    expect(map.pickEntity(ray)).toBeNull();
  });

    it('pickEntity respects closest entity', () => {
    const entityStr = `
{
"classname" "func_wall_far"
"model" "*2"
}
{
"classname" "func_wall_near"
"model" "*1"
}
`;
    // Model 1: Near (50)
    const model1 = {
      mins: [45, -5, -5],
      maxs: [55, 5, 5]
    };
    // Model 2: Far (100)
    const model2 = {
      mins: [95, -5, -5],
      maxs: [105, 5, 5]
    };
    const model0 = { mins: [0,0,0], maxs:[0,0,0] };

    const buffer = createMinimalBspBuffer(entityStr, [model0, model1, model2]);
    const map = parseBsp(buffer);

    const ray = {
      origin: [0, 0, 0] as [number, number, number],
      direction: [1, 0, 0] as [number, number, number]
    };

    const result = map.pickEntity(ray);
    expect(result).not.toBeNull();
    expect(result?.entity.classname).toBe('func_wall_near');
    expect(result?.distance).toBeCloseTo(45);
  });
});
