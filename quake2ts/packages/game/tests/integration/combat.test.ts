import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setupBrowserEnvironment, createGameImportsAndEngine, spawnEntity, createMonsterEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils';
import { EntitySystem } from '../../src/entities/index.js';
import { T_Damage } from '../../src/combat/damage.js';
import { DamageMod } from '../../src/combat/damageMods.js';

describe('Combat System Integration', () => {
  let entitySystem: EntitySystem;
  let imports: ReturnType<typeof createGameImportsAndEngine>['imports'];
  let engine: ReturnType<typeof createGameImportsAndEngine>['engine'];

  beforeEach(() => {
    setupBrowserEnvironment();
    const result = createGameImportsAndEngine();
    imports = result.imports;
    engine = result.engine;

    entitySystem = new EntitySystem(
      engine,
      imports,
      { x: 0, y: 0, z: -800 }, // Gravity
      1024 // Max entities
    );
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
        imports.multicast // Pass multicast mock
    );

    // Verify state changes
    expect(target.health).toBe(80);
    expect(target.pain).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result?.take).toBe(20);

    // Kill it
    T_Damage(target as any, attacker as any, attacker as any, dir, point, dir, 100, 100, dflags, mod, imports.multicast);

    expect(target.health).toBeLessThanOrEqual(0);
    expect(target.die).toHaveBeenCalled();
  });
});
