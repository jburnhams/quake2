import { describe, expect, it } from 'vitest';
import { AIFlags } from '../../src/ai/constants.js';
import {
  ai_charge,
  ai_face,
  ai_run,
  ai_walk,
  changeYaw,
  facingIdeal,
  walkMove,
} from '../../src/ai/movement.js';
import { Entity } from '../../src/entities/entity.js';

function makeEntity(index: number): Entity {
  const entity = new Entity(index);
  entity.inUse = true;
  return entity;
}

describe('walkMove', () => {
  it('moves forward along the yaw axis without replacing origin references', () => {
    const self = makeEntity(1);
    self.angles.y = 90;
    self.origin = { x: 0, y: 0, z: 0 };

    const originRef = self.origin;
    walkMove(self, self.angles.y, 32);

    expect(self.origin).toBe(originRef);
    expect(self.origin.x).toBeCloseTo(0, 5);
    expect(self.origin.y).toBeCloseTo(32, 5);
    expect(self.origin.z).toBe(0);
  });
});

describe('changeYaw', () => {
  it('keeps yaw untouched when already aligned', () => {
    const self = makeEntity(2);
    self.angles.y = 45;
    self.ideal_yaw = 45;
    self.yaw_speed = 100;

    changeYaw(self, 0.1);
    expect(self.angles.y).toBe(45);
  });

  it('turns using the shortest arc across wraparound boundaries', () => {
    const self = makeEntity(3);
    self.angles.y = 350;
    self.ideal_yaw = 10;
    self.yaw_speed = 20; // degrees per tenth-second

    changeYaw(self, 0.1);
    expect(self.angles.y).toBeCloseTo(10);
  });

  it('clamps yaw changes to the configured speed scale', () => {
    const self = makeEntity(4);
    self.angles.y = 10;
    self.ideal_yaw = 350;
    self.yaw_speed = 10; // degrees per tenth-second

    changeYaw(self, 0.1);
    expect(self.angles.y).toBeCloseTo(0);
  });
});

describe('facingIdeal', () => {
  it('uses a wide tolerance for standard movement', () => {
    const self = makeEntity(5);
    self.angles.y = 90;
    self.ideal_yaw = 0;

    expect(facingIdeal(self)).toBe(false);

    self.angles.y = 30;
    expect(facingIdeal(self)).toBe(true);
  });

  it('tightens tolerance when pathing flag is present', () => {
    const self = makeEntity(6);
    self.angles.y = 12;
    self.ideal_yaw = 0;
    self.monsterinfo.aiflags |= AIFlags.Pathing;

    expect(facingIdeal(self)).toBe(false);

    self.angles.y = 4;
    expect(facingIdeal(self)).toBe(true);
  });
});

describe('stateful AI helpers', () => {
  it('prioritizes enemies over goals for running', () => {
    const self = makeEntity(7);
    const enemy = makeEntity(8);
    const goal = makeEntity(9);

    self.angles.y = 0;
    self.yaw_speed = 360;
    self.enemy = enemy;
    self.goalentity = goal;
    enemy.origin = { x: 0, y: 64, z: 0 };

    ai_run(self, 0, 0.1);
    expect(self.ideal_yaw).toBeCloseTo(90);
  });

  it('faces explicit enemies when requested', () => {
    const self = makeEntity(10);
    const enemy = makeEntity(11);

    self.angles.y = 0;
    self.yaw_speed = 360;
    enemy.origin = { x: -64, y: 0, z: 0 };

    ai_face(self, enemy, 0, 0.1);
    expect(self.ideal_yaw).toBeCloseTo(180);
  });

  it('tracks pathing targets while walking', () => {
    const self = makeEntity(12);
    const goal = makeEntity(13);

    self.angles.y = 0;
    self.yaw_speed = 360;
    self.goalentity = goal;
    goal.origin = { x: 64, y: 64, z: 0 };

    ai_walk(self, 0, 0.1);
    expect(self.ideal_yaw).toBeCloseTo(45);
  });

  it('chases enemies when charging', () => {
    const self = makeEntity(14);
    const enemy = makeEntity(15);

    self.angles.y = 0;
    self.yaw_speed = 360;
    self.enemy = enemy;
    enemy.origin = { x: 0, y: -128, z: 0 };

    ai_charge(self, 0, 0.1);
    expect(self.ideal_yaw).toBeCloseTo(270);
  });
});
