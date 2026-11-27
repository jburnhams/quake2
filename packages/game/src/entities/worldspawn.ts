/**
 * worldspawn, ported from the rerelease g_spawn.cpp (SP_worldspawn) and g_items.cpp (SetItemNames).
 *
 * The world spawns first, so its precaches take the first model, sound and image indexes after
 * the map's own models: every entity state the server sends names a model or sound by index, so
 * the order here is the order of the rerelease's. Not ported yet: the status bar layout
 * (G_InitStatusbar, with the HUD stats), sv_gravity from the "gravity" key (the port takes
 * gravity from its options), hub maps, goals, start items and the N64 settings.
 */
import { ConfigStringIndex, DEFAULT_LIGHT_STYLES, MAX_WHEEL_ITEMS } from '@quake2ts/shared';
import { ITEMLIST, ItemId, type ItemDef } from '../items/itemlist.js';
import { Entity, MoveType, Solid } from './entity.js';
import { ItemFlag, precacheItem } from './items/spawnItem.js';
import type { SpawnContext, SpawnRegistry } from './spawn.js';
import type { EntitySystem } from './system.js';

/** game_style_t */
const GAME_STYLE_PVE = 0;
const GAME_STYLE_FFA = 1;
/** sv_airaccelerate's default. */
const SV_AIRACCELERATE = 0;

/** G_CanDropItem (single player and coop: dm_weapons_stay does not apply). */
function canDropItem(item: ItemDef): boolean {
  return !!item.drop;
}

/** SetItemNames: item names, then the ammo, weapon and powerup wheels with their icons. */
export function setItemNames(sys: EntitySystem): void {
  const cs = (i: number, v: string) => sys.imports.configstring(i, v);
  for (let i = 0; i < ITEMLIST.length; i++) cs(ConfigStringIndex.Items + i, ITEMLIST[i]?.pickup_name ?? '');

  const ammoWheel = new Map<number, number>();
  // [Paril-KEX] set ammo wheel indices first
  let index = 0;
  for (const item of ITEMLIST) {
    if (!item || !(item.flags & ItemFlag.Ammo)) continue;
    if (index >= MAX_WHEEL_ITEMS) throw new Error('out of wheel indices');
    cs(ConfigStringIndex.WheelAmmo + index, `${item.id}|${sys.imageIndex(item.icon ?? '')}`);
    ammoWheel.set(item.id, index++);
  }
  const ammoIndex = (item: ItemDef) => (item.ammo ? (ammoWheel.get(item.ammo) ?? -1) : -1); // ammo_wheel_index is -1 off the wheel

  // set weapon wheel indices
  index = 0;
  for (const item of ITEMLIST) {
    if (!item || !(item.flags & ItemFlag.Weapon)) continue;
    if (index >= MAX_WHEEL_ITEMS) throw new Error('out of wheel indices');
    const minAmmo = item.flags & ItemFlag.Ammo ? 1 : item.quantity;
    const fields = [
      item.id,
      sys.imageIndex(item.icon ?? ''),
      ammoIndex(item),
      minAmmo,
      item.flags & ItemFlag.PowerupWheel ? 1 : 0,
      item.sort_id,
      item.quantity_warn,
      canDropItem(item) ? 1 : 0,
    ];
    cs(ConfigStringIndex.WheelWeapons + index++, fields.join('|'));
  }

  // set powerup wheel indices
  index = 0;
  for (const item of ITEMLIST) {
    if (!item || !(item.flags & ItemFlag.PowerupWheel) || item.flags & ItemFlag.Weapon) continue;
    if (index >= MAX_WHEEL_ITEMS) throw new Error('out of wheel indices');
    const fields = [item.id, sys.imageIndex(item.icon ?? ''), item.flags & ItemFlag.PowerupOnOff ? 1 : 0, item.sort_id, canDropItem(item) ? 1 : 0, ammoIndex(item)];
    cs(ConfigStringIndex.WheelPowerups + index++, fields.join('|'));
  }
}

/** fmt's "{}" for a float: the shortest form that reads back, so 0 is "0" and 1.5 is "1.5". */
const fmtFloat = (v: number) => String(Math.fround(v) === v ? v : Math.fround(v));

