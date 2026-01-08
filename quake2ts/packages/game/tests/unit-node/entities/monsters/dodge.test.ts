import { describe, it, expect, vi } from 'vitest';
import { monster_done_dodge } from '../../../src/entities/monsters/common.js';
import { Entity, AiFlags, AttackState, MonsterInfo, DEFAULT_MONSTER_INFO } from '../../../src/entities/entity.js';
import { copyVec3, ZERO_VEC3 } from '@quake2ts/shared';

describe('monster_done_dodge', () => {
  it('should clear the Dodging flag', () => {
    const monsterinfo: MonsterInfo = {
      ...DEFAULT_MONSTER_INFO,
      aiflags: AiFlags.Dodging | AiFlags.StandGround,
      last_sighting: { ...ZERO_VEC3 }
    };

    const entity = {
      monsterinfo
    } as Entity;

    monster_done_dodge(entity);

    expect(entity.monsterinfo.aiflags & AiFlags.Dodging).toBe(0);
    expect(entity.monsterinfo.aiflags & AiFlags.StandGround).toBe(AiFlags.StandGround); // Should preserve other flags
  });

  it('should reset AttackState.Sliding to Straight', () => {
    const monsterinfo: MonsterInfo = {
      ...DEFAULT_MONSTER_INFO,
      aiflags: 0,
      attack_state: AttackState.Sliding,
      last_sighting: { ...ZERO_VEC3 }
    };

    const entity = {
      monsterinfo
    } as Entity;

    monster_done_dodge(entity);

    expect(entity.monsterinfo.attack_state).toBe(AttackState.Straight);
  });

  it('should not change other AttackStates', () => {
    const monsterinfo: MonsterInfo = {
      ...DEFAULT_MONSTER_INFO,
      aiflags: 0,
      attack_state: AttackState.Melee,
      last_sighting: { ...ZERO_VEC3 }
    };

    const entity = {
      monsterinfo
    } as Entity;

    monster_done_dodge(entity);

    expect(entity.monsterinfo.attack_state).toBe(AttackState.Melee);
  });
});
