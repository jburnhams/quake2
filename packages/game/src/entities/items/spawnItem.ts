/**
 * Items as the rerelease spawns them (g_items.cpp): ED_CallSpawn finds a classname in itemlist and
 * calls SpawnItem, which precaches the item, sets its effects and glow, and leaves it to
 * droptofloor a frame later, once the solids it may stand on have spawned. Every item in itemlist
 * spawns, keys and the mission packs' items included.
 *
 * What happens when an item is touched is still the port's own pickup code (Touch_Item and the
 * Pickup_ functions are not ported yet): an item the port has no pickup for spawns, falls to the
 * floor and glows, but nothing picks it up.
 */
import { MASK_SOLID, RenderFx, angleVectors, fixStuckObjectGeneric, type Vec3 } from '@quake2ts/shared';
import { Entity, MoveType, Solid, ServerFlags } from '../entity.js';
import { EntityFlags } from '../enums.js';
import type { EntitySystem } from '../system.js';
import { ITEMLIST, ItemId, type ItemDef } from '../../items/itemlist.js';

/** IF_ flags (g_local.h item_flags_t). */
export const enum ItemFlag {
  Weapon = 1 << 0,
  Ammo = 1 << 1,
  Armor = 1 << 2,
  StayCoop = 1 << 3,
  Key = 1 << 4,
  Powerup = 1 << 5,
  NotGiveable = 1 << 6,
  Health = 1 << 7,
  Tech = 1 << 8,
  NoHaste = 1 << 9,
  NoInfiniteAmmo = 1 << 10,
  PowerupWheel = 1 << 11,
  PowerupOnOff = 1 << 12,
  NotRandom = 1 << 13,
}

const SPAWNFLAG_ITEM_TRIGGER_SPAWN = 0x1;
const SPAWNFLAG_ITEM_NO_TOUCH = 0x2;
const SPAWNFLAG_ITEM_TOSS_SPAWN = 0x4;
const SPAWNFLAG_ITEM_MAX = 0x8;
/** EV_ITEM_RESPAWN (game.h entity_event_t). */
const EV_ITEM_RESPAWN = 1;
const EF_ROTATE = 1 << 0;
const EF_BOB = 1 << 2;
/** RF_NO_LOD (game.h, Paril-KEX): never LOD. */
const RF_NO_LOD = 1 << 25;

/** ED_CallSpawn's classname hack (PMM): old names for three mission-pack items. */
export const ITEM_CLASSNAME_ALIASES: Readonly<Record<string, string>> = {
  weapon_nailgun: ITEMLIST[ItemId.IT_WEAPON_ETF_RIFLE]!.classname!,
  ammo_nails: ITEMLIST[ItemId.IT_AMMO_FLECHETTES]!.classname!,
  weapon_heatbeam: ITEMLIST[ItemId.IT_WEAPON_PLASMABEAM]!.classname!,
};

/** FindItemByClassname: the itemlist entry for a spawn classname, if it names an item. */
export function findItemByClassname(classname: string): ItemDef | undefined {
  for (const item of ITEMLIST) if (item && item.classname === classname) return item;
  return undefined;
}

/** PrecacheItem: the item's sounds, models and images, its ammo's, and its precache string, in that order. */
export function precacheItem(it: ItemDef | null | undefined, sys: EntitySystem): void {
  if (!it) return;
  if (it.pickup_sound) sys.soundIndex(it.pickup_sound);
  if (it.world_model) sys.modelIndex(it.world_model);
  if (it.view_model) sys.modelIndex(it.view_model);
  if (it.icon) sys.imageIndex(it.icon);

  // parse everything for its ammo
  if (it.ammo) {
    const ammo = ITEMLIST[it.ammo];
    if (ammo !== it) precacheItem(ammo, sys);
  }

  // parse the space seperated precache string for other items
  if (!it.precaches) return;
  for (const data of it.precaches.split(' ')) {
    if (data.length >= 64 || data.length < 5) throw new Error(`PrecacheItem: ${it.classname} has bad precache string`);
    const ext = data.slice(-3);
    if (ext === 'md2' || ext === 'sp2') sys.modelIndex(data);
    else if (ext === 'wav') sys.soundIndex(data);
    if (ext === 'pcx') sys.imageIndex(data);
  }
}

