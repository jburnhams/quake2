import { angleMod, degToRad, vectorToYaw } from '@quake2ts/shared';
import type { Vec3 } from '@quake2ts/shared';
import type { Entity } from '../entities/entity.js';
import { AIFlags } from './constants.js';

type MutableVec3 = { x: number; y: number; z: number };

function yawVector(yawDegrees: number, distance: number): Vec3 {
  if (distance === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  const radians = degToRad(yawDegrees);
  return {
    x: Math.cos(radians) * distance,
    y: Math.sin(radians) * distance,
    z: 0,
  };
}

/**
 * Mirror of the rerelease `M_walkmove` helper without collision.
 * Moves the entity along its yaw plane and always reports success.
 */
export function walkMove(self: Entity, yawDegrees: number, distance: number): boolean {
  const delta = yawVector(yawDegrees, distance);
  const origin = self.origin as MutableVec3;
  origin.x += delta.x;
  origin.y += delta.y;
  origin.z += delta.z;
  return true;
}

/**
 * Match the rerelease `M_ChangeYaw` turning speed rules.
 * `yaw_speed` is interpreted the same way as Quake II: degrees per tenth-second.
 */
export function changeYaw(self: Entity, deltaSeconds: number): void {
  const current = angleMod(self.angles.y);
  const ideal = self.ideal_yaw;

  if (current === ideal) {
    (self.angles as MutableVec3).y = current;
    return;
  }

  // The rerelease scales yaw_speed by (10 / tick_rate); using deltaSeconds keeps that
  // behavior across arbitrary fixed-step rates.
  const speed = self.yaw_speed * deltaSeconds * 10;

  let move = ideal - current;
  if (ideal > current) {
    if (move >= 180) move -= 360;
  } else if (move <= -180) {
    move += 360;
  }

  if (move > speed) move = speed;
  else if (move < -speed) move = -speed;

  (self.angles as MutableVec3).y = angleMod(current + move);
}

export function facingIdeal(self: Entity): boolean {
  const delta = angleMod(self.angles.y - self.ideal_yaw);
  const hasPathing = (self.monsterinfo.aiflags & AIFlags.Pathing) !== 0;

  if (hasPathing) {
    return !(delta > 5 && delta < 355);
  }

  return !(delta > 45 && delta < 315);
}

export function ai_move(self: Entity, distance: number): void {
  walkMove(self, self.angles.y, distance);
}

function setIdealYawTowards(self: Entity, target: Entity | null): void {
  if (!target) return;

  const toTarget: Vec3 = {
    x: target.origin.x - self.origin.x,
    y: target.origin.y - self.origin.y,
    z: target.origin.z - self.origin.z,
  };
  self.ideal_yaw = vectorToYaw(toTarget);
}

export function ai_stand(self: Entity, deltaSeconds: number): void {
  changeYaw(self, deltaSeconds);
}

export function ai_walk(self: Entity, distance: number, deltaSeconds: number): void {
  setIdealYawTowards(self, self.goalentity);
  changeYaw(self, deltaSeconds);

  if (distance !== 0) {
    walkMove(self, self.angles.y, distance);
  }
}

export function ai_turn(self: Entity, distance: number, deltaSeconds: number): void {
  if (distance !== 0) {
    walkMove(self, self.angles.y, distance);
  }
  changeYaw(self, deltaSeconds);
}

export function ai_run(self: Entity, distance: number, deltaSeconds: number): void {
  setIdealYawTowards(self, self.enemy ?? self.goalentity);
  changeYaw(self, deltaSeconds);

  if (distance !== 0) {
    walkMove(self, self.angles.y, distance);
  }
}

export function ai_face(
  self: Entity,
  enemy: Entity | null,
  distance: number,
  deltaSeconds: number,
): void {
  if (enemy) {
    setIdealYawTowards(self, enemy);
  }

  changeYaw(self, deltaSeconds);

  if (distance !== 0) {
    walkMove(self, self.angles.y, distance);
  }
}

export function ai_charge(self: Entity, distance: number, deltaSeconds: number): void {
  setIdealYawTowards(self, self.enemy);
  changeYaw(self, deltaSeconds);

  if (distance !== 0) {
    walkMove(self, self.angles.y, distance);
  }
}
