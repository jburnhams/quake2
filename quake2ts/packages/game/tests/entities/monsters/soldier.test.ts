import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as soldierModule from '../../../src/entities/monsters/soldier.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { SpawnContext } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import {
    monster_fire_bullet,
    monster_fire_blaster,
    monster_fire_shotgun,
    monster_fire_ionripper,
    monster_fire_blueblaster,
    monster_fire_dabeam
} from '../../../src/entities/monsters/attack.js';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';
import { createPlayerEntityFactory } from '@quake2ts/test-utils/game/factories';

// Mock dependencies using shared test-utils
vi.mock('../../../src/entities/monsters/attack.js', async () => {
  const { mockMonsterAttackFunctions } = await import('@quake2ts/test-utils');
  return mockMonsterAttackFunctions;
});

describe('monster_soldier', () => {
  let sys: EntitySystem;
  let context: SpawnContext;
  let soldier: Entity;

  const {
      SP_monster_soldier,
      SP_monster_soldier_light,
      SP_monster_soldier_ssg,
      SP_monster_soldier_ripper,
      SP_monster_soldier_hypergun,
      SP_monster_soldier_lasergun
  } = soldierModule;

  beforeEach(() => {
    vi.clearAllMocks();
    const testContext = createTestContext();
    sys = testContext.entities as unknown as EntitySystem;
    context = testContext;

    soldier = new Entity(1);
  });

  it('SP_monster_soldier sets default properties (Blaster)', () => {
    SP_monster_soldier(soldier, context);
    expect(soldier.classname).toBe('');
    expect(soldier.model).toBe('models/monsters/soldier/tris.md2');
    expect(soldier.health).toBe(20);
    expect(soldier.skin).toBe(0);
    expect(soldier.solid).toBe(Solid.BoundingBox);
    expect(soldier.movetype).toBe(MoveType.Step);
    expect(soldier.monsterinfo.stand).toBeDefined();
    expect(soldier.monsterinfo.run).toBeDefined();
    expect(soldier.monsterinfo.attack).toBeDefined();
    expect(soldier.monsterinfo.idle).toBeDefined();
  });

  it('SP_monster_soldier_light sets spawnflag and lower health', () => {
    SP_monster_soldier_light(soldier, context);
    expect(soldier.spawnflags & 1).toBeTruthy(); // SOLDIER_LIGHT
    expect(soldier.health).toBe(10);
    expect(soldier.skin).toBe(0);
  });

  it('SP_monster_soldier_ssg sets spawnflag and skin', () => {
    SP_monster_soldier_ssg(soldier, context);
    expect(soldier.spawnflags & 2).toBeTruthy(); // SOLDIER_SSG
    expect(soldier.health).toBe(30);
    expect(soldier.skin).toBe(2);
  });

  it('spawnflag 4 sets Machinegun skin', () => {
    soldier.spawnflags = 4;
    SP_monster_soldier(soldier, context);
    expect(soldier.skin).toBe(4);
    expect(soldier.health).toBe(30);
  });

  // New Variant Tests

  it('SP_monster_soldier_ripper sets correct properties', () => {
    SP_monster_soldier_ripper(soldier, context);
    expect(soldier.style).toBe(1);
    expect(soldier.skin).toBe(6);
    expect(soldier.count).toBe(0); // 6 - 6
    expect(soldier.health).toBe(50);
  });

  it('SP_monster_soldier_hypergun sets correct properties', () => {
    SP_monster_soldier_hypergun(soldier, context);
    expect(soldier.style).toBe(1);
    expect(soldier.skin).toBe(8);
    expect(soldier.count).toBe(2); // 8 - 6
    expect(soldier.health).toBe(60);
  });

  it('SP_monster_soldier_lasergun sets correct properties', () => {
    SP_monster_soldier_lasergun(soldier, context);
    expect(soldier.style).toBe(1);
    expect(soldier.skin).toBe(10);
    expect(soldier.count).toBe(4); // 10 - 6
    expect(soldier.health).toBe(70);
  });

  it('attack initiates correctly', () => {
    SP_monster_soldier(soldier, context);
    soldier.monsterinfo.attack!(soldier, context.entities as any);
    expect(soldier.monsterinfo.current_move).toBeDefined();
    expect(soldier.monsterinfo.current_move?.firstframe).toBe(90);
  });

  it('machinegun attack uses burst fire', () => {
    soldier.spawnflags = 4; // Machinegun
    SP_monster_soldier(soldier, context);
    soldier.monsterinfo.attack!(soldier, context.entities as any);

    const move = soldier.monsterinfo.current_move;
    expect(move).toBeDefined();
    // Verify frames have think functions
    // Frames 4-8 relative to start (94-98)
    const frame4 = move!.frames[4];
    expect(frame4.think).toBeDefined();
  });

  it('soldier fires blaster (default)', () => {
    SP_monster_soldier(soldier, context);
    soldier.enemy = sys.spawn();
    Object.assign(soldier.enemy, createPlayerEntityFactory({
      origin: { x: 100, y: 0, z: 0 }
    }));
    soldier.origin = { x: 0, y: 0, z: 0 };

    // Simulate attack frame
    const move = soldier.monsterinfo.current_move; // undefined initially
    soldier.monsterinfo.attack!(soldier, context.entities as any);
    const attackMove = soldier.monsterinfo.current_move;

    // Frame 5 triggers fire
    const fireFrame = attackMove!.frames[5];
    if (fireFrame.think) {
        fireFrame.think(soldier, sys);
    }

    expect(monster_fire_blaster).toHaveBeenCalled();
    expect(monster_fire_shotgun).not.toHaveBeenCalled();
    expect(monster_fire_bullet).not.toHaveBeenCalled();
  });

  it('soldier fires ssg', () => {
    SP_monster_soldier_ssg(soldier, context);
    soldier.enemy = sys.spawn();
    Object.assign(soldier.enemy, createPlayerEntityFactory({
      origin: { x: 100, y: 0, z: 0 }
    }));

    soldier.monsterinfo.attack!(soldier, context.entities as any);
    const attackMove = soldier.monsterinfo.current_move;

    // Frame 5
    const fireFrame = attackMove!.frames[5];
    if (fireFrame.think) {
        fireFrame.think(soldier, sys);
    }

    expect(monster_fire_shotgun).toHaveBeenCalled();
  });

  it('soldier fires machinegun burst', () => {
    soldier.spawnflags = 4;
    SP_monster_soldier(soldier, context);
    soldier.enemy = sys.spawn();
    Object.assign(soldier.enemy, createPlayerEntityFactory({
      origin: { x: 100, y: 0, z: 0 }
    }));

    soldier.monsterinfo.attack!(soldier, context.entities as any);
    const attackMove = soldier.monsterinfo.current_move;

    // Frame 4
    const fireFrame = attackMove!.frames[4];
    if (fireFrame.think) {
        fireFrame.think(soldier, sys);
    }
    expect(monster_fire_bullet).toHaveBeenCalled();
  });

  it('soldier ripper fires ionripper', () => {
    SP_monster_soldier_ripper(soldier, context);
    soldier.enemy = sys.spawn();
    Object.assign(soldier.enemy, createPlayerEntityFactory({
      origin: { x: 100, y: 0, z: 0 }
    }));

    soldier.monsterinfo.attack!(soldier, context.entities as any);
    const attackMove = soldier.monsterinfo.current_move;

    // Frame 5
    const fireFrame = attackMove!.frames[5];
    if (fireFrame.think) {
        fireFrame.think(soldier, sys);
    }
    expect(monster_fire_ionripper).toHaveBeenCalled();
  });

  it('soldier hypergun fires blue blaster', () => {
    SP_monster_soldier_hypergun(soldier, context);
    soldier.enemy = sys.spawn();
    Object.assign(soldier.enemy, createPlayerEntityFactory({
      origin: { x: 100, y: 0, z: 0 }
    }));

    soldier.monsterinfo.attack!(soldier, context.entities as any);
    const attackMove = soldier.monsterinfo.current_move;

    // Frame 5
    const fireFrame = attackMove!.frames[5];
    if (fireFrame.think) {
        fireFrame.think(soldier, sys);
    }
    expect(monster_fire_blueblaster).toHaveBeenCalled();
  });

  it('soldier lasergun fires beam', () => {
    SP_monster_soldier_lasergun(soldier, context);
    soldier.enemy = sys.spawn();
    Object.assign(soldier.enemy, createPlayerEntityFactory({
      origin: { x: 100, y: 0, z: 0 }
    }));

    // Should use machinegun/burst frames (attack_move_mg)
    soldier.monsterinfo.attack!(soldier, context.entities as any);
    const attackMove = soldier.monsterinfo.current_move;

    // Check it uses the burst frames (frame 4)
    const fireFrame = attackMove!.frames[4];
    if (fireFrame.think) {
        fireFrame.think(soldier, sys);
    }
    expect(monster_fire_dabeam).toHaveBeenCalled();
  });

  it('soldier plays idle sound periodically', () => {
    SP_monster_soldier(soldier, context);

    // Mock RNG to trigger the sound
    vi.spyOn(sys.rng, 'frandom').mockReturnValue(0.1);

    // Execute the idle function
    soldier.monsterinfo.idle!(soldier);

    // Check if sound was played
    expect(sys.sound).toHaveBeenCalledWith(
        soldier,
        expect.anything(), // channel
        expect.stringMatching(/soldier\/idle/), // sound path
        1, // volume
        expect.anything(), // attenuation
        0
    );
  });
});