/** What the port's own pickup code gives an item: its touch (and use, for keys a trigger spawns). */
export type ItemTouch = Entity['touch'];

/** droptofloor: the item's size and model, then down at most 128 units onto what it stands on. */
export function droptofloor(ent: Entity, sys: EntitySystem): void {
  const def = ent.gitem;
  if (!def) return;
  if (ent.classname === 'item_foodcube') {
    const s = ent.scale || 1;
    ent.mins = { x: -8 * s, y: -8 * s, z: -8 * s };
    ent.maxs = { x: 8 * s, y: 8 * s, z: 8 * s };
  } else {
    ent.mins = { x: -15, y: -15, z: -15 };
    ent.maxs = { x: 15, y: 15, z: 15 };
  }

  const model = ent.model ?? def.world_model;
  if (model) {
    const mins = ent.mins;
    const maxs = ent.maxs;
    sys.setModel(ent, model);
    ent.mins = mins;
    ent.maxs = maxs;
  }
  ent.solid = Solid.Trigger;
  ent.movetype = MoveType.Toss;
  ent.touch = ent.itemTouch;

  const dest: Vec3 = { x: ent.origin.x, y: ent.origin.y, z: ent.origin.z - 128 };
  const tr = sys.trace(ent.origin, ent.mins, ent.maxs, dest, ent, MASK_SOLID);
  if (tr.startsolid) {
    const fix = fixStuckObjectGeneric({
      origin: ent.origin,
      mins: ent.mins,
      maxs: ent.maxs,
      trace: (start, mins, maxs, end) => {
        const t = sys.trace(start, mins, maxs, end, ent, ent.clipmask || MASK_SOLID);
        return { fraction: t.fraction, endpos: t.endpos, allsolid: t.allsolid, startsolid: t.startsolid, planeNormal: t.plane?.normal };
      },
    });
    if (fix.result === 'no-good-position') {
      if (ent.classname === 'item_foodcube') {
        ent.velocity = { ...ent.velocity, z: 0 };
      } else {
        sys.free(ent);
        return;
      }
    } else {
      ent.origin = { ...fix.origin };
    }
  } else {
    ent.origin = { ...tr.endpos };
  }

  if (ent.team) {
    ent.flags &= ~EntityFlags.TeamSlave;
    ent.chain = ent.teamchain;
    ent.teamchain = null;
    ent.svflags |= ServerFlags.NoClient;
    ent.solid = Solid.Not;
    if (ent === ent.teammaster) {
      ent.nextthink = sys.timeSeconds + 0.1;
      ent.think = (self) => doRespawn(self, sys);
      sys.scheduleThink(ent, ent.nextthink);
    }
  }

  if (ent.spawnflags & SPAWNFLAG_ITEM_NO_TOUCH) {
    ent.solid = Solid.BoundingBox;
    ent.touch = undefined;
    ent.effects &= ~(EF_ROTATE | EF_BOB);
    ent.renderfx &= ~RenderFx.Glow;
  }

  if (ent.spawnflags & SPAWNFLAG_ITEM_TRIGGER_SPAWN) {
    ent.svflags |= ServerFlags.NoClient;
    ent.solid = Solid.Not;
    ent.use = (self) => useItem(self, sys);
  }

  ent.watertype = sys.pointcontents(ent.origin);
  sys.linkentity(ent);
}

/** DoRespawn: an item comes back; of a team, one member chosen at random does. */
export function doRespawn(ent: Entity, sys: EntitySystem): void {
  if (ent.team) {
    const master = ent.teammaster!;
    ent.svflags |= ServerFlags.NoClient;
    ent.solid = Solid.Not;
    sys.linkentity(ent);
    let count = 0;
    for (let e: Entity | null = master; e; e = e.chain) count++;
    const choice = sys.rng.irandom(count);
    let chosen: Entity = master;
    for (let i = 0; i < choice; i++) chosen = chosen.chain!;
    ent = chosen;
  }
  ent.svflags &= ~(ServerFlags.NoClient | ServerFlags.Respawning);
  ent.solid = Solid.Trigger;
  sys.linkentity(ent);
  // send an effect
  ent.event = EV_ITEM_RESPAWN;
}

