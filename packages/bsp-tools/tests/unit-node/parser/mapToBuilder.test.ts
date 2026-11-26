import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapToBuilder } from '../../../src/parser/mapToBuilder';
import { BspBuilder } from '../../../src/builder/BspBuilder';
import type { ParsedMap } from '../../../src/parser/mapParser';
import type { MapEntityDef, MapBrushDef } from '../../../src/index';
import type { Vec3 } from '@quake2ts/shared';

describe('mapToBuilder', () => {
  let builder: BspBuilder;

  beforeEach(() => {
    builder = new BspBuilder();
  });

  // Helper to create valid points for a plane (z-up plane)
  // Quake 2 uses CW winding for front-facing
  // (0,0,0) -> (0,10,0) -> (10,0,0) is CW around Z
  const p1: Vec3 = { x: 0, y: 0, z: 0 };
  const p2: Vec3 = { x: 0, y: 10, z: 0 };
  const p3: Vec3 = { x: 10, y: 0, z: 0 };

  const createSide = () => ({
    planePoints: [p1, p2, p3] as [Vec3, Vec3, Vec3],
    texture: 'base_wall',
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    line: 10
  });

  it('should convert worldspawn and its brushes', () => {
    const setWorldspawnSpy = vi.spyOn(builder, 'setWorldspawn');
    const addBrushSpy = vi.spyOn(builder, 'addBrush');

    const brush: MapBrushDef = {
      line: 5,
      sides: [createSide()]
    };

    const worldspawn: MapEntityDef = {
      classname: 'worldspawn',
      properties: new Map([['message', 'Test Map'], ['sky', 'unit1_sky']]),
      brushes: [brush],
      line: 1
    };

    const map: ParsedMap = {
      entities: [worldspawn],
      worldspawn: worldspawn,
      mapVersion: 220
    };

    mapToBuilder(map, builder);

    // Check worldspawn properties
    expect(setWorldspawnSpy).toHaveBeenCalledWith({
      message: 'Test Map',
      sky: 'unit1_sky'
    });

    // Check brush addition
    expect(addBrushSpy).toHaveBeenCalledTimes(1);
    const addedBrush = addBrushSpy.mock.calls[0][0];
    expect(addedBrush.sides).toHaveLength(1);
    expect(addedBrush.sides[0].texture.name).toBe('base_wall');
    // Plane normal for (0,0,0)->(10,0,0)->(0,10,0) is (0,0,1)
    expect(addedBrush.sides[0].plane.normal.z).toBeCloseTo(1);
  });

  it('should convert other entities', () => {
    const addEntitySpy = vi.spyOn(builder, 'addEntity');

    const worldspawn: MapEntityDef = {
      classname: 'worldspawn',
      properties: new Map(),
      brushes: [],
      line: 1
    };

    const brush: MapBrushDef = {
      line: 20,
      sides: [createSide()]
    };

    const funcWall: MapEntityDef = {
      classname: 'func_wall',
      properties: new Map([['targetname', 'wall1']]),
      brushes: [brush],
      line: 15
    };

    const map: ParsedMap = {
      entities: [worldspawn, funcWall],
      worldspawn: worldspawn,
      mapVersion: 220
    };

    mapToBuilder(map, builder);

    expect(addEntitySpy).toHaveBeenCalledTimes(1);
    const addedEntity = addEntitySpy.mock.calls[0][0];

    expect(addedEntity.classname).toBe('func_wall');
    expect(addedEntity.properties['targetname']).toBe('wall1');
    expect(addedEntity.brushes).toHaveLength(1);
    expect(addedEntity.brushes![0].sides[0].texture.name).toBe('base_wall');
  });

  it('should handle entities without brushes (point entities)', () => {
    const addEntitySpy = vi.spyOn(builder, 'addEntity');

    const worldspawn: MapEntityDef = {
      classname: 'worldspawn',
      properties: new Map(),
      brushes: [],
      line: 1
    };

    const playerStart: MapEntityDef = {
      classname: 'info_player_start',
      properties: new Map([['origin', '0 0 0']]),
      brushes: [],
      line: 10
    };

    const map: ParsedMap = {
      entities: [worldspawn, playerStart],
      worldspawn: worldspawn,
      mapVersion: 220
    };

    mapToBuilder(map, builder);

    expect(addEntitySpy).toHaveBeenCalledTimes(1);
    const addedEntity = addEntitySpy.mock.calls[0][0];
    expect(addedEntity.classname).toBe('info_player_start');
    expect(addedEntity.brushes).toBeUndefined(); // or empty, but implementation creates it only if length > 0
  });

  it('should capture contents from brush sides', () => {
    const addBrushSpy = vi.spyOn(builder, 'addBrush');

    const side = createSide();
    side.contents = 1234; // CONTENTS_SOMETHING

    const brush: MapBrushDef = {
      line: 5,
      sides: [side]
    };

    const worldspawn: MapEntityDef = {
      classname: 'worldspawn',
      properties: new Map(),
      brushes: [brush],
      line: 1
    };

    const map: ParsedMap = {
      entities: [worldspawn],
      worldspawn: worldspawn,
      mapVersion: 220
    };

    mapToBuilder(map, builder);

    const addedBrush = addBrushSpy.mock.calls[0][0];
    expect(addedBrush.contents).toBe(1234);
  });

  it('should skip brushes with degenerate faces', () => {
    const addBrushSpy = vi.spyOn(builder, 'addBrush');
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Colinear points -> degenerate plane
    const p1: Vec3 = { x: 0, y: 0, z: 0 };
    const p2: Vec3 = { x: 10, y: 0, z: 0 };
    const p3: Vec3 = { x: 20, y: 0, z: 0 };

    const side = createSide();
    side.planePoints = [p1, p2, p3];

    const brush: MapBrushDef = {
      line: 5,
      sides: [side]
    };

    const worldspawn: MapEntityDef = {
      classname: 'worldspawn',
      properties: new Map(),
      brushes: [brush],
      line: 1
    };

    const map: ParsedMap = {
      entities: [worldspawn],
      worldspawn: worldspawn,
      mapVersion: 220
    };

    mapToBuilder(map, builder);

    expect(addBrushSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });
});
