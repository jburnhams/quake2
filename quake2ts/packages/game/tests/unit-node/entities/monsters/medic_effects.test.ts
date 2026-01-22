import { describe, it, expect, vi } from 'vitest';
import { createTestContext } from '@quake2ts/test-utils';
import { SP_monster_medic } from '../../../../src/entities/monsters/medic';
import { Entity } from '../../../../src/entities/entity';
import { DeadFlag } from '../../../../src/entities/entity';
import { MulticastType } from '../../../../src/imports';
import { ServerCommand, TempEntity } from '@quake2ts/shared';

describe('Medic Effects', () => {
  it('should trigger TE_MEDIC_CABLE_ATTACK when healing', () => {
    const context = createTestContext();
    const { entities } = context;

    // Spawn medic
    const medic = new Entity(1);
    SP_monster_medic(medic, context);
    medic.origin = { x: 0, y: 0, z: 0 };

    // Spawn dead monster
    const deadMonster = new Entity(2);
    deadMonster.deadflag = DeadFlag.Dead;
    deadMonster.origin = { x: 50, y: 0, z: 0 }; // Close enough

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