/** Item_TriggeredSpawn (g_rogue_items.cpp): an item marked to spawn later is used, and drops in. */
function itemTriggeredSpawn(self: Entity, sys: EntitySystem): void {
  self.svflags &= ~ServerFlags.NoClient;
  self.use = undefined;
  if (self.spawnflags & SPAWNFLAG_ITEM_TOSS_SPAWN) {
    self.movetype = MoveType.Toss;
    const { forward } = angleVectors(self.angles);
    self.origin = { ...self.origin, z: self.origin.z + 16 };
    self.velocity = { x: forward.x * 100, y: forward.y * 100, z: 300 };
  }
  const id = self.gitem?.id;
  if (id !== ItemId.IT_KEY_POWER_CUBE && id !== ItemId.IT_KEY_EXPLOSIVE_CHARGES) self.spawnflags &= SPAWNFLAG_ITEM_NO_TOUCH;
  droptofloor(self, sys);
}

/** SetTriggeredSpawn: set up an item to spawn in later (not power cubes or explosive charges). */
function setTriggeredSpawn(ent: Entity, sys: EntitySystem): void {
  const id = ent.gitem?.id;
  if (id === ItemId.IT_KEY_POWER_CUBE || id === ItemId.IT_KEY_EXPLOSIVE_CHARGES) return;
  ent.think = undefined;
  ent.nextthink = 0;
  ent.use = (self) => itemTriggeredSpawn(self, sys);
  ent.svflags |= ServerFlags.NoClient;
  ent.solid = Solid.Not;
}

/** Use_Item: a trigger-spawned item appears. */
function useItem(ent: Entity, sys: EntitySystem): void {
  ent.svflags &= ~ServerFlags.NoClient;
  ent.use = undefined;
  if (ent.spawnflags & SPAWNFLAG_ITEM_NO_TOUCH) {
    ent.solid = Solid.BoundingBox;
    ent.touch = undefined;
  } else {
    ent.solid = Solid.Trigger;
    ent.touch = ent.itemTouch;
  }
  sys.linkentity(ent);
}

/** SpawnItem for a single-player or coop game (deathmatch's item rules are not ported yet). */
export function spawnItem(ent: Entity, def: ItemDef, sys: EntitySystem, touch: ItemTouch): void {
  if (def.flags & ItemFlag.Key) {
    if (ent.spawnflags & SPAWNFLAG_ITEM_TRIGGER_SPAWN) {
      ent.svflags |= ServerFlags.NoClient;
      ent.solid = Solid.Not;
      ent.use = (self) => useItem(self, sys);
    }
    if (ent.spawnflags & SPAWNFLAG_ITEM_NO_TOUCH) {
      ent.solid = Solid.BoundingBox;
      ent.touch = undefined;
      ent.effects &= ~(EF_ROTATE | EF_BOB);
      ent.renderfx &= ~RenderFx.Glow;
    }
  } else if (ent.spawnflags >= SPAWNFLAG_ITEM_MAX) {
    ent.spawnflags = 0;
  }

  if (!sys.deathmatch) {
    // DM only items
    if (def.pickup === 'Pickup_Doppleganger' || def.pickup === 'Pickup_Nuke' || def.use === 'Use_Vengeance' || def.use === 'Use_Hunter') {
      sys.free(ent);
      return;
    }
  }

  // ZOID: don't spawn the flags unless CTF is on (it never is here)
  if (def.id === ItemId.IT_FLAG1 || def.id === ItemId.IT_FLAG2) {
    sys.free(ent);
    return;
  }

  // set final classname now
  ent.classname = def.classname!;

  precacheItem(def, sys);

  ent.gitem = def;
  ent.item = def.classname!;
  ent.itemTouch = touch;
  ent.nextthink = sys.timeSeconds + 0.05; // items start after other solids
  ent.think = (self) => droptofloor(self, sys);
  sys.scheduleThink(ent, ent.nextthink);
  ent.effects = def.world_model_flags;
  ent.renderfx = RenderFx.Glow | RF_NO_LOD;
  if (ent.model) sys.modelIndex(ent.model);

  if (ent.spawnflags & SPAWNFLAG_ITEM_TRIGGER_SPAWN) setTriggeredSpawn(ent, sys);
}
