import { describe, expect, it, vi } from 'vitest';
import { AIFlags, FL_NOTARGET, SPAWNFLAG_MONSTER_AMBUSH } from '../../src/ai/constants.js';
import { findTarget, foundTarget, huntTarget, type TargetAwarenessState } from '../../src/ai/targeting.js';
import { Entity, ServerFlags } from '../../src/entities/entity.js';

function makeEntity(index: number): Entity {
  const entity = new Entity(index);
  entity.inUse = true;
  return entity;
}

function makeLevel(): TargetAwarenessState {
  return {
    timeSeconds: 0,
    frameNumber: 0,
    sightEntity: null,
    sightEntityFrame: 0,
    soundEntity: null,
    soundEntityFrame: 0,
    sound2Entity: null,
    sound2EntityFrame: 0,
    sightClient: null,
  };
}

describe('huntTarget', () => {
  it('faces the enemy and schedules an attack window when running', () => {
    const self = makeEntity(1);
    const enemy = makeEntity(2);
    const level = makeLevel();

    enemy.origin = { x: 64, y: 0, z: 0 };
    self.enemy = enemy;

    const run = vi.fn();
    self.monsterinfo.run = run;

    huntTarget(self, level);

    expect(run).toHaveBeenCalledWith(self);
    expect(self.goalentity).toBe(enemy);
    expect(self.ideal_yaw).toBeCloseTo(0);
    expect(self.angles.y).toBeCloseTo(0);
    expect(self.attack_finished_time).toBeCloseTo(1);
  });

  it('holds position when standing ground', () => {
    const self = makeEntity(3);
    const enemy = makeEntity(4);
    const level = makeLevel();

    self.monsterinfo.aiflags |= AIFlags.StandGround;
    self.monsterinfo.stand = vi.fn();
    self.enemy = enemy;

    huntTarget(self, level);

    expect(self.monsterinfo.stand).toHaveBeenCalledWith(self);
    expect(self.attack_finished_time).toBe(0);
  });
});

describe('foundTarget', () => {
  it('records the sighting and enters combat point mode when using a combattarget', () => {
    const self = makeEntity(5);
    const enemy = makeEntity(6);
    const combatPoint = makeEntity(7);
    const level = makeLevel();

    level.frameNumber = 10;
    level.timeSeconds = 2.5;
    self.enemy = enemy;
    enemy.origin = { x: 0, y: 32, z: 0 };
    self.monsterinfo.run = vi.fn();
    self.combattarget = 'point_a';

    const pickTarget = vi.fn().mockReturnValue(combatPoint);

    foundTarget(self, level, { pickTarget });

    expect(pickTarget).toHaveBeenCalledWith('point_a');
    expect(self.goalentity).toBe(combatPoint);
    expect(self.movetarget).toBe(combatPoint);
    expect(self.combattarget).toBeUndefined();
    expect(self.monsterinfo.aiflags & AIFlags.CombatPoint).not.toBe(0);
    expect(self.monsterinfo.run).toHaveBeenCalledWith(self);
    expect(self.monsterinfo.pausetime).toBe(0);
    expect(self.monsterinfo.last_sighting).toEqual(enemy.origin);
    expect(self.trail_time).toBeCloseTo(2.5);
    expect(level.sightEntityFrame).toBe(0);
  });
});

describe('findTarget', () => {
  it('locks onto a recently seen client when visible', () => {
    const self = makeEntity(8);
    const enemy = makeEntity(9);
    const level = makeLevel();

    enemy.svflags |= ServerFlags.Player;
    enemy.origin = { x: 64, y: 0, z: 0 };
    enemy.light_level = 10;

    self.monsterinfo.run = vi.fn();
    self.monsterinfo.sight = vi.fn();

    level.sightClient = enemy;

    const acquired = findTarget(self, level);

    expect(acquired).toBe(true);
    expect(self.enemy).toBe(enemy);
    expect(self.goalentity).toBe(enemy);
    expect(self.monsterinfo.aiflags & AIFlags.SoundTarget).toBe(0);
    expect(self.show_hostile).toBeCloseTo(1);
    expect(self.monsterinfo.sight).toHaveBeenCalledWith(self, enemy);
    expect(level.sightEntity).toBe(self);
    expect(level.sightEntityFrame).toBe(level.frameNumber);
  });

  it('ignores no-target entities when scanning', () => {
    const self = makeEntity(10);
    const enemy = makeEntity(11);
    const level = makeLevel();

    enemy.flags |= FL_NOTARGET;
    enemy.light_level = 10;
    enemy.svflags |= ServerFlags.Player;
    enemy.origin = { x: 32, y: 0, z: 0 };

    level.sightClient = enemy;

    expect(findTarget(self, level)).toBe(false);
    expect(self.enemy).toBeNull();
  });

  it('rejects distant ambush sounds and honors area connectivity for hearing', () => {
    const self = makeEntity(12);
    const noisy = makeEntity(13);
    const level = makeLevel();

    self.spawnflags |= SPAWNFLAG_MONSTER_AMBUSH;
    noisy.origin = { x: 0, y: 0, z: 1500 };
    level.soundEntity = noisy;
    level.soundEntityFrame = 0;

    expect(findTarget(self, level, { canHear: () => true })).toBe(false);

    noisy.origin = { x: 0, y: 0, z: 400 };
    const canHear = vi.fn().mockReturnValue(true);
    const areasConnected = vi.fn().mockReturnValue(false);

    expect(findTarget(self, level, { canHear, areasConnected })).toBe(false);
    expect(canHear).not.toHaveBeenCalled();
  });
});
