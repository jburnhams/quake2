import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_jorg, registerJorgSpawns } from '../../../src/entities/monsters/jorg.js';
import { Entity, MoveType, Solid, DeadFlag } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import * as attack from '../../../src/entities/monsters/attack.js';
import { createTestContext } from '../../test-helpers.js';
import { SpawnRegistry } from '../../../src/entities/spawn.js';

describe('monster_jorg', () => {
  let system: EntitySystem;
  let context: any;

  beforeEach(() => {
    vi.clearAllMocks();
    const testContext = createTestContext();
    system = testContext.entities as unknown as EntitySystem;
    context = testContext;
  });

  it('registers spawn function', () => {
    const registry = new SpawnRegistry();
    registerJorgSpawns(registry);
    expect(registry.get('monster_jorg')).toBe(SP_monster_jorg);
  });

  it('spawns with correct properties', () => {
    const ent = system.spawn();
    SP_monster_jorg(ent, context);

    expect(ent.classname).toBe('monster_jorg');
    expect(ent.model).toBe('models/monsters/boss3/jorg/tris.md2');
    expect(ent.health).toBe(3000);
    expect(ent.max_health).toBe(3000);
    expect(ent.mass).toBe(1000);
    expect(ent.solid).toBe(Solid.BoundingBox);
    expect(ent.movetype).toBe(MoveType.Step);
    expect(ent.viewheight).toBe(25);
    expect(ent.takedamage).toBe(true);
  });

  it('enters stand state after spawn', () => {
    const ent = system.spawn();
    SP_monster_jorg(ent, context);

    expect(ent.monsterinfo.current_move).toBeDefined();
    // Stand move
    expect(ent.monsterinfo.current_move?.firstframe).toBe(0);
    expect(ent.monsterinfo.current_move?.lastframe).toBe(50);
  });

  it('handles pain correctly', () => {
    const ent = system.spawn();
    SP_monster_jorg(ent, context);
    ent.health = 2900;

    // Mock RNG to ensure pain triggers
    // Jorg has high pain thresholds, damage must be significant or lucky
    vi.spyOn(system.rng, 'frandom').mockReturnValue(0.0); // Always pass chance checks

    // Damage > 50 for pain threshold 1
    ent.pain!(ent, system.world, 0, 51);

    // Should enter pain2 state (damage > 50)
    expect(ent.monsterinfo.current_move?.firstframe).toBe(99);
  });

  it('changes skin when health is low', () => {
    const ent = system.spawn();
    SP_monster_jorg(ent, context);
    ent.health = 1000; // < 3000/2

    ent.pain!(ent, system.world, 0, 10);

    expect(ent.skin).toBe(1);
  });

  it('handles death correctly', () => {
    const ent = system.spawn();
    SP_monster_jorg(ent, context);

    ent.die!(ent, system.world, system.world, 3100, { x: 0, y: 0, z: 0 });

    expect(ent.deadflag).toBe(DeadFlag.Dead);
    expect(ent.solid).toBe(Solid.Not);
    expect(ent.monsterinfo.current_move?.firstframe).toBe(127);
  });

  it('attacks with machinegun', () => {
    const ent = system.spawn();
    SP_monster_jorg(ent, context);

    const enemy = system.spawn();
    enemy.health = 100;
    enemy.origin = { x: 100, y: 0, z: 0 };
    ent.enemy = enemy;

    // Mock attack functions
    const monster_fire_bullet_v2 = vi.spyOn(attack, 'monster_fire_bullet_v2');

    // Force attack state
    ent.monsterinfo.attack!(ent);

    // Assuming we rolled for attack 1 (machinegun)
    // We can force the move frame logic
    // Attack 1 frame loop
    // Frame 73 is first frame of loop, calls jorg_fire_bullet
    const attackMove = ent.monsterinfo.current_move; // Should be attack1 or attack2

    // We can't easily predict which attack it chose without mocking random in the attack func
    // But let's verify jorg_fire_bullet logic specifically

    // Manually invoke the think function for the attack frame
    // We need to access the closure or exported function.
    // Since jorg_fire_bullet is not exported, we have to trigger it via the move frames.

    // Let's assume we want to test the machinegun logic specifically.
    // We can check if calling the think function of the attack1_frames triggers the bullets.

    // Find the attack1 move.
    // Based on source: firstframe 73, lastframe 78
    // But we don't have direct access to 'attack1_move' variable from here.
    // However, if we force random to 0, jorg_attack selects attack1.
    vi.spyOn(system.rng, 'frandom').mockReturnValue(0.0);
    ent.monsterinfo.attack!(ent);

    const move = ent.monsterinfo.current_move!;
    expect(move.firstframe).toBe(73); // attack1_move start

    // Execute the think function for the first frame of the attack loop
    if (move.frames && move.frames[0].think) {
        move.frames[0].think(ent, system);

        // Should fire two bullets (left and right)
        expect(monster_fire_bullet_v2).toHaveBeenCalledTimes(2);
        expect(monster_fire_bullet_v2).toHaveBeenCalledWith(
            ent,
            expect.anything(), // start
            expect.anything(), // dir
            6, // damage
            4, // kick
            expect.anything(),
            expect.anything(),
            0,
            system,
            expect.anything() // mod
        );
    } else {
        throw new Error('Attack frame expected to have a think function');
    }
  });

  it('attacks with BFG', () => {
    const ent = system.spawn();
    SP_monster_jorg(ent, context);

    const enemy = system.spawn();
    enemy.health = 100;
    enemy.origin = { x: 100, y: 0, z: 0 };
    ent.enemy = enemy;

    const monster_fire_bfg = vi.spyOn(attack, 'monster_fire_bfg');

    // Force attack 2 (BFG) by mocking high random value
    vi.spyOn(system.rng, 'frandom').mockReturnValue(0.9);
    ent.monsterinfo.attack!(ent);

    const move = ent.monsterinfo.current_move!;
    expect(move.firstframe).toBe(83); // attack2_move start

    // Find the frame that fires BFG (frame 6 in the sequence)
    // 83 + 6 = 89
    const frameIndex = 6;
    if (move.frames && move.frames[frameIndex] && move.frames[frameIndex].think) {
        move.frames[frameIndex].think!(ent, system);

        expect(monster_fire_bfg).toHaveBeenCalledWith(
            ent,
            expect.anything(),
            expect.anything(),
            50, // damage
            300, // speed
            100, // kick
            200, // radius
            0,
            system
        );
    } else {
         throw new Error('BFG Attack frame expected to have a think function');
    }
  });
});
