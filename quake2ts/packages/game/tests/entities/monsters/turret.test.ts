import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTurretSpawns } from '../../../src/entities/monsters/turret.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { SpawnRegistry } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { monster_fire_blaster } from '../../../src/entities/monsters/attack.js';
import { createTestContext, createSpawnRegistry } from '@quake2ts/test-utils';

// Mock dependencies
vi.mock('../../../src/entities/monsters/attack.js', () => ({
  monster_fire_blaster: vi.fn(),
}));

describe('monster_turret', () => {
  let sys: EntitySystem;
  let context: ReturnType<typeof createTestContext>;
  let turret: Entity;
  let spawnRegistry: SpawnRegistry;

  beforeEach(async () => {
    vi.clearAllMocks();
    context = await createTestContext();
    sys = context.entities;

    turret = sys.spawn();
    // Re-create spawn registry using helper if we can, or mock it better
    spawnRegistry = createSpawnRegistry(context);

    // If createSpawnRegistry relies on real implementation we might need to mock register
    vi.spyOn(spawnRegistry, 'register');
  });

  it('registerTurretSpawns registers monster_turret', () => {
    registerTurretSpawns(spawnRegistry);
    expect(spawnRegistry.register).toHaveBeenCalledWith('monster_turret', expect.any(Function));
  });

  it('SP_monster_turret sets default properties', () => {
    registerTurretSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];

    spawnFn(turret, context);

    expect(turret.model).toBe('models/monsters/turret/tris.md2');
    expect(turret.health).toBe(100);
    expect(turret.solid).toBe(Solid.BoundingBox);
    expect(turret.movetype).toBe(MoveType.Step);
    expect(turret.monsterinfo.stand).toBeDefined();
    expect(turret.monsterinfo.attack).toBeDefined();
  });

  it('turret attack fires blaster', () => {
    registerTurretSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
    spawnFn(turret, context);

    turret.enemy = sys.spawn();
    turret.enemy.origin = { x: 100, y: 0, z: 0 };
    turret.origin = { x: 0, y: 0, z: 0 };

    turret.monsterinfo.attack!(turret, sys);
    const move = turret.monsterinfo.current_move;

    // Check frame 4 (index 4, 5th frame)
    const fireFn = move!.frames[4].think;
    expect(fireFn).toBeDefined();

    fireFn!(turret, sys);

    expect(monster_fire_blaster).toHaveBeenCalledWith(
        turret,
        expect.anything(),
        expect.anything(),
        2, // damage
        1000, // speed
        1, // effect
        0,
        sys
    );
  });
});
