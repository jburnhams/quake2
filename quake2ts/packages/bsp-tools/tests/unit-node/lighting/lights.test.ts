import { describe, it, expect } from 'vitest';
import { parseLights } from '../../../src/lighting/lights.js';
import { MapEntityDef } from '../../../src/parser/entityParser.js';

describe('Light Entity Parsing', () => {
  it('should parse a point light', () => {
    const entities: MapEntityDef[] = [{
      classname: 'light',
      properties: new Map([
        ['origin', '10 20 30'],
        ['light', '250']
      ]),
      brushes: [],
      line: 1
    }];

    const lights = parseLights(entities);

    expect(lights.length).toBe(1);
    expect(lights[0].type).toBe('point');
    expect(lights[0].origin.x).toBe(10);
    expect(lights[0].origin.y).toBe(20);
    expect(lights[0].origin.z).toBe(30);
    expect(lights[0].intensity).toBe(250);
    expect(lights[0].color.x).toBe(1);
    expect(lights[0].color.y).toBe(1);
    expect(lights[0].color.z).toBe(1);
  });

  it('should parse a spotlight with a target', () => {
    const entities: MapEntityDef[] = [{
      classname: 'light',
      properties: new Map([
        ['origin', '0 0 100'],
        ['target', 't1'],
        ['_cone', '45']
      ]),
      brushes: [],
      line: 1
    }];

    const lights = parseLights(entities);

    expect(lights.length).toBe(1);
    expect(lights[0].type).toBe('spot');
    expect(lights[0].origin.x).toBe(0);
    expect(lights[0].origin.y).toBe(0);
    expect(lights[0].origin.z).toBe(100);
    expect(lights[0].outerCone).toBe(45);
    expect(lights[0].innerCone).toBe(35); // outer - 10
  });

  it('should parse a colored light', () => {
    const entities: MapEntityDef[] = [{
      classname: 'light',
      properties: new Map([
        ['origin', '0 0 0'],
        ['_color', '1 0.5 0.25']
      ]),
      brushes: [],
      line: 1
    }];

    const lights = parseLights(entities);

    expect(lights.length).toBe(1);
    expect(lights[0].color.x).toBe(1);
    expect(lights[0].color.y).toBe(0.5);
    expect(lights[0].color.z).toBe(0.25);
  });

  it('should apply default values correctly', () => {
    const entities: MapEntityDef[] = [{
      classname: 'light',
      properties: new Map([
        ['origin', '50 50 50']
      ]),
      brushes: [],
      line: 1
    }];

    const lights = parseLights(entities);

    expect(lights.length).toBe(1);
    expect(lights[0].intensity).toBe(300); // Default intensity
    expect(lights[0].color.x).toBe(1);
    expect(lights[0].color.y).toBe(1);
    expect(lights[0].color.z).toBe(1);
    expect(lights[0].style).toBe(0);
    expect(lights[0].type).toBe('point');
  });

  it('should parse a surface light', () => {
    const entities: MapEntityDef[] = [{
      classname: 'light',
      properties: new Map([
        ['origin', '0 0 0'],
        ['_surface', 'tex_glow']
      ]),
      brushes: [],
      line: 1
    }];

    const lights = parseLights(entities);

    expect(lights.length).toBe(1);
    expect(lights[0].type).toBe('surface');
    expect(lights[0].surface).toBe('tex_glow');
  });

  it('should parse a sun light from worldspawn', () => {
    const entities: MapEntityDef[] = [{
      classname: 'worldspawn',
      properties: new Map([
        ['_sun', 'target_sun'],
        ['_sun_light', '150'],
        ['_sun_color', '0.8 0.8 1']
      ]),
      brushes: [],
      line: 1
    }];

    const lights = parseLights(entities);

    expect(lights.length).toBe(1);
    expect(lights[0].type).toBe('sun');
    expect(lights[0].intensity).toBe(150);
    expect(lights[0].color.x).toBe(0.8);
    expect(lights[0].color.y).toBe(0.8);
    expect(lights[0].color.z).toBe(1);
    expect(lights[0].direction?.x).toBe(0);
    expect(lights[0].direction?.y).toBe(0);
    expect(lights[0].direction?.z).toBe(-1);
  });
  it('should trim string values when parsing vec3', () => {
    const entities: MapEntityDef[] = [{
      classname: 'light',
      properties: new Map([
        ['origin', ' 10 20 30 '],
        ['_color', ' 1 0.5 0.25 ']
      ]),
      brushes: [],
      line: 1
    }];

    const lights = parseLights(entities);

    expect(lights.length).toBe(1);
    expect(lights[0].origin.x).toBe(10);
    expect(lights[0].origin.y).toBe(20);
    expect(lights[0].origin.z).toBe(30);
    expect(lights[0].color.x).toBe(1);
    expect(lights[0].color.y).toBe(0.5);
    expect(lights[0].color.z).toBe(0.25);
  });
});
