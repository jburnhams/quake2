import { describe, bench } from 'vitest';
import { BspCompiler } from '../../../src/compiler/BspCompiler.js';
import { createBoxRoom } from '../../fixtures/maps/box.js';
import { createCorridor } from '../../fixtures/maps/corridor.js';
import { createMultiRoom } from '../../fixtures/maps/multiroom.js';
import type { MapEntityDef } from '../../../src/parser/entityParser.js';

describe('Compilation Performance', () => {
  const compiler = new BspCompiler({ noVis: true, noLighting: true, verbose: false });

  function compileMap(entities: any[]) {
    // We assume the first entity is worldspawn and it contains the map brushes.
    const worldspawn = entities.find(e => e.classname === 'worldspawn') || { brushes: [] };
    const brushes = worldspawn.brushes || [];
    compiler.compile(brushes, entities);
  }

  bench('empty worldspawn', () => {
    compileMap([
      { classname: 'worldspawn', properties: new Map(), brushes: [], line: 1 }
    ]);
  });

  bench('single room (box)', () => {
    compileMap(createBoxRoom());
  });

  bench('corridor map', () => {
    compileMap(createCorridor());
  });

  bench('multiroom map', () => {
    compileMap(createMultiRoom());
  });
});
