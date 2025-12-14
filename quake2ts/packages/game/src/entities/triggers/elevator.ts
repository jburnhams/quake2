import { Entity, MoveType, Solid, ServerFlags } from '../entity.js';
import { EntitySystem } from '../system.js';
import { SpawnRegistry } from '../spawn.js';
import { FRAME_TIME_SECONDS } from './common.js';

function trainResume(train: Entity, entities: EntitySystem): void {
  if (!train.think) {
    train.think = (self) => {
      self.nextthink = 0;
    };
  }
  entities.scheduleThink(train, entities.timeSeconds + FRAME_TIME_SECONDS);
}

function triggerElevatorUse(
  self: Entity,
  other: Entity | null,
  entities: EntitySystem,
  warn: (message: string) => void,
): void {
  if (!self.movetarget) {
    return;
  }
  if (self.movetarget.nextthink > 0) {
    return;
  }

  if (!other?.pathtarget) {
    warn('trigger_elevator used with no pathtarget');
    return;
  }

  const target = entities.pickTarget(other.pathtarget);
  if (!target) {
    warn(`trigger_elevator used with bad pathtarget: ${other.pathtarget}`);
    return;
  }

  self.movetarget.target_ent = target;
  trainResume(self.movetarget, entities);
}

function triggerElevatorInit(self: Entity, entities: EntitySystem, warn: (message: string) => void): void {
  if (!self.target) {
    warn('trigger_elevator has no target');
    return;
  }

  const target = entities.pickTarget(self.target);
  if (!target) {
    warn(`trigger_elevator unable to find target ${self.target}`);
    return;
  }

  self.movetarget = target;
  if (target.classname !== 'func_train') {
    warn(`trigger_elevator target ${self.target} is not a train`);
    return;
  }

  self.use = (entity, other, activator) =>
    triggerElevatorUse(entity, other ?? activator ?? null, entities, warn);
  self.svflags |= ServerFlags.NoClient;
}

export function registerTriggerElevator(registry: SpawnRegistry): void {
  registry.register('trigger_elevator', (entity, context) => {
    entity.think = (self) => triggerElevatorInit(self, context.entities, context.warn);
    context.entities.scheduleThink(entity, context.entities.timeSeconds + FRAME_TIME_SECONDS);
  });
}
