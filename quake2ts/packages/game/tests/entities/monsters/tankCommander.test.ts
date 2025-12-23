import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_tank_commander } from '../../../src/entities/monsters/tankCommander.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { createGame } from '../../../src/index.js';
import { SpawnContext } from '../../../src/entities/spawn.js';
import { createGameImportsAndEngine } from '@quake2ts/test-utils';

describe('monster_tank_commander', () => {
  let system: EntitySystem;
  let context: SpawnContext;

  beforeEach(() => {
    // Mock game engine and imports
    const { imports, engine } = createGameImportsAndEngine();

    const gameExports = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });
    system = (gameExports as any).entities;

    context = {
      keyValues: {},
      entities: system,
      warn: vi.fn(),
      free: vi.fn(),
    };
  });

  it('spawns with correct properties', () => {
    const ent = system.spawn();
    SP_monster_tank_commander(ent, context);

    expect(ent.classname).toBe('monster_tank_commander');
    expect(ent.health).toBe(1000); // Commander is tougher
    expect(ent.skin).toBe(2);
    expect(ent.monsterinfo.stand).toBeDefined(); // Inherits AI
  });
});
