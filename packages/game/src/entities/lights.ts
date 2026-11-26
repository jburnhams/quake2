// light, from g_misc.cpp. A light is for qrad3, which bakes it into the lightmaps, so in the game
// it is nothing, unless it is targeted: then it has a style of its own (32 to 62, given by qrad3)
// and switching it sets that style's configstring, so every face it lit goes dark or comes back.
import { ConfigStringIndex, DEFAULT_LIGHT_STYLES, FIRST_SWITCHABLE_LIGHT_STYLE } from '@quake2ts/shared';
import type { Entity } from './entity.js';
import type { SpawnContext, SpawnRegistry } from './spawn.js';
import { MoveType, Solid } from './entity.js';

/*QUAKED light (0 1 0) (-8 -8 -8) (8 8 8) START_OFF ALLOW_IN_DM
Non-displayed light.
Default light value is 300.
Default style is 0.
If targeted, will toggle between on and off.
*/
export const SPAWNFLAG_LIGHT_START_OFF = 1;
export const SPAWNFLAG_LIGHT_ALLOW_IN_DM = 2;

/** A style_on or style_off key: empty is the default, a digit names one of the table's styles. */
function styleString(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (value[0]! >= '0' && value[0]! <= '9') return DEFAULT_LIGHT_STYLES.get(parseInt(value, 10))?.pattern ?? '';
  return value;
}

export function SP_light(self: Entity, context: SpawnContext): void {
  self.movetype = MoveType.None;
  self.solid = Solid.Not;

  // no targeted lights in deathmatch, because they cause global messages
  // (the rerelease's shadow lights, which also keep an untargeted light, are not ported)
  if (!self.targetname || (context.entities.deathmatch && !(self.spawnflags & SPAWNFLAG_LIGHT_ALLOW_IN_DM))) {
    context.free(self);
    return;
  }

  if (self.style >= FIRST_SWITCHABLE_LIGHT_STYLE) {
    // gi.get_configstring for a digit: worldspawn has set the table by now, so it is the table.
    const on = styleString(context.keyValues['style_on'], 'm');
    const off = styleString(context.keyValues['style_off'], 'a');
    const { configstring } = context.entities.imports;

    self.use = (light) => {
      if (light.spawnflags & SPAWNFLAG_LIGHT_START_OFF) {
        configstring(ConfigStringIndex.Lights + light.style, on);
        light.spawnflags &= ~SPAWNFLAG_LIGHT_START_OFF;
      } else {
        configstring(ConfigStringIndex.Lights + light.style, off);
        light.spawnflags |= SPAWNFLAG_LIGHT_START_OFF;
      }
    };

    configstring(ConfigStringIndex.Lights + self.style, self.spawnflags & SPAWNFLAG_LIGHT_START_OFF ? off : on);
  }
}

export function registerLightSpawns(registry: SpawnRegistry) {
  registry.register('light', SP_light);

  registry.register('light_mine1', (entity) => {
      entity.movetype = MoveType.None;
      entity.solid = Solid.Not;
  });

  registry.register('light_mine2', (entity) => {
      entity.movetype = MoveType.None;
      entity.solid = Solid.Not;
  });
}