export function SP_worldspawn(self: Entity, context: SpawnContext): void {
  const sys = context.entities;
  const st = context.keyValues ?? {};
  const cs = (i: number, v: string) => sys.imports.configstring(i, v);
  self.classname = 'worldspawn';
  self.movetype = MoveType.Push;
  self.solid = Solid.Bsp;
  self.modelindex = 1; // MODELINDEX_WORLD
  self.gravity = 1;

  // set configstrings for items
  setItemNames(sys);

  // make some data visible to the server
  if (self.message) cs(ConfigStringIndex.Name, self.message);

  cs(ConfigStringIndex.Sky, st.sky ? st.sky : 'unit1_');
  const skyrotate = st.skyrotate ? Number.parseFloat(st.skyrotate) || 0 : 0;
  const skyautorotate = st.skyautorotate !== undefined ? Number.parseInt(st.skyautorotate, 10) || 0 : 1;
  cs(ConfigStringIndex.SkyRotate, `${fmtFloat(skyrotate)} ${skyautorotate}`);
  const axis = (st.skyaxis ?? '').split(/\s+/).filter(Boolean).map((v) => Number.parseFloat(v) || 0);
  cs(ConfigStringIndex.SkyAxis, [0, 1, 2].map((i) => fmtFloat(axis[i] ?? 0)).join(' '));

  if (st.music) cs(ConfigStringIndex.CdTrack, st.music);
  else cs(ConfigStringIndex.CdTrack, `${self.sounds}`);

  if (st.loop_count !== undefined) cs(ConfigStringIndex.CdLoopCount, `${Number.parseInt(st.loop_count, 10) || 0}`);
  else cs(ConfigStringIndex.CdLoopCount, '');

  // [Paril-KEX] (team play is not ported)
  cs(ConfigStringIndex.GameStyle, `${sys.deathmatch ? GAME_STYLE_FFA : GAME_STYLE_PVE}`);

  cs(ConfigStringIndex.MaxClients, `${sys.maxClients}`);

  // [Paril-KEX] air accel handled by game DLL now
  cs(ConfigStringIndex.AirAccel, `${SV_AIRACCELERATE}`);

  //---------------

  // help icon for statusbar
  sys.imageIndex('i_help');
  sys.imageIndex('i_health');
  sys.imageIndex('help');
  sys.imageIndex('field_3');

  sys.soundIndex('player/fry.wav'); // standing in lava / slime

  precacheItem(ITEMLIST[ItemId.IT_ITEM_COMPASS], sys);
  precacheItem(ITEMLIST[ItemId.IT_WEAPON_BLASTER], sys);

  sys.soundIndex('player/lava1.wav');
  sys.soundIndex('player/lava2.wav');

  sys.soundIndex('misc/pc_up.wav');
  sys.soundIndex('misc/talk1.wav');

  // gibs
  sys.soundIndex('misc/udeath.wav');

  sys.soundIndex('items/respawn1.wav');
  sys.soundIndex('misc/mon_power2.wav');

  // sexed sounds
  for (const sound of [
    '*death1.wav',
    '*death2.wav',
    '*death3.wav',
    '*death4.wav',
    '*fall1.wav',
    '*fall2.wav',
    '*gurp1.wav', // drowning damage
    '*gurp2.wav',
    '*jump1.wav', // player jump
    '*pain25_1.wav',
    '*pain25_2.wav',
    '*pain50_1.wav',
    '*pain50_2.wav',
    '*pain75_1.wav',
    '*pain75_2.wav',
    '*pain100_1.wav',
    '*pain100_2.wav',
    '*drown1.wav', // [Paril-KEX]
  ]) {
    sys.soundIndex(sound);
  }

  // sexed models: one model index for each distinct vwep model, in itemlist order
  const vweps = new Set<string>();
  for (const item of ITEMLIST) {
    if (!item?.vwep_model) continue;
    const key = item.vwep_model.toLowerCase();
    if (vweps.has(key)) continue;
    vweps.add(key);
    sys.modelIndex(item.vwep_model);
  }

  //-------------------

  for (const sound of [
    'player/gasp1.wav', // gasping for air
    'player/gasp2.wav', // head breaking surface, not gasping
    'player/watr_in.wav', // feet hitting water
    'player/watr_out.wav', // feet leaving water
    'player/watr_un.wav', // head going underwater
    'player/u_breath1.wav',
    'player/u_breath2.wav',
    'player/wade1.wav',
    'player/wade2.wav',
    'player/wade3.wav',
    'items/pkup.wav', // bonus item pickup
    'world/land.wav', // landing thud
    'misc/h2ohit1.wav', // landing splash
    'items/damage.wav',
    'items/protect.wav',
    'items/protect4.wav',
    'weapons/noammo.wav',
    'weapons/lowammo.wav',
    'weapons/change.wav',
    'infantry/inflies1.wav',
  ]) {
    sys.soundIndex(sound);
  }

  for (const model of [
    'models/objects/gibs/sm_meat/tris.md2',
    'models/objects/gibs/arm/tris.md2',
    'models/objects/gibs/bone/tris.md2',
    'models/objects/gibs/bone2/tris.md2',
    'models/objects/gibs/chest/tris.md2',
    'models/objects/gibs/skull/tris.md2',
    'models/objects/gibs/head2/tris.md2',
    'models/objects/gibs/sm_metal/tris.md2',
  ]) {
    sys.modelIndex(model);
  }

  sys.imageIndex('loc_ping');

  //
  // Setup light animation tables. 'a' is total darkness, 'z' is doublebright.
  // (styles 32-62 are assigned by the light program for switchable lights)
  //
  for (const [style, { pattern }] of DEFAULT_LIGHT_STYLES) cs(ConfigStringIndex.Lights + style, pattern);

  // coop respawn strings
  if (sys.coop) {
    cs(ConfigStringIndex.CONFIG_COOP_RESPAWN_STRING + 0, '$g_coop_respawn_in_combat');
    cs(ConfigStringIndex.CONFIG_COOP_RESPAWN_STRING + 1, '$g_coop_respawn_bad_area');
    cs(ConfigStringIndex.CONFIG_COOP_RESPAWN_STRING + 2, '$g_coop_respawn_blocked');
    cs(ConfigStringIndex.CONFIG_COOP_RESPAWN_STRING + 3, '$g_coop_respawn_waiting');
    cs(ConfigStringIndex.CONFIG_COOP_RESPAWN_STRING + 4, '$g_coop_respawn_no_lives');
  }
}

export function registerWorldSpawn(registry: SpawnRegistry): void {
  registry.register('worldspawn', SP_worldspawn);
}
