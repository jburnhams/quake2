import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_tank } from '../../../src/entities/monsters/tank.js';
import { Entity, MoveType, Solid, DeadFlag } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import * as attack from '../../../src/entities/monsters/attack.js';
import { createTestContext } from '../../test-helpers.js';

describe('monster_tank', () => {
  let system: EntitySystem;
  let context: any;

  beforeEach(() => {
    vi.clearAllMocks();
    const testContext = createTestContext();
    system = testContext.entities as unknown as EntitySystem;
    context = testContext;
  });

  it('spawns with correct properties', () => {
    const ent = system.spawn();
    SP_monster_tank(ent, context);

    expect(ent.classname).toBe('monster_tank');
    expect(ent.model).toBe('models/monsters/tank/tris.md2');
    expect(ent.health).toBe(750);
    expect(ent.max_health).toBe(750);
    expect(ent.mass).toBe(500);
    expect(ent.solid).toBe(Solid.BoundingBox);
    expect(ent.movetype).toBe(MoveType.Step);
  });

  it('enters stand state after spawn', () => {
    const ent = system.spawn();
    SP_monster_tank(ent, context);

    expect(ent.monsterinfo.current_move).toBeDefined();
    expect(ent.monsterinfo.current_move?.firstframe).toBe(0);
  });

  it('handles pain correctly', () => {
    const ent = system.spawn();
    SP_monster_tank(ent, context);
    ent.health = 300; // Less than half health to trigger pain

    // Mock random to bypass the 50% chance to ignore low damage
    vi.spyOn(system.rng, 'frandom').mockReturnValue(0.6);

    // Damage > 10 ensures we don't hit the low damage ignore check
    ent.pain!(ent, system.world, 0, 20);
    expect(ent.monsterinfo.current_move?.firstframe).toBe(116);
  });

  it('handles death correctly', () => {
    const ent = system.spawn();
    SP_monster_tank(ent, context);

    ent.die!(ent, system.world, system.world, 800, { x: 0, y: 0, z: 0 });

    expect(ent.deadflag).toBe(DeadFlag.Dead);
    expect(ent.solid).toBe(Solid.Not);
    expect(ent.monsterinfo.current_move?.firstframe).toBe(122);
  });

  it('fires machinegun with correct damage', () => {
    const ent = system.spawn();
    SP_monster_tank(ent, context);

    const enemy = system.spawn();
    enemy.health = 100;
    ent.enemy = enemy;

    const monster_fire_bullet = vi.spyOn(attack, 'monster_fire_bullet');

    // Manually set the attack move
    ent.monsterinfo.current_move = ent.monsterinfo.attack_machinegun;
    ent.monsterinfo.current_move.frames[6].think(ent, system);

    expect(monster_fire_bullet).toHaveBeenCalledWith(
      ent,
      expect.anything(),
      expect.anything(),
      20, // damage
      2, // kick
      expect.anything(),
      expect.anything(),
      expect.anything(),
      system,
      expect.anything()
    );
  });

  it('tank plays idle sound periodically', () => {
    const ent = system.spawn();
    SP_monster_tank(ent, context);

    // Should have an idle function in monsterinfo
    expect(ent.monsterinfo.idle).toBeDefined();

    // Mock RNG to trigger the sound
    vi.spyOn(system.rng, 'frandom').mockReturnValue(0.1);

    // Execute the idle function
    ent.monsterinfo.idle!(ent);

    // Check if sound was played
    expect(system.engine.sound).toHaveBeenCalledWith(
        ent,
        expect.anything(), // channel
        expect.stringMatching(/tank\/tnkidle/), // sound path
        1, // volume
        expect.anything(), // attenuation
        0
    );
  });
});
