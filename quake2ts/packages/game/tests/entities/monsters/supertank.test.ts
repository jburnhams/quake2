import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_supertank } from '../../../src/entities/monsters/supertank.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { GameEngine } from '../../../src/quake2.js';
import { SpawnContext } from '../../../src/entities/spawn.js';
import { Vec3 } from '@quake2ts/shared';

describe('monster_supertank', () => {
  let self: Entity;
  let context: SpawnContext;
  let engine: GameEngine;
  let sys: EntitySystem;

  beforeEach(() => {
    // Mock engine
    const engineMock = {
        modelIndex: vi.fn().mockReturnValue(1),
    } as unknown as GameEngine;

    // Mock EntitySystem
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
    SP_monster_supertank(self, context);

    expect(self.classname).toBe('monster_supertank');
    expect(self.health).toBe(1500);
    expect(self.max_health).toBe(1500);
    expect(self.mass).toBe(800);
    expect(self.movetype).toBe(MoveType.Step);
    expect(self.solid).toBe(Solid.BoundingBox);
    expect(self.mins).toEqual({ x: -64, y: -64, z: 0 });
    expect(self.maxs).toEqual({ x: 64, y: 64, z: 112 });
  });

  it('should set initial state to stand', () => {
    SP_monster_supertank(self, context);
    expect(self.monsterinfo.current_move).toBeDefined();
    // Stand move is 60 frames
    expect(self.monsterinfo.current_move?.frames.length).toBe(60);
  });
});
