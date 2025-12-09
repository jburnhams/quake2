import { Entity, MoveType, Solid, RenderFx } from './entity.js';
import { EntitySystem } from './system.js';

const SPAWNGROW_LIFESPAN = 1.0;

function clamp(val: number, min: number, max: number): number {
    return Math.min(Math.max(val, min), max);
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function spawngrow_think(self: Entity, context: EntitySystem): void {
  if (context.timeSeconds >= self.timestamp) {
    if (self.target_ent) {
      context.free(self.target_ent);
    }
    context.free(self);
    return;
  }

  // Rotate
  const dt = 0.1; // Default tick

  self.angles = {
      x: self.angles.x + self.avelocity.x * dt,
      y: self.angles.y + self.avelocity.y * dt,
      z: self.angles.z + self.avelocity.z * dt
  };

  const elapsed = context.timeSeconds - (self as any).teleport_time;
  const t = 1.0 - (elapsed / self.wait);

  const scaledSize = lerp(self.decel, self.accel, t);
  const scale = clamp(scaledSize / 16.0, 0.001, 8.0);

  self.monsterinfo.scale = scale;
  self.alpha = t * t;

  self.nextthink = context.timeSeconds + 0.1;
}

function SpawnGro_laser_pos(ent: Entity, context: EntitySystem): any {
    const theta = context.rng.frandom() * 2 * Math.PI;
    const phi = Math.acos((context.rng.frandom() * 2) - 1);

    const dx = Math.sin(phi) * Math.cos(theta);
    const dy = Math.sin(phi) * Math.sin(theta);
    const dz = Math.cos(phi);

    const scale = ent.owner?.monsterinfo.scale || 1.0;

    return {
        x: ent.origin.x + dx * scale * 9.0,
        y: ent.origin.y + dy * scale * 9.0,
        z: ent.origin.z + dz * scale * 9.0
    };
}

function SpawnGro_laser_think(self: Entity, context: EntitySystem): void {
    if (!self.owner) {
        context.free(self);
        return;
    }
    self.old_origin = SpawnGro_laser_pos(self, context);
    context.linkentity(self);
    self.nextthink = context.timeSeconds + 0.001; // 1ms
}

export function SpawnGrow_Spawn(context: EntitySystem, startpos: any, start_size: number, end_size: number): void {
  const ent = context.spawn();
  ent.origin = { ...startpos };

  ent.angles = {
      x: context.rng.frandom() * 360,
      y: context.rng.frandom() * 360,
      z: context.rng.frandom() * 360
  };

  ent.avelocity = {
      x: (context.rng.frandom() * 80 + 280) * 2,
      y: (context.rng.frandom() * 80 + 280) * 2,
      z: (context.rng.frandom() * 80 + 280) * 2
  };

  ent.solid = Solid.Not;
  ent.renderfx |= RenderFx.IrVisible;
  ent.movetype = MoveType.None;
  ent.classname = 'spawngro';

  // Use optional chaining for modelIndex if it might be missing from engine mock
  ent.modelindex = context.engine.modelIndex ? context.engine.modelIndex('models/items/spawngro3/tris.md2') : 0;
  ent.skin = 1;

  ent.accel = start_size;
  ent.decel = end_size;
  ent.think = spawngrow_think;

  const initialScale = clamp(start_size / 16.0, 0.001, 8.0);
  ent.monsterinfo.scale = initialScale;

  (ent as any).teleport_time = context.timeSeconds;
  ent.wait = SPAWNGROW_LIFESPAN;
  ent.timestamp = context.timeSeconds + SPAWNGROW_LIFESPAN;

  ent.nextthink = context.timeSeconds + 0.1;

  context.linkentity(ent);

  // Beam
  const beam = context.spawn();
  ent.target_ent = beam;

  beam.modelindex = 0;
  beam.renderfx = RenderFx.BeamLightning;

  beam.frame = 1;
  beam.skin = 0x30303030;
  beam.classname = 'spawngro_beam';

  // beam.angle = end_size. Stash in angles.y
  beam.angles = { ...beam.angles, y: end_size };

  beam.owner = ent;
  beam.origin = { ...ent.origin };
  beam.think = SpawnGro_laser_think;
  beam.nextthink = context.timeSeconds + 0.001;
  beam.old_origin = SpawnGro_laser_pos(beam, context);

  context.linkentity(beam);
}
