import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerInfantrySpawns } from '../../../src/entities/monsters/infantry.js';
import { MoveType, Solid } from '../../../src/entities/entity.js';
import { SpawnRegistry } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { monster_fire_bullet } from '../../../src/entities/monsters/attack.js';
import { createTestContext, createMonsterEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils';

// Mock dependencies
vi.mock('../../../src/entities/monsters/attack.js', async () => {
  const { mockMonsterAttackFunctions } = await import('@quake2ts/test-utils');
  return mockMonsterAttackFunctions;
});

describe('monster_infantry', () => {
  let sys: EntitySystem;
  let context: any;
  let infantry: any;
  let spawnRegistry: SpawnRegistry;

  beforeEach(() => {
    const testCtx = createTestContext();
    sys = testCtx.entities;
    context = testCtx;

    infantry = createMonsterEntityFactory('monster_infantry', {
        number: 1,
        origin: { x: 0, y: 0, z: 0 },
        angles: { x: 0, y: 0, z: 0 }
    });

    spawnRegistry = {
        register: vi.fn(),
    } as unknown as SpawnRegistry;

    vi.clearAllMocks();
  });

  it('registerInfantrySpawns registers monster_infantry', () => {
    registerInfantrySpawns(spawnRegistry);
    expect(spawnRegistry.register).toHaveBeenCalledWith('monster_infantry', expect.any(Function));
  });

  it('SP_monster_infantry sets default properties', () => {
    registerInfantrySpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];

    spawnFn(infantry, context);

    expect(infantry.model).toBe('models/monsters/infantry/tris.md2');
    expect(infantry.health).toBe(100);
    expect(infantry.solid).toBe(Solid.BoundingBox);
    expect(infantry.movetype).toBe(MoveType.Step);
    expect(infantry.monsterinfo.stand).toBeDefined();
    expect(infantry.monsterinfo.attack).toBeDefined();
    expect(infantry.monsterinfo.idle).toBeDefined();
  });

  it('infantry attack fires machinegun', () => {
    registerInfantrySpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
    spawnFn(infantry, context);

    infantry.enemy = createPlayerEntityFactory({
        number: 2,
        origin: { x: 100, y: 0, z: 0 }
    });
    infantry.origin = { x: 0, y: 0, z: 0 };

    infantry.monsterinfo.attack!(infantry, context.entities as any);
    const move = infantry.monsterinfo.current_move;

    // Check frames 5, 6, 7
    const fireFn = move!.frames[5].think;
    expect(fireFn).toBeDefined();

    fireFn!(infantry, sys);

    expect(monster_fire_bullet).toHaveBeenCalledWith(
        infantry,
        expect.anything(),
        expect.anything(),
        5, // damage
        2, // kick
        expect.any(Number), expect.any(Number), 0, // spread (using expect.any to avoid strict float issues)
        sys,
        expect.anything()
    );
  });

  it('infantry plays idle sound periodically', () => {
    registerInfantrySpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
    spawnFn(infantry, context);

    // Mock rng to trigger the sound
    vi.spyOn(sys.rng, 'frandom').mockReturnValue(0.1);

    // Execute the idle function
    infantry.monsterinfo.idle!(infantry);

    // Check if sound was played
    expect(sys.sound).toHaveBeenCalledWith(
        infantry,
        expect.anything(), // channel
        expect.stringMatching(/infantry\/idle1.wav/), // sound path
        1, // volume
        expect.anything(), // attenuation
        0
    );
  });
});
