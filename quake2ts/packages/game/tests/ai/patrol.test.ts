import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../../src/entities/system.js';
import { Entity, EntityFlags } from '../../src/entities/entity.js';
import { ai_walk } from '../../src/ai/movement.js';

describe('AI Patrol (path_corner)', () => {
  let system: EntitySystem;
  let monster: Entity;
  let pathCorner1: Entity;
  let pathCorner2: Entity;

  beforeEach(() => {
    // Mock system
    const gameEngineMock = {
      trace: vi.fn(),
      pointcontents: vi.fn().mockReturnValue(0),
    };
    system = new EntitySystem(gameEngineMock as any);

    // Mock targetAwareness (needed by ai_walk)
    const awareness = {
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
    Object.defineProperty(system, 'targetAwareness', {
        get: () => awareness
    });

    // Mock pickTarget to return entities by name
    system.pickTarget = vi.fn().mockImplementation((name: string) => {
        if (name === 'p1') return pathCorner1;
        if (name === 'p2') return pathCorner2;
        return null;
    });

    // Spawn entities
    monster = system.spawn();
    monster.flags |= EntityFlags.Fly;
    monster.origin = { x: 0, y: 0, z: 0 };
    monster.angles = { x: 0, y: 0, z: 0 };
    monster.monsterinfo = {
        stand: vi.fn(),
        run: vi.fn(),
        sight: vi.fn(),
        aiflags: 0
    } as any;
    monster.ideal_yaw = 0;
    monster.yaw_speed = 20;

    pathCorner1 = system.spawn();
    pathCorner1.classname = 'path_corner';
    pathCorner1.origin = { x: 100, y: 0, z: 0 };
    pathCorner1.targetname = 'p1';
    pathCorner1.target = 'p2';
    // Mins/Maxs for rangeTo check (assumed 0-size for point entity, but rangeTo uses box distance)
    pathCorner1.mins = { x: -8, y: -8, z: -8 };
    pathCorner1.maxs = { x: 8, y: 8, z: 8 };

    pathCorner2 = system.spawn();
    pathCorner2.classname = 'path_corner';
    pathCorner2.origin = { x: 200, y: 0, z: 0 };
    pathCorner2.targetname = 'p2';
    pathCorner2.mins = { x: -8, y: -8, z: -8 };
    pathCorner2.maxs = { x: 8, y: 8, z: 8 };

    // Initial setup: Monster targets pathCorner1
    monster.goalentity = pathCorner1;
    monster.movetarget = pathCorner1;
  });

  it('monster moves towards current path_corner', () => {
    // ai_walk should set ideal_yaw towards goalentity
    ai_walk(monster, 0, 0.1, system);

    // Path1 is at 100,0,0, monster at 0,0,0 -> angle 0
    expect(monster.ideal_yaw).toBe(0);
  });

  it('monster switches to next path_corner when close', () => {
    // Move monster close to pathCorner1 (< 64 units)
    // M_MoveToGoal uses strict SV_CloseEnough with passed dist.
    // If we pass 0 dist, we must be exactly there.
    monster.origin = { x: 100, y: 0, z: 0 };
    monster.mins = { x: -16, y: -16, z: -24 };
    monster.maxs = { x: 16, y: 16, z: 32 };

    // Run ai_walk
    ai_walk(monster, 0, 0.1, system);

    // Check if goalentity switched to pathCorner2
    expect(monster.goalentity).toBe(pathCorner2);
    expect(monster.goalentity?.targetname).toBe('p2');

    // Verify system.pickTarget was called with 'p2' (target of p1)
    expect(system.pickTarget).toHaveBeenCalledWith('p2');
  });

  it('monster stays on current path_corner if not close enough', () => {
    // Move monster far from pathCorner1 (> 64 units)
    monster.origin = { x: 0, y: 0, z: 0 };
    monster.mins = { x: -16, y: -16, z: -24 };
    monster.maxs = { x: 16, y: 16, z: 32 };

    // Run ai_walk
    ai_walk(monster, 0, 0.1, system);

    // Check if goalentity remains pathCorner1
    expect(monster.goalentity).toBe(pathCorner1);
  });
});
