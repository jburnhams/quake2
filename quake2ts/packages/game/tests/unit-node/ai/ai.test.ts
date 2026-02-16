import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { EntitySystem } from '../../../src/entities/index.js';
import type { GameImports } from '../../../src/imports.js';
import { Vec3 } from '@quake2ts/shared';

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

describe('AI Integration', () => {
  let entitySystem: EntitySystem;
  let imports: GameImports;

  beforeEach(() => {
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

  it('should run AI think loop and perception', () => {
    const monster = entitySystem.spawn();
    monster.classname = 'monster_soldier';
    monster.origin = { x: 100, y: 100, z: 0 };
    monster.angles = { x: 0, y: 0, z: 0 };

    // Mock think function
    monster.think = vi.fn((self) => {
        // Re-schedule
        entitySystem.scheduleThink(self, self.timestamp + 0.1); // next think 0.1s later
    });

    // Start loop: Schedule first think at 0.1s
    // Note: timestamp starts at 0.
    entitySystem.scheduleThink(monster, 0.1);

    // Frame at 0.05: No think
    entitySystem.beginFrame(0.05);
    entitySystem.runFrame();
    expect(monster.think).not.toHaveBeenCalled();

    // Frame at 0.15: Think should run
    entitySystem.beginFrame(0.15);
    entitySystem.runFrame();
    expect(monster.think).toHaveBeenCalledTimes(1);

    // It scheduled next think at 0.15 + 0.1 = 0.25 (using current timestamp)
    // Wait, monster.think is called with `self` (monster).
    // self.timestamp might be updated by runFrame logic?
    // EntitySystem.runFrame updates `ent.timestamp = this.currentTimeSeconds` for physics entities.
    // Monsters usually use `MOVETYPE_STEP`.
    // If mock movetype is 0 (None), timestamp might not update automatically.
    // Let's manually set timestamp or ensure schedule uses timeSeconds.

    // The mock above does `self.timestamp + 0.1`.
    // If self.timestamp is 0 (default), next is 0.1.
    // But current time is 0.15. So 0.1 is already passed?
    // If scheduled time is <= current time, it runs immediately in next frame?
    // Or maybe `runDueThinks` handles it.

    // Let's use `entitySystem.timeSeconds` for robustness in mock.
    (monster.think as any).mockImplementation((self: any) => {
        entitySystem.scheduleThink(self, entitySystem.timeSeconds + 0.1);
    });

    // Frame at 0.20: No think (scheduled for 0.25)
    entitySystem.beginFrame(0.20);
    entitySystem.runFrame();
    expect(monster.think).toHaveBeenCalledTimes(1);

    // Frame at 0.30: Think should run again
    entitySystem.beginFrame(0.30);
    entitySystem.runFrame();
    expect(monster.think).toHaveBeenCalledTimes(2);
  });
});
