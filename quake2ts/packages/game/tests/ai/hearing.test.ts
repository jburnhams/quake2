import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../../src/entities/system.js';
import { Entity, ServerFlags } from '../../src/entities/entity.js';
import { PlayerNoise, PNOISE_WEAPON } from '../../src/ai/noise.js';
import { findTarget, TargetAwarenessState } from '../../src/ai/targeting.js';
import { TraceMask } from '../../src/ai/constants.js';

describe('AI Hearing', () => {
  let system: EntitySystem;
  let monster: Entity;
  let player: Entity;
  let awareness: TargetAwarenessState;

  beforeEach(() => {
    const gameEngineMock = {
      trace: vi.fn(),
      pointcontents: vi.fn().mockReturnValue(0),
    };
    system = new EntitySystem(gameEngineMock as any);

    // Initialize awareness state manually since we are testing AI functions directly
    awareness = {
        timeSeconds: 0,
        frameNumber: 0,
        sightEntity: null,
        sightEntityFrame: 0,
        soundEntity: null,
        soundEntityFrame: 0,
        sound2Entity: null,
        sound2EntityFrame: 0,
        sightClient: null
    };
    // Mock targetAwareness getter
    Object.defineProperty(system, 'targetAwareness', {
        get: () => awareness
    });

    monster = system.spawn();
    monster.origin = { x: 0, y: 0, z: 0 };
    monster.angles = { x: 0, y: 0, z: 0 };
    // Initialize last_sighting explicitly, as it is expected by foundTarget
    monster.monsterinfo = {
        stand: vi.fn(),
        run: vi.fn(),
        sight: vi.fn(),
        aiflags: 0,
        last_sighting: { x: 0, y: 0, z: 0 }
    } as any;

    player = system.spawn();
    player.classname = 'player';
    player.origin = { x: 100, y: 0, z: 0 };
    player.svflags |= ServerFlags.Player;
    player.light_level = 128;
    player.inUse = true;
  });

  it('PlayerNoise updates soundEntity in awareness', () => {
    PlayerNoise(player, player.origin, PNOISE_WEAPON, system);

    expect(awareness.soundEntity).toBe(player);
    expect(awareness.soundEntityFrame).toBe(awareness.frameNumber);
  });

  it('Monster hears player noise and targets them', () => {
    // 1. Setup: Monster has no enemy
    monster.enemy = null;

    // 2. Player makes noise
    PlayerNoise(player, player.origin, PNOISE_WEAPON, system);

    // 3. Mock trace to simulate NO line of sight (blocked by wall)
    // so visual check fails, but hearing check should pass
    const traceMock = vi.fn().mockReturnValue({
        fraction: 0.5, // Hit something halfway
        ent: null
    });

    // 4. Run findTarget
    // Note: We need to advance frame number so it matches soundEntityFrame if we want strict equality,
    // or just ensure they match. They default to 0.

    const result = findTarget(monster, awareness, system, traceMock, { canHear: () => true });

    // 5. Verify monster found target via sound
    expect(result).toBe(true);
    expect(monster.enemy).toBe(player);

    // Also verify ideal_yaw was updated to face noise
    expect(monster.ideal_yaw).toBe(0); // Player is at (100,0,0) so angle 0
  });

  it('Monster does not hear if too far away', () => {
    // 1. Move player very far away (> 1000 units)
    player.origin = { x: 2000, y: 0, z: 0 };

    // 2. Player makes noise
    PlayerNoise(player, player.origin, PNOISE_WEAPON, system);

    const traceMock = vi.fn().mockReturnValue({ fraction: 0, ent: null });

    const result = findTarget(monster, awareness, system, traceMock, { canHear: () => true });

    expect(result).toBe(false);
    expect(monster.enemy).toBeNull();
  });

  it('Monster does not hear if hearability hook returns false', () => {
    PlayerNoise(player, player.origin, PNOISE_WEAPON, system);

    const traceMock = vi.fn().mockReturnValue({ fraction: 0, ent: null });

    const result = findTarget(monster, awareness, system, traceMock, { canHear: () => false });

    expect(result).toBe(false);
    expect(monster.enemy).toBeNull();
  });
});
