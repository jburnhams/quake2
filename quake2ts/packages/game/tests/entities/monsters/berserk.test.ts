import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_berserk } from '../../../src/entities/monsters/berserk.js';
import { Entity, DeadFlag, Solid } from '../../../src/entities/entity.js';
import { TempEntity, ServerCommand } from '@quake2ts/shared';
import { MulticastType } from '../../../src/imports.js';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';
import { createMonsterEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils/game/factories';

describe('monster_berserk', () => {
  let context: any;
  let berserk: Entity;
  let player: Entity;

  beforeEach(() => {
    const testCtx = createTestContext();
    context = testCtx.entities;

    // Setup entities
    berserk = createMonsterEntityFactory('monster_berserk', {
        index: 1,
        origin: { x: 0, y: 0, z: 0 },
        health: 240,
        max_health: 240,
        viewheight: 32,
        spawnflags: 0,
        velocity: { x: 0, y: 0, z: 0 },
        timestamp: 0,
        monsterinfo: {
            current_move: null,
        } as any,
        enemy: null
    });

    player = createPlayerEntityFactory({
        index: 2,
        origin: { x: 100, y: 0, z: 0 },
        health: 100,
        takedamage: true,
    });

    context.findByRadius = vi.fn().mockReturnValue([player]);
    context.trace.mockReturnValue({
        fraction: 1.0,
        ent: null,
        endpos: { x: 0, y: 0, z: 0 },
    });
  });

  it('should perform slam attack when landing from jump', () => {
    const spawnContext = { entities: context } as any;
    SP_monster_berserk(berserk, spawnContext);

    berserk.enemy = player;
    berserk.origin = { x: 0, y: 0, z: 0 };
    player.origin = { x: 300, y: 0, z: 0 };

    vi.spyOn(context.rng, 'frandom').mockReturnValue(0.6);

    // Ensure timestamp < timeSeconds
    berserk.timestamp = 0;
    // context.timeSeconds is 10 by default in test helper

    if (berserk.monsterinfo?.attack) {
        berserk.monsterinfo.attack(berserk, context);
    }

    const move = berserk.monsterinfo?.current_move;
    expect(move?.firstframe).toBe(87);

    const takeoffFrame = move?.frames[2];
    expect(takeoffFrame?.think?.name).toBe('berserk_jump_takeoff');

    takeoffFrame?.think?.(berserk, context);

    expect(berserk.groundentity).toBeNull();
    expect(berserk.touch).toBeDefined();
    expect(berserk.velocity.z).toBe(450);

    berserk.groundentity = { index: 0 } as any;

    const landingFrame = move?.frames[4];
    expect(landingFrame?.think?.name).toBe('berserk_check_landing');

    landingFrame?.think?.(berserk, context);

    expect(context.multicast).toHaveBeenCalledWith(
        expect.anything(),
        MulticastType.Phs,
        ServerCommand.temp_entity,
        TempEntity.BERSERK_SLAM,
        expect.anything()
    );

    expect(context.findByRadius).toHaveBeenCalled();
  });

  it('should create shockwave visual on slam', () => {
    const spawnContext = { entities: context } as any;
    SP_monster_berserk(berserk, spawnContext);

    berserk.enemy = player;
    player.origin = { x: 300, y: 0, z: 0 };
    vi.spyOn(context.rng, 'frandom').mockReturnValue(0.6);
    berserk.timestamp = 0;

    berserk.monsterinfo.attack!(berserk, context);
    const move = berserk.monsterinfo?.current_move;

    move?.frames[2].think!(berserk, context);

    berserk.groundentity = { index: 0 } as any;
    move?.frames[4].think!(berserk, context);

    expect(context.multicast).toHaveBeenCalledWith(
        expect.anything(),
        MulticastType.Phs,
        ServerCommand.temp_entity,
        TempEntity.BERSERK_SLAM,
        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number), z: expect.any(Number) })
    );
  });
});
