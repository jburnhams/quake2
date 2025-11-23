import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setupBrowserEnvironment } from '@quake2ts/tests/src/setup.js';
import { EntitySystem } from '../../src/entities/index.js';
import type { GameImports } from '../../src/imports.js';
import { Vec3, ServerCommand } from '@quake2ts/shared';
import { T_Damage } from '../../src/combat/damage.js';
import { DamageMod } from '../../src/combat/damageMods.js';

// Mock GameImports
const createMockGameImports = (): GameImports => ({
  trace: vi.fn(() => ({ fraction: 1.0, allsolid: false, startsolid: false, endpos: { x: 0, y: 0, z: 0 }, plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 } })),
  pointcontents: vi.fn(() => 0),
  setmodel: vi.fn(),
  configstring: vi.fn(),
  modelindex: vi.fn(() => 1),
  soundindex: vi.fn(() => 1),
  imageindex: vi.fn(() => 1),
  linkentity: vi.fn(),
  unlinkentity: vi.fn(),
  multicast: vi.fn(),
  unicast: vi.fn(),
  sound: vi.fn(),
  centerprintf: vi.fn(),
  bprint: vi.fn(),
  dprint: vi.fn(),
  error: vi.fn(),
  cvar_get: vi.fn(),
  cvar_set: vi.fn(),
  cvar_forceset: vi.fn(),
  argc: vi.fn(() => 0),
  argv: vi.fn(() => ''),
  args: vi.fn(() => ''),
  positiondms: vi.fn()
} as unknown as GameImports);

describe('Combat System Integration', () => {
  let entitySystem: EntitySystem;
  let imports: GameImports;

  beforeEach(() => {
    setupBrowserEnvironment();
    imports = createMockGameImports();
    entitySystem = new EntitySystem(
      { /* engine mocks */ } as any,
      imports,
      { x: 0, y: 0, z: -800 }, // Gravity
      1024 // Max entities
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should inflict damage and reduce health using T_Damage', () => {
    const target = entitySystem.spawn();
    target.classname = 'monster_soldier';
    target.health = 100;
    target.takedamage = true;
    target.pain = vi.fn();
    target.die = vi.fn();
    target.origin = { x: 100, y: 0, z: 0 };

    const attacker = entitySystem.spawn();
    attacker.classname = 'player';
    attacker.origin = { x: 0, y: 0, z: 0 };

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
