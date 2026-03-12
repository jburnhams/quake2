import { describe, bench } from 'vitest';
import { BspCompiler } from '../../../src/compiler/BspCompiler.js';
import { createBoxRoom } from '../../fixtures/maps/box.js';
import { createCorridor } from '../../fixtures/maps/corridor.js';
import { createMultiRoom } from '../../fixtures/maps/multiroom.js';

describe('Compilation Performance', () => {
  bench('empty worldspawn', () => {
    const map = {
      mapVersion: 220,
      worldspawn: { classname: 'worldspawn', properties: new Map(), brushes: [], line: 1 },
      entities: [
        { classname: 'worldspawn', properties: new Map(), brushes: [], line: 1 }
      ]
    };
    const compiler = new BspCompiler({ noVis: true, noLighting: true, verbose: false });
    compiler.compile(map);
  });

  bench('single room (box)', () => {
    const mapData = createBoxRoom();
    const map = {
      mapVersion: 220,
      worldspawn: mapData[0] as any,
      entities: mapData as any
    };
    const compiler = new BspCompiler({ noVis: true, noLighting: true, verbose: false });
    compiler.compile(map);
  });

  bench('corridor map', () => {
    const mapData = createCorridor();
    const map = {
      mapVersion: 220,
      worldspawn: mapData[0] as any,
      entities: mapData as any
    };
    const compiler = new BspCompiler({ noVis: true, noLighting: true, verbose: false });
    compiler.compile(map);
  });

  bench('multiroom map', () => {
    const mapData = createMultiRoom();
    const map = {
      mapVersion: 220,
      worldspawn: mapData[0] as any,
      entities: mapData as any
    };
    const compiler = new BspCompiler({ noVis: true, noLighting: true, verbose: false });
    compiler.compile(map);
  });
});
