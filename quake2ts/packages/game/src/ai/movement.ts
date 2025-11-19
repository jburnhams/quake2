import { angleMod, degToRad, vectorToYaw } from '@quake2ts/shared';
import type { Vec3 } from '@quake2ts/shared';
import type { Entity } from '../entities/entity.js';

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

export function ai_move(self: Entity, distance: number): void {
  walkMove(self, self.angles.y, distance);
}

export function ai_turn(self: Entity, distance: number, deltaSeconds: number): void {
  if (distance !== 0) {
    walkMove(self, self.angles.y, distance);
  }
  changeYaw(self, deltaSeconds);
}

export function ai_face(
  self: Entity,
  enemy: Entity | null,
  distance: number,
  deltaSeconds: number,
): void {
  if (enemy) {
    const toEnemy: Vec3 = {
      x: enemy.origin.x - self.origin.x,
      y: enemy.origin.y - self.origin.y,
      z: enemy.origin.z - self.origin.z,
    };
    self.ideal_yaw = vectorToYaw(toEnemy);
  }

  changeYaw(self, deltaSeconds);

  if (distance !== 0) {
    walkMove(self, self.angles.y, distance);
  }
}
