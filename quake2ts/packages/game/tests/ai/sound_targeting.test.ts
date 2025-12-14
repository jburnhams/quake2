import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, Solid, AIFlags, AttackState } from '../../src/entities/entity.js';
import { EntitySystem } from '../../src/entities/system.js';
import { findTarget } from '../../src/ai/targeting.js';
import { ai_run, ai_stand } from '../../src/ai/movement.js';
import { PlayerNoise, PNOISE_WEAPON } from '../../src/ai/noise.js';
import { createTestContext } from '../test-helpers.js';

describe('AI Sound Targeting', () => {
  let context: EntitySystem;
  let monster: Entity;
  let player: Entity;

  beforeEach(() => {
    // createTestContext returns { entities: EntitySystem, ... }
    const testContext = createTestContext({ seed: 12345 });
    context = testContext.entities;

    // Mock entities array access for iteration
    (context as any).entities = [];
    (context as any).maxClients = 1;

    // Create player
    player = context.spawn();
    player.classname = 'player';
    player.client = {
      inventory: { ammo: { counts: [], caps: [] }, ownedWeapons: new Set(), powerups: new Map(), keys: new Set(), items: new Set() },
      weaponStates: {} as any,
      pers: { connected: true } as any,
      buttons: 0,
      pm_type: 0,
      pm_time: 0,
      pm_flags: 0,
      gun_frame: 0,
      rdflags: 0,
      fov: 90
    } as any;
    player.inUse = true;
    player.health = 100;
    player.solid = Solid.BoundingBox;
    player.index = 1; // Clients are 1-based

    // Put player in context.entities at index 1
    (context.entities as any)[1] = player;

    // Create monster
    monster = context.spawn();
    monster.classname = 'monster_soldier';
    monster.monsterinfo = {
      aiflags: 0,
      last_sighting: { x: 0, y: 0, z: 0 },
      trail_time: 0,
      pausetime: 0,
      run: (self, ctx) => ai_run(self, 10, ctx),
      stand: (self, ctx) => ai_stand(self, 0, ctx)
    };
    monster.inUse = true;
    monster.health = 50;
    monster.origin = { x: 0, y: 0, z: 0 };
    monster.angles = { x: 0, y: 0, z: 0 };
    monster.ideal_yaw = 0;

    // Position player far away and hidden
    player.origin = { x: 500, y: 0, z: 0 };

    // Mock visibility to fail (hidden)
    vi.spyOn(context.imports, 'trace').mockReturnValue({
        fraction: 0.5,
        endpos: { x: 250, y: 0, z: 0 },
        ent: null,
        allsolid: false,
        startsolid: false,
        plane: null,
        surfaceFlags: 0,
        contents: 0
    });
  });

  it('should detect sound from player', () => {
    // Generate noise
    PlayerNoise(player, player.origin, PNOISE_WEAPON, context);

    // Mock trace for hearing check (areas connected)
    vi.spyOn(context.imports, 'trace').mockReturnValue({
        fraction: 1.0,
        endpos: player.origin,
        ent: null,
        allsolid: false,
        startsolid: false,
        plane: null,
        surfaceFlags: 0,
        contents: 0
    });

    // findTarget relies on updateSoundChase which relies on hearability
    // We assume default hearability passes if trace is clear or length check passes.

    const result = findTarget(monster, context.targetAwareness, context, context.trace);

    expect(result).toBe(true);
    expect(monster.enemy).toBeDefined();
    expect(monster.monsterinfo.aiflags & AIFlags.SoundTarget).toBe(AIFlags.SoundTarget);

    const noiseEnt = player.client!.player_noise_entity!;
    expect(monster.enemy).toBe(noiseEnt);
  });

  it('should move towards sound target', () => {
    // Setup sound target
    PlayerNoise(player, player.origin, PNOISE_WEAPON, context);
    vi.spyOn(context.imports, 'trace').mockReturnValue({ fraction: 1.0, endpos: player.origin } as any);
    findTarget(monster, context.targetAwareness, context, context.trace);

    expect(monster.monsterinfo.aiflags & AIFlags.SoundTarget).toBe(AIFlags.SoundTarget);

    monster.ideal_yaw = 0;
    ai_run(monster, 10, context);

    // Enemy is at 500,0,0. Monster at 0,0,0. Yaw should be 0.
    expect(monster.ideal_yaw).toBeCloseTo(0);
  });

  it('should switch to stand when reaching sound target', () => {
    // Setup
    PlayerNoise(player, player.origin, PNOISE_WEAPON, context);
    const noiseEnt = player.client!.player_noise_entity!;

    // Teleport monster to noise
    monster.origin = { ...noiseEnt.origin };

    monster.monsterinfo.aiflags |= AIFlags.SoundTarget;
    monster.enemy = noiseEnt;
    monster.monsterinfo.stand = vi.fn();

    // Reset trace to avoid collision issues
    vi.spyOn(context.imports, 'trace').mockReturnValue({ fraction: 1.0 } as any);

    // Call ai_run
    ai_run(monster, 10, context);

    // Should call stand()
    // This expects implementation of "switch to stand when reaching noise"
    expect(monster.monsterinfo.stand).toHaveBeenCalled();
    expect(monster.monsterinfo.aiflags & AIFlags.StandGround).toBe(AIFlags.StandGround);
    expect(monster.monsterinfo.aiflags & AIFlags.TempStandGround).toBe(AIFlags.TempStandGround);
  });
});
