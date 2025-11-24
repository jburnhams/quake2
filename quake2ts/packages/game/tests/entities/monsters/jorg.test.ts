import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_jorg } from '../../../src/entities/monsters/jorg.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { GameEngine } from '../../../src/quake2.js';
import { SpawnContext } from '../../../src/entities/spawn.js';

describe('monster_jorg', () => {
  let self: Entity;
  let context: SpawnContext;
  let sys: EntitySystem;

  beforeEach(() => {
    const engineMock = {
        modelIndex: vi.fn().mockReturnValue(1),
    } as unknown as GameEngine;

    sys = {
        spawn: () => new Entity(sys, 1),
        modelIndex: (s: string) => 1,
        timeSeconds: 10,
        multicast: vi.fn(),
        engine: engineMock,
        imports: {
            linkentity: vi.fn(),
        }
    } as unknown as EntitySystem;

    context = {
      entities: sys,
      spawnData: {},
    };

    self = new Entity(sys, 1);
  });

  it('should spawn with correct properties', () => {
    SP_monster_jorg(self, context);

    expect(self.classname).toBe('monster_jorg');
    expect(self.health).toBe(8000);
    expect(self.max_health).toBe(8000);
    expect(self.mass).toBe(1000);
    expect(self.movetype).toBe(MoveType.Step);
    expect(self.solid).toBe(Solid.BoundingBox);
    expect(self.mins).toEqual({ x: -80, y: -80, z: 0 });
    expect(self.maxs).toEqual({ x: 80, y: 80, z: 140 });
  });

  it('should set initial state to stand', () => {
    SP_monster_jorg(self, context);
    expect(self.monsterinfo.current_move).toBeDefined();
    expect(self.monsterinfo.current_move?.frames.length).toBe(51);
  });
});
