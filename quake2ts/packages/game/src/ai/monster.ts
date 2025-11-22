import type { Entity, MonsterMove } from '../entities/entity.js';
import { AIFlags } from './constants.js';

// Reference: game/m_monster.c

export function M_MoveFrame(self: Entity): void {
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
    frame.ai(self, frame.dist);
  }

  if (frame.think) {
    frame.think(self);
  }

  if (!self.inUse) {
    return;
  }

  self.frame++;
  if (self.frame > move.lastframe) {
    if (move.endfunc) {
      move.endfunc(self);
      // If endfunc changed the move, return (so we don't increment frame of new move wrongly or something?)
      // The original code returns here.
      if (self.monsterinfo.current_move !== move) {
        return;
      }
    }
  }
}

export function monster_think(self: Entity, context: any): void {
  M_MoveFrame(self);

  // In a real implementation, we would use `context.timeSeconds`
  // EntitySystem passes itself as context, so we look for timeSeconds property.

  const time = context && typeof context.timeSeconds === 'number'
    ? context.timeSeconds
    : self.nextthink; // Fallback if time is unavailable

  self.nextthink = time + 0.1;
}
