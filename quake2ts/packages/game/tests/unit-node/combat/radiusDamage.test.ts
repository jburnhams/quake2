
import { describe, it, expect } from 'vitest';
import { T_RadiusDamage } from '../../../src/combat/damage.js';
import { DamageFlags } from '../../../src/combat/damageFlags.js';
import { DamageMod } from '../../../src/combat/damageMods.js';
import { createEntityFactory } from '@quake2ts/test-utils';

describe('T_RadiusDamage', () => {
  it('should apply damage to entities within radius', () => {
    const victim = createEntityFactory({
      origin: { x: 50, y: 0, z: 0 },
      mass: 200,
      takedamage: true,
      health: 100
    });
    const attacker = createEntityFactory({
      origin: { x: 200, y: 200, z: 200 },
      mass: 200,
      takedamage: true,
      health: 100
    });
    const inflictor = { origin: { x: 0, y: 0, z: 0 } };

    const hits = T_RadiusDamage(
      [victim, attacker],
      inflictor,
      attacker,
      100, // damage
      null, // ignore
      100, // radius
      DamageFlags.NONE,
      DamageMod.ROCKET,
      0
    );

    expect(hits.length).toBe(1);
    expect(hits[0].target).toBe(victim);
    // Distance is 50. Points = 100 - 0.5 * 50 = 75.
    expect(hits[0].appliedDamage).toBe(75);
    expect(victim.health).toBe(25);
  });

  it('should apply half damage to attacker (self-damage)', () => {
    // In Quake 2, the attacker takes half damage from their own radius attacks.
    const attacker = createEntityFactory({
      origin: { x: 10, y: 0, z: 0 },
      mass: 200,
      takedamage: true,
      health: 100
    });
    const inflictor = { origin: { x: 0, y: 0, z: 0 } };

    // Distance 10. Points = 100 - 0.5 * 10 = 95.
    // Self damage should be halved: 47.5

    const hits = T_RadiusDamage(
      [attacker],
      inflictor,
      attacker,
      100,
      null,
      120,
      DamageFlags.NONE,
      DamageMod.ROCKET,
      0
    );

    expect(hits.length).toBe(1);
    expect(hits[0].target).toBe(attacker);

    const expectedDamage = (100 - 0.5 * 10) * 0.5;
    expect(hits[0].appliedDamage).toBe(expectedDamage);
    expect(attacker.health).toBe(100 - expectedDamage);
  });
});
