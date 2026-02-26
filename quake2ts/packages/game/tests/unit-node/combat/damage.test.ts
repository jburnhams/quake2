import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createTestContext, spawnEntity, createMonsterEntityFactory, createPlayerEntityFactory, TestContext } from '@quake2ts/test-utils';
import { EntitySystem, T_Damage, DamageMod } from '@quake2ts/game';

describe('Combat System Unit Tests', () => {
  let entitySystem: EntitySystem;
  let imports: TestContext['imports'];

  beforeEach(() => {
    const ctx = createTestContext();
    entitySystem = ctx.entities;
    imports = ctx.imports;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should inflict damage and reduce health using T_Damage', () => {
    const target = spawnEntity(entitySystem, createMonsterEntityFactory('monster_soldier', {
        health: 100,
        takedamage: true,
        origin: { x: 100, y: 0, z: 0 }
    }));
    // Manually add callbacks
    target.pain = vi.fn();
    target.die = vi.fn();

    const attacker = spawnEntity(entitySystem, createPlayerEntityFactory({
        origin: { x: 0, y: 0, z: 0 }
    }));

    // Execute actual combat logic
    const dir = { x: 1, y: 0, z: 0 }; // Direction from attacker to target
    const point = { x: 90, y: 0, z: 0 }; // Impact point
    const damage = 20;
    const knockback = 20;
    const dflags = 0;
    const mod = DamageMod.BLASTER;

    const result = T_Damage(
        target,
        attacker, // Inflictor
        attacker, // Attacker
        dir,
        point,
        dir, // normal
        damage,
        knockback,
        dflags,
        mod,
        0, // time
        imports.multicast // multicast
    );

    // Verify state changes
    expect(target.health).toBe(80);
    expect(target.pain).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result?.take).toBe(20);

    // Kill it
    T_Damage(target, attacker, attacker, dir, point, dir, 100, 100, dflags, mod, 0, imports.multicast);

    expect(target.health).toBeLessThanOrEqual(0);
    expect(target.die).toHaveBeenCalled();
  });
});
