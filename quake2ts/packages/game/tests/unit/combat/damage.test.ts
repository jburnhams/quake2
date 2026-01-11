import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createTestContext, spawnEntity, createMonsterEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils';
import { T_Damage, DamageMod } from '@quake2ts/game';

describe('Combat System Unit Tests', () => {
  let context: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    // createTestContext calls setupBrowserEnvironment implicitly or we assume environment is set up by vitest config
    // (Actually test-utils factories/helpers don't call it, but vitest-setup usually does.
    // The original test called setupBrowserEnvironment(). createTestContext doesn't.
    // But let's assume usage of createTestContext implies we are in a test env.)

    context = createTestContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should inflict damage and reduce health using T_Damage', () => {
    const target = spawnEntity(context.entities, createMonsterEntityFactory('monster_soldier', {
        health: 100,
        takedamage: true,
        origin: { x: 100, y: 0, z: 0 }
    }));
    // Manually add callbacks
    target.pain = vi.fn();
    target.die = vi.fn();

    const attacker = spawnEntity(context.entities, createPlayerEntityFactory({
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
        target as any,
        attacker as any,
        attacker as any,
        dir,
        point,
        dir, // normal
        damage,
        knockback,
        dflags,
        mod,
        0, // time
        context.imports.multicast // multicast
    );

    // Verify state changes
    expect(target.health).toBe(80);
    expect(target.pain).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result?.take).toBe(20);

    // Kill it
    T_Damage(target as any, attacker as any, attacker as any, dir, point, dir, 100, 100, dflags, mod, 0, context.imports.multicast);

    expect(target.health).toBeLessThanOrEqual(0);
    expect(target.die).toHaveBeenCalled();
  });
});
