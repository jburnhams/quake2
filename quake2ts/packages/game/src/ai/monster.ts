import type { Entity, MonsterMove } from '../entities/entity.js';
import type { EntitySystem } from '../entities/system.js';
import { AIFlags } from './constants.js';

// Reference: game/m_monster.c

export function M_MoveFrame(self: Entity, context: EntitySystem): void {
  const move = self.monsterinfo.current_move;
  if (!move) {
    return;
  }

  if (self.frame < move.firstframe || self.frame > move.lastframe) {
    self.monsterinfo.aiflags &= ~AIFlags.HoldFrame;
    self.frame = move.firstframe;
  }

  if ((self.monsterinfo.aiflags & AIFlags.HoldFrame) !== 0) {
    return;
  }

  const index = self.frame - move.firstframe;
  const frame = move.frames[index];

  if (frame.ai) {
    frame.ai(self, frame.dist, context);
  }

  if (frame.think) {
    frame.think(self, context);
  }

  if (!self.inUse) {
    return;
  }

  self.frame++;
  if (self.frame > move.lastframe) {
    if (move.endfunc) {
      move.endfunc(self, context);
      // If endfunc changed the move, return (so we don't increment frame of new move wrongly or something?)
      // The original code returns here.
      if (self.monsterinfo.current_move !== move) {
        return;
      }
    }
  }
}

export function monster_think(self: Entity, context: EntitySystem): void {
  M_MoveFrame(self, context);

  self.nextthink = context.timeSeconds + 0.1;
}
