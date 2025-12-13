import { Entity } from '../entities/entity.js';
import type { EntitySystem } from '../entities/system.js';
import { TargetAwarenessState } from './targeting.js';

export const PNOISE_SELF = 0;
export const PNOISE_WEAPON = 1;
export const PNOISE_IMPACT = 2;

export function PlayerNoise(who: Entity, where: { x: number; y: number; z: number }, type: number, context: EntitySystem): void {
  // If we had a "level" object that was part of the game state, we would update it here.
  // Since we don't have a global level object yet, we need to decide where to store this state.
  // For now, let's assume EntitySystem will hold this state.

  const awareness = context.targetAwareness;
  if (!awareness) return;

  if (type === PNOISE_WEAPON) {
    if (awareness.soundEntity === who) {
      awareness.soundEntityFrame = awareness.frameNumber;
    } else {
      awareness.sound2Entity = awareness.soundEntity;
      awareness.sound2EntityFrame = awareness.soundEntityFrame;
      awareness.soundEntity = who;
      awareness.soundEntityFrame = awareness.frameNumber;
    }
  } else if (type === PNOISE_SELF) {
      // In original code:
      // if (level.sight_entity == who)
      //	 level.sight_entity_frame = level.framenum;
      // else
      //	 level.sight_client = who;
      if (awareness.sightEntity === who) {
          awareness.sightEntityFrame = awareness.frameNumber;
      } else {
          awareness.sightClient = who;
      }
  }
}
