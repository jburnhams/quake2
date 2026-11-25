import type { Entity } from '../entities/entity.js';
import { ServerFlags } from '../entities/entity.js';
import type { EntitySystem } from '../entities/system.js';
import { RenderFx } from '@quake2ts/shared';
import { getClipMask } from '../physics/pusher.js';
import { AIFlags } from './constants.js';
import { M_CatagorizePosition, M_CheckGround, M_WorldEffects } from './monsterStart.js';

export { M_CheckAttack_Base, M_CheckAttack } from './g_ai.js';

/**
 * M_MoveFrame (rerelease g_monster.cpp). Monsters think every server frame (40 Hz) but step
 * animation frames and run frame thinkfuncs at 10 Hz; the frame's aifunc runs every server frame
 * with its distance spread over the 10 Hz frame.
 */
export function M_MoveFrame(self: Entity, context: EntitySystem): void {
  const mi = self.monsterinfo;
  let move = mi.current_move;
  const now = context.timeSeconds;
  const frameTime = context.frameTimeSeconds || 0.025;

  self.nextthink = now + frameTime;

  // time to run next 10hz move yet?
  let runFrame = (mi.next_move_time ?? 0) <= now;

  // we asked nicely to switch frames when the timer ran up
  if (runFrame && mi.next_move && mi.current_move !== mi.next_move) {
    mi.current_move = mi.next_move;
    mi.next_move = undefined;
    move = mi.current_move;
  }

  if (!move) return;

  // no, but maybe we were explicitly forced into another move (pain, death, etc)
  if (!runFrame) runFrame = self.frame < move.firstframe || self.frame > move.lastframe;

  if (runFrame) {
    // [Paril-KEX] allow next_move and nextframe to work properly after an endfunc
    let explicitFrame = false;

    if (mi.nextframe && mi.nextframe >= move.firstframe && mi.nextframe <= move.lastframe) {
      self.frame = mi.nextframe;
      mi.nextframe = 0;
    } else {
      if (self.frame === move.lastframe && move.endfunc) {
        move.endfunc(self, context);

        if (mi.next_move) {
          mi.current_move = mi.next_move;
          mi.next_move = undefined;
          if (mi.nextframe) {
            self.frame = mi.nextframe;
            mi.nextframe = 0;
            explicitFrame = true;
          }
        }

        // regrab move, endfunc is very likely to change it
        move = mi.current_move;
        if (!move) return;

        // check for death
        if (self.svflags & ServerFlags.DeadMonster) return;
      }

      if (self.frame < move.firstframe || self.frame > move.lastframe) {
        mi.aiflags &= ~AIFlags.HoldFrame;
        self.frame = move.firstframe;
      } else if (!explicitFrame) {
        if (!(mi.aiflags & AIFlags.HoldFrame)) {
          self.frame++;
          if (self.frame > move.lastframe) self.frame = move.firstframe;
        }
      }
    }

    mi.next_move_time = mi.high_tick_rate ? now : now + 0.1;

    if (mi.nextframe && !(mi.nextframe >= move.firstframe && mi.nextframe <= move.lastframe)) mi.nextframe = 0;
  }

  // NB: frame thinkfunc can be called on the same frame as the animation changing
  const frame = move.frames[self.frame - move.firstframe];
  if (!frame) return;
  if (frame.ai) {
    if (!(mi.aiflags & AIFlags.HoldFrame)) {
      const dist = (frame.dist * (mi.scale || 1)) / (1 / (frameTime * 10));
      frame.ai(self, dist, context);
    } else {
      frame.ai(self, 0, context);
    }
  }

  if (runFrame && frame.think) frame.think(self, context);
}

/** monster_think (rerelease g_monster.cpp), without the debug kill path or M_ProcessPain. */
export function monster_think(self: Entity, context: EntitySystem): void {
  // The port's freeze effect (not in the rerelease): hold still until it thaws.
  if (self.monsterinfo.freeze_time) {
    if (self.monsterinfo.freeze_time > context.timeSeconds) {
      self.renderfx |= RenderFx.ShellBlue | RenderFx.ShellGreen;
      self.nextthink = context.timeSeconds + (context.frameTimeSeconds || 0.025);
      return;
    }
    self.monsterinfo.freeze_time = 0;
    self.renderfx &= ~(RenderFx.ShellBlue | RenderFx.ShellGreen);
  }

  M_MoveFrame(self, context);
  if (self.linkcount !== self.monsterinfo.linkcount) {
    self.monsterinfo.linkcount = self.linkcount;
    M_CheckGround(self, getClipMask(self), context);
  }
  M_CatagorizePosition(self, self.origin, context);
  M_WorldEffects(self, context);
}
