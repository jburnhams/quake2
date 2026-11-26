import { describe, it, expect, vi } from 'vitest';
import { createTestContext, createEntity } from '@quake2ts/test-utils';
import { SP_monster_medic } from '../../../../src/entities/monsters/medic.js';
import { DeadFlag } from '../../../../src/entities/entity.js';
import { MulticastType } from '../../../../src/imports.js';
import { ServerCommand, TempEntity } from '@quake2ts/shared';

describe('Medic Effects', () => {
  it('should trigger TE_MEDIC_CABLE_ATTACK when healing', () => {
    const context = createTestContext();
    const { entities } = context;

    // Spawn medic
    const medic = createEntity({
        index: 1,
        origin: { x: 0, y: 0, z: 0 }
    });
    SP_monster_medic(medic, context);

    // Spawn dead monster
    const deadMonster = createEntity({
        index: 2,
        deadflag: DeadFlag.Dead,
        origin: { x: 50, y: 0, z: 0 } // Close enough
    });

    // Assign enemy
    medic.enemy = deadMonster;

    medic.monsterinfo.attack!(medic); // Should set move to attack_cable_move

    entities.multicast = vi.fn();

    const move = medic.monsterinfo.current_move;
    expect(move).toBeDefined();

    const frame = move!.frames[1]; // Frame 107
    expect(frame.think).toBeDefined();

    // Execute
    if (frame.think) {
        frame.think(medic, entities);
    }

    // Verify multicast
    expect(entities.multicast).toHaveBeenCalledWith(
      expect.anything(),
      MulticastType.Pvs,
      ServerCommand.temp_entity,
      TempEntity.MEDIC_CABLE_ATTACK,
      expect.any(Number), expect.any(Number),
      expect.any(Number), expect.any(Number), expect.any(Number),
      expect.any(Number), expect.any(Number), expect.any(Number)
    );
  });
});
