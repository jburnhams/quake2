import type {
  GameFrameResult,
  GameSimulation,
  FixedStepContext,
} from '@quake2ts/engine';
import type { Vec3 } from '@quake2ts/shared';
import { EntitySystem } from './entities/index.js';
import { GameFrameLoop } from './loop.js';
import { LevelClock, type LevelFrameState } from './level.js';
import { createSaveFile, applySaveFile, GameSaveFile } from './save/index.js';
import { RandomGenerator } from '@quake2ts/shared';
export * from './entities/index.js';
export * from './ai/index.js';
export * from './ai/noise.js';

const ZERO_VEC3: Vec3 = { x: 0, y: 0, z: 0 } as const;

export interface GameCreateOptions {
  gravity: Vec3;
  deathmatch?: boolean;
  coop?: boolean;
  friendlyFire?: boolean;
  skill?: number;
  rogue?: boolean;
  xatrix?: boolean;
  random?: RandomGenerator;
}

import { ServerCommand, EntityState } from '@quake2ts/shared';
import { MulticastType, GameEngine } from './imports.js';
export { MulticastType, GameEngine } from './imports.js'; // Export MulticastType

export interface GameStateSnapshot {
  readonly gravity: Vec3;
  readonly origin: Vec3;
  readonly velocity: Vec3;
  readonly viewangles: Vec3;
  readonly level: LevelFrameState;
  readonly entities: {
    readonly activeCount: number;
    readonly worldClassname: string;
  };
  readonly packetEntities: EntityState[];
  readonly pmFlags: number;
  readonly pmType: number;
  readonly waterlevel: number;
  readonly deltaAngles: Vec3;
  readonly client?: PlayerClient;
  readonly health: number;
  readonly armor: number;
  readonly ammo: number;
  readonly blend: [number, number, number, number];
  readonly pickupIcon?: string;
  readonly damageAlpha: number;
  readonly damageIndicators: any[];
  readonly stats: number[];
  readonly kick_angles: Vec3;
  readonly kick_origin: Vec3;
  readonly gunoffset: Vec3;
  readonly gunangles: Vec3;
  readonly gunindex: number;

  // New fields - using snake_case for consistency with Client/Protocol usage now
  readonly pm_time: number;
  readonly gun_frame: number;
  readonly rdflags: number;
  readonly fov: number;
  readonly renderfx: number;

  // Compatibility fields for snake_case protocol
  readonly pm_type: number;
  readonly pm_flags: number;
}

import { findPlayerStart, SelectSpawnPoint } from './entities/spawn.js';
import { player_die, player_think, player_pain } from './entities/player.js';
import { populatePlayerStats } from './entities/playerStats.js';

import { UserCommand, applyPmove, PmoveTraceResult } from '@quake2ts/shared';
import { Entity, MoveType, Solid, EntityFlags } from './entities/entity.js';

import { GameTraceResult } from './imports.js';
import { throwGibs } from './entities/gibs.js';

import { CustomEntityRegistration } from './mod.js';
export { CustomEntityRegistration, ModAPI } from './mod.js';

import { giveItem } from './inventory/index.js';
import { T_Damage, DamageFlags, DamageMod, Damageable } from './combat/index.js';

// Script hooks
import { ScriptHookRegistry, ScriptHooks } from './scripting/hooks.js';

export interface GameExports extends GameSimulation<GameStateSnapshot>, CustomEntityRegistration {
  spawnWorld(): void;
  readonly entities: EntitySystem;
  sound(entity: Entity, channel: number, sound: string, volume: number, attenuation: number, timeofs: number): void;
  soundIndex(sound: string): number;
  centerprintf(entity: Entity, message: string): void;
  readonly time: number;
  readonly deathmatch: boolean;
  readonly skill: number;
  readonly rogue: boolean;
  readonly xatrix: boolean;
  readonly coop: boolean;
  readonly friendlyFire: boolean;
  readonly random: RandomGenerator;
  trace(start: Vec3, mins: Vec3 | null, maxs: Vec3 | null, end: Vec3, passent: Entity | null, contentmask: number): GameTraceResult;
  multicast(origin: Vec3, type: MulticastType, event: ServerCommand, ...args: any[]): void;
  unicast(ent: Entity, reliable: boolean, event: ServerCommand, ...args: any[]): void;
  configstring(index: number, value: string): void;
  serverCommand(cmd: string): void;
  setLagCompensation?(active: boolean, client?: Entity, lagMs?: number): void;
  createSave(mapName: string, difficulty: number, playtimeSeconds: number): GameSaveFile;
  loadSave(save: GameSaveFile): void;
  serialize(): SerializedGameState;
  loadState(state: SerializedGameState): void;
  clientConnect(ent: Entity | null, userInfo: string): string | true;
  clientBegin(client: PlayerClient): Entity;
  clientDisconnect(ent: Entity): void;
  clientThink(ent: Entity, cmd: UserCommand): void;
  respawn(ent: Entity): void;

  // Admin/Cheat APIs
  setGodMode(enabled: boolean): void;
  setNoclip(enabled: boolean): void;
  setNotarget(enabled: boolean): void;
  giveItem(itemClassname: string): void;
  damage(amount: number): void;
  teleport(origin: Vec3): void;

  // Script Hooks
  registerHooks(hooks: ScriptHooks): () => void;
  hooks: ScriptHookRegistry;
}

export { hashGameState, hashEntitySystem } from './checksum.js';
export * from './save/index.js';
import { SerializedGameState, createSerializedGameState, applySerializedGameState } from './save/adapter.js';
export { SerializedGameState };
export * from './combat/index.js';
export * from './inventory/index.js';
import { createPlayerInventory, PlayerClient, PowerupId, WeaponId } from './inventory/index.js';
import { createPlayerWeaponStates } from './combat/index.js';

// Export these for use in dedicated server
export { createPlayerInventory } from './inventory/index.js';
export { createPlayerWeaponStates } from './combat/index.js';

import { CollisionModel } from '@quake2ts/shared';

import { GameImports } from './imports.js';
export type { GameImports }; // Export GameImports type
import { checkPlayerFlagDrop } from './modes/ctf/integration.js';
import { createDefaultSpawnRegistry, registerDefaultSpawns, SpawnRegistry } from './entities/spawn.js';

export function createGame(
  imports: Partial<GameImports>,
  engine: GameEngine,
  options: GameCreateOptions
): GameExports {
  const gravity = options.gravity;
  const deathmatch = options.deathmatch ?? false;
  const coop = options.coop ?? false;
  const friendlyFire = options.friendlyFire ?? false;
  const skill = options.skill ?? 1;
  const rogue = options.rogue ?? false;
  const xatrix = options.xatrix ?? false;
  const levelClock = new LevelClock();
  const frameLoop = new GameFrameLoop();
  const rng = options.random ?? new RandomGenerator(); // Main game RNG

  // Default trace function if not provided
  const trace = imports.trace || (() => ({
    allsolid: false,
    startsolid: false,
    fraction: 1,
    endpos: { x: 0, y: 0, z: 0 },
    plane: null,
    surfaceFlags: 0,
    contents: 0,
    ent: null,
  }));
  const pointcontents = imports.pointcontents || (() => 0);
  const multicast = imports.multicast || (() => {});
  const unicast = imports.unicast || (() => {});
  const configstring = imports.configstring || (() => {});
  const serverCommand = imports.serverCommand || (() => {});
  const linkentity = imports.linkentity; // optional, handled in wrappedLinkEntity

  const wrappedLinkEntity = (ent: Entity) => {
    // Game-side logic: update AABB from origin/mins/maxs
    ent.absmin = {
      x: ent.origin.x + ent.mins.x,
      y: ent.origin.y + ent.mins.y,
      z: ent.origin.z + ent.mins.z,
    };
    ent.absmax = {
      x: ent.origin.x + ent.maxs.x,
      y: ent.origin.y + ent.maxs.y,
      z: ent.origin.z + ent.maxs.z,
    };

    // Call engine linkentity if provided
    if (linkentity) {
        linkentity(ent);
    }
  };

  // Merge provided imports with defaults and our wrappers
  const systemImports: Partial<GameImports> = {
      ...imports,
      trace,
      pointcontents,
      linkentity: wrappedLinkEntity,
      multicast,
      unicast,
      configstring,
      serverCommand
  };

  const entities = new EntitySystem(engine, systemImports, gravity, undefined, undefined, deathmatch, skill, rng, coop);
  (entities as any)._game = {
      // Lazy proxy or partial implementation of GameExports needed by EntitySystem consumers (like weapons)
      // This is circular, so we must be careful.
      // We will assign the full gameExports object later?
      // No, gameExports is const defined below.
      // We can use a getter or assign properties later.
  };
  frameLoop.addStage('prep', (context) => {
    levelClock.tick(context);
    entities.beginFrame(levelClock.current.timeSeconds);
  });
  frameLoop.addStage('simulate', ({ deltaSeconds }) => {
    velocity = {
      x: velocity.x + gravity.x * deltaSeconds,
      y: velocity.y + gravity.y * deltaSeconds,
      z: velocity.z + gravity.z * deltaSeconds,
    };

    origin = {
      x: origin.x + velocity.x * deltaSeconds,
      y: origin.y + velocity.y * deltaSeconds,
      z: origin.z + velocity.z * deltaSeconds,
    };

    entities.runFrame();
  });

  let origin: Vec3 = { ...ZERO_VEC3 };
  let velocity: Vec3 = { ...ZERO_VEC3 };

  // Helper to calculate blend
  const calculateBlend = (player: Entity | undefined, time: number): [number, number, number, number] => {
      const blend: [number, number, number, number] = [0, 0, 0, 0];
      if (!player || !player.client) return blend;

      const inventory = player.client.inventory;
      const client = player.client;

      // Damage blend
      if ((client.damage_alpha ?? 0) > 0) {
        const da = client.damage_alpha!;
        blend[3] += da * 0.5;
        blend[0] += (client.damage_blend?.[0] ?? 1) * da;
        blend[1] += (client.damage_blend?.[1] ?? 0) * da;
        blend[2] += (client.damage_blend?.[2] ?? 0) * da;
      }

      // Powerup blends
      // Quad Damage: Blue
      if (inventory.powerups.has(PowerupId.QuadDamage)) {
           blend[2] = 1;
           blend[3] = 0.08;
      }
      // Invulnerability: Yellow/Red?
      if (inventory.powerups.has(PowerupId.Invulnerability)) {
           blend[0] = 1;
           blend[1] = 1;
           blend[3] = 0.08;
      }
      // Enviro Suit: Green
       if (inventory.powerups.has(PowerupId.EnviroSuit)) {
           blend[1] = 1;
           blend[3] = 0.08;
      }
       // Rebreather: Whiteish?
       if (inventory.powerups.has(PowerupId.Rebreather)) {
           blend[0] = 0.4;
           blend[1] = 1;
           blend[2] = 0.4;
           blend[3] = 0.04;
      }

      // Clamp alpha
      if (blend[3] > 1) blend[3] = 1;
      if (blend[3] < 0) blend[3] = 0;

      return blend;
  };

  const snapshot = (frame: number): GameFrameResult<GameStateSnapshot> => {
    const player = entities.find(e => e.classname === 'player');

    // Calculate pickup icon expiration
    let pickupIcon: string | undefined = undefined;
    if (player?.client?.inventory.pickupItem && player.client.inventory.pickupTime) {
        if (levelClock.current.timeSeconds * 1000 < player.client.inventory.pickupTime + 3000) {
            pickupIcon = player.client.inventory.pickupItem;
        }
    }

    // Collect packet entities
    const packetEntities: EntityState[] = [];
    entities.forEachEntity((ent) => {
        if (!ent.inUse || ent === player) return; // Skip player in this list if handled separately (or keep if needed for 3rd person?)
        // Usually player is sent as entity 1, but also has dedicated state.
        // For now let's include all non-player entities that have a model.
        if (ent.modelindex > 0 || ent.solid === Solid.Bsp) {
             packetEntities.push({
                 number: ent.index,
                 origin: { ...ent.origin },
                 angles: { ...ent.angles },
                 modelIndex: ent.modelindex,
                 frame: ent.frame,
                 skinNum: ent.skin,
                 effects: ent.effects,
                 renderfx: ent.renderfx,
                 solid: ent.solid,
                 sound: ent.sounds
             });
        }
    });

    return {
      frame,
      timeMs: frameLoop.time,
      state: {
        gravity: { ...gravity },
        origin: player ? { ...player.origin } : { ...origin },
        velocity: player ? { ...player.velocity } : { ...velocity },
        viewangles: player ? { ...player.angles } : { x:0, y:0, z:0 },
        level: { ...levelClock.current },
        entities: {
          activeCount: entities.activeCount,
          worldClassname: entities.world.classname,
        },
        packetEntities,
        pmFlags: player?.client?.pm_flags ?? 0,
        pmType: player?.client?.pm_type ?? 0,
        pm_time: player?.client?.pm_time ?? 0,
        waterlevel: player ? player.waterlevel : 0,
        deltaAngles: { x: 0, y: 0, z: 0 },
        client: player?.client,
        health: player?.health ?? 0,
        armor: player?.client?.inventory.armor?.armorCount ?? 0,
        ammo: player?.client?.currentAmmoCount ?? 0,
        blend: calculateBlend(player, frameLoop.time),
        pickupIcon,
        damageAlpha: player?.client?.damage_alpha ?? 0,
        damageIndicators: [],

        stats: player ? populatePlayerStats(player, levelClock.current.timeSeconds) : [],
        kick_angles: player?.client?.kick_angles ?? ZERO_VEC3,
        kick_origin: player?.client?.kick_origin ?? ZERO_VEC3,
        gunoffset: ZERO_VEC3,
        gunangles: ZERO_VEC3,
        gunindex: 0,
        gun_frame: player?.client?.gun_frame ?? 0,
        rdflags: player?.client?.rdflags ?? 0,
        fov: player?.client?.fov ?? 90,
        renderfx: player?.renderfx ?? 0,

        // Populate new compatibility fields
        pm_type: player?.client?.pm_type ?? 0,
        pm_flags: player?.client?.pm_flags ?? 0
      },
    };
  };

  const resetState = (startTimeMs: number) => {
    frameLoop.reset(startTimeMs);
    levelClock.start(startTimeMs);
    origin = { ...ZERO_VEC3 };
    velocity = { ...ZERO_VEC3 };
    entities.beginFrame(startTimeMs / 1000);
    entities.runFrame();
  };

  // Initialize SpawnRegistry
  const spawnRegistry = new SpawnRegistry();

  // Initialize ScriptHookRegistry
  const hookRegistry = new ScriptHookRegistry();

  const runPlayerMove = (player: Entity, command: UserCommand) => {
    const pcmd = {
      forwardmove: command.forwardmove,
      sidemove: command.sidemove,
      upmove: command.upmove,
      buttons: command.buttons,
      msec: command.msec,
      angles: command.angles,
    };

    const playerState = {
        origin: player.origin,
        velocity: player.velocity,
        onGround: false, // This will be calculated by pmove
        waterLevel: player.waterlevel, // Pass waterlevel
        mins: player.mins,
        maxs: player.maxs,
        damageAlpha: 0,
        damageIndicators: [],
        viewAngles: player.angles,
        blend: [0,0,0,0] as [number, number, number, number],
        // Stubs
        stats: populatePlayerStats(player, levelClock.current.timeSeconds),
        kick_angles: ZERO_VEC3,
        kick_origin: ZERO_VEC3,
        gunoffset: ZERO_VEC3,
        gunangles: ZERO_VEC3,
        gunindex: 0,
        pm_type: 0,
        pm_time: 0,
        pm_flags: 0,
        gun_frame: 0,
        rdflags: 0,
        fov: 90,
        renderfx: player.renderfx
    };

    const traceAdapter = (start: Vec3, end: Vec3) => {
      // Use passed-in entity for trace, not just 'player'
      const result = trace(start, player.mins, player.maxs, end, player, 0x10000001);
      return {
        fraction: result.fraction,
        endpos: result.endpos,
        allsolid: result.allsolid,
        startsolid: result.startsolid,
        planeNormal: result.plane?.normal,
      };
    };
    const pointContentsAdapter = (point: Vec3) => pointcontents(point);

    const newState = applyPmove(playerState, pcmd, traceAdapter, pointContentsAdapter);
    player.origin = newState.origin;
    player.velocity = newState.velocity;
    player.angles = newState.viewAngles;

    if (player.client) {
        player.client.pm_flags = newState.pm_flags;
        player.client.pm_type = newState.pm_type;
        player.client.pm_time = newState.pm_time;
    }
  };

  const gameExports: GameExports = {
    // CustomEntityRegistration implementation
    registerEntitySpawn(classname: string, spawnFunc: (entity: Entity) => void): void {
      spawnRegistry.register(classname, (entity, context) => {
          spawnFunc(entity);
      });
    },

    unregisterEntitySpawn(classname: string): void {
      spawnRegistry.unregister(classname);
    },

    getCustomEntities(): string[] {
      return Array.from(spawnRegistry.keys());
    },

    // Script hook registration
    registerHooks(hooks: ScriptHooks): () => void {
      return hookRegistry.register(hooks);
    },
    hooks: hookRegistry,

    init(startTimeMs: number) {
      resetState(startTimeMs);
      return snapshot(0);
    },
    shutdown() {
      // Trigger onMapUnload hook
      hookRegistry.onMapUnload();
    },
    spawnWorld() {
      // Trigger onMapLoad hook
      // Using world message as map name if available
      const mapName = entities.world?.message || 'unknown';
      hookRegistry.onMapLoad(mapName);

      // In Q2, spawnWorld is called to load entities from map string.
      // Here it does player spawning too for the single player mode.
      // For multiplayer, we might just spawn world entities here.
      // For now, I'll keep the existing single-player logic but handle it gracefully if called.
      const playerStart = findPlayerStart(entities);
      // We don't necessarily want to spawn a player automatically in MP unless requested
      // But since this function is also used for SP bootstrap...

      // Let's defer player spawning to clientBegin in MP context
      // Or check if we are in deathmatch/server mode.
      // For now, preserving existing behavior for SP.
      if (!deathmatch) {
           // SP logic
           const player = entities.spawn();
           player.classname = 'player';
           // ... (SP init)
           this.clientBegin({
             inventory: createPlayerInventory(),
             weaponStates: createPlayerWeaponStates(),
             buttons: 0,
             pm_type: 0,
             pm_time: 0,
             pm_flags: 0,
             gun_frame: 0,
             rdflags: 0,
             fov: 90,
             pers: {
               connected: true,
               inventory: [],
               health: 100,
               max_health: 100,
               savedFlags: 0,
               selected_item: 0
             }
           });
      }
    },
    clientConnect(ent: Entity | null, userInfo: string): string | true {
        // Basic check
        return true;
    },
    clientBegin(client: PlayerClient): Entity {
       const player = entities.spawn();
       player.client = client;
       // Initial spawn logic delegated to respawn (reusing code)
       this.respawn(player);

       player.die = (self, inflictor, attacker, damage, point, mod) => {
           // Hook: onPlayerDeath
           hookRegistry.onPlayerDeath(self, inflictor, attacker, damage);
           player_die(self, inflictor, attacker, damage, point, mod, entities);
       };

       player.pain = (self, other, kick, damage) => {
           player_pain(self, damage);
       };

       player.think = (self) => {
           player_think(self, entities);
       };
       player.nextthink = entities.timeSeconds + 0.1;
       entities.scheduleThink(player, player.nextthink);

       return player;
    },
    respawn(ent: Entity): void {
       if (!ent.client) return;

       const spawnPoint = SelectSpawnPoint(entities);
       ent.classname = 'player';
       ent.origin = spawnPoint ? { ...spawnPoint.origin } : { x: 0, y: 0, z: 0 };
       ent.angles = spawnPoint ? { ...spawnPoint.angles } : { x: 0, y: 0, z: 0 };
       ent.health = 100;
       ent.takedamage = true;
       ent.movetype = MoveType.Toss;
       ent.mins = { x: -16, y: -16, z: -24 };
       ent.maxs = { x: 16, y: 16, z: 32 };
       ent.solid = Solid.BoundingBox;
       ent.deadflag = 0; // Alive
       ent.modelindex = engine.modelIndex?.('players/male/tris.md2') || 0; // Ensure model is set

       // Reset client state
       ent.client.damage_alpha = 0;
       ent.client.damage_blend = [0, 0, 0];
       ent.client.anim_priority = 0;
       ent.client.anim_end = 0;
       ent.frame = 0; // Stand

       // Reset Inventory for Deathmatch (or initial spawn)
       if (deathmatch) {
           // In DM, reset inventory completely but give starting weapon
           ent.client.inventory = createPlayerInventory({
               weapons: [WeaponId.Blaster],
               currentWeapon: WeaponId.Blaster
           });
           // Preserve score
       } else {
           // In SP, we might want to keep inventory if this was a level transition?
           // But if it's a respawn after death in SP (which is basically level restart usually),
           // we actually reset.
           // However, existing logic might rely on inventory being passed in clientBegin.
           // If we are calling respawn from clientBegin, the inventory is already set in ent.client.
           // If we are calling respawn from death, we should probably reset inventory or reload save?
           // For now, let's assume respawn resets inventory to defaults if it's a fresh spawn or DM.

           // TODO: SP Respawn usually loads last save game.
           // If we are here in SP, it might be the initial level start.
           // If it is initial start, clientBegin passed the inventory.
           // If it is death, we shouldn't be here in SP normally (we reload).
       }

       // Link
       entities.finalizeSpawn(ent);

       // Telefrag check
       // TODO: killBox(ent);

       // Update global state for SP compatibility
       origin = { ...ent.origin };

       // Hook: onPlayerSpawn
       hookRegistry.onPlayerSpawn(ent);
    },
    clientDisconnect(ent: Entity): void {
        if (ent && ent.inUse) {
            // Free entity
            entities.free(ent);
        }
    },
    clientThink(ent: Entity, cmd: UserCommand) {
        runPlayerMove(ent, cmd);
    },
    frame(step: FixedStepContext, command?: UserCommand) {
      const context = frameLoop.advance(step);
      // Note: In MP, we should iterate all players. For SP compatibility we find 'player'.
      const player = entities.find((e) => e.classname === 'player');
      if (command && player) {
        // ... SP movement logic ...
        // In MP, this logic moves to SV_ClientThink or similar.
        // If 'command' is passed, we apply it to 'player' (SP style).
        runPlayerMove(player, command);
      }
      return snapshot(context.frame);
    },
    entities,
    sound(entity: Entity, channel: number, sound: string, volume: number, attenuation: number, timeofs: number): void {
      entities.sound(entity, channel, sound, volume, attenuation, timeofs);
    },
    soundIndex(sound: string): number {
        return entities.soundIndex(sound);
    },
    centerprintf(entity: Entity, message: string): void {
      engine.centerprintf?.(entity, message);
    },
    trace,
    deathmatch,
    skill,
    rogue,
    xatrix,
    coop,
    friendlyFire,
    multicast(origin: Vec3, type: MulticastType, event: ServerCommand, ...args: any[]): void {
      multicast(origin, type, event, ...args);
    },
    unicast(ent: Entity, reliable: boolean, event: ServerCommand, ...args: any[]): void {
      unicast(ent, reliable, event, ...args);
    },
    configstring(index: number, value: string): void {
      configstring(index, value);
    },
    serverCommand(cmd: string): void {
      serverCommand(cmd);
    },
    setLagCompensation(active: boolean, client?: Entity, lagMs?: number) {
        if (engine.setLagCompensation) {
            engine.setLagCompensation(active, client, lagMs);
        }
    },
    get time() {
      return levelClock.current.timeSeconds;
    },
    random: rng,
    createSave(mapName: string, difficulty: number, playtimeSeconds: number): GameSaveFile {
      const player = entities.find((e) => e.classname === 'player');
      return createSaveFile({
        map: mapName,
        difficulty,
        playtimeSeconds,
        levelState: levelClock.snapshot(),
        entitySystem: entities,
        rngState: rng.getState(),
        player: player?.client?.inventory,
        gameState: {
          origin: { ...origin },
          velocity: { ...velocity },
        }
      });
    },
    loadSave(save: GameSaveFile): void {
      const player = entities.find((e) => e.classname === 'player');
      applySaveFile(save, {
        levelClock,
        entitySystem: entities,
        rng,
        player: player?.client?.inventory
      });
      // After load, sync engine state
      if (save.gameState && save.gameState.origin) {
        origin = { ...(save.gameState.origin as Vec3) };
      } else {
        origin = player ? { ...player.origin } : { ...ZERO_VEC3 };
      }

      if (save.gameState && save.gameState.velocity) {
        velocity = { ...(save.gameState.velocity as Vec3) };
      } else {
        velocity = player ? { ...player.velocity } : { ...ZERO_VEC3 };
      }
      frameLoop.reset(save.level.timeSeconds * 1000);
    },
    serialize(): SerializedGameState {
      return createSerializedGameState({
        entitySystem: entities,
        levelClock,
        random: rng
      });
    },
    loadState(state: SerializedGameState): void {
      applySerializedGameState(state, {
        entitySystem: entities,
        levelClock,
        random: rng
      });
      // Sync engine state
      const player = entities.find(e => e.classname === 'player');
      if (player) {
         origin = { ...player.origin };
         velocity = { ...player.velocity };
      } else {
         origin = { ...ZERO_VEC3 };
         velocity = { ...ZERO_VEC3 };
      }
      frameLoop.reset(state.time * 1000);
    },
    setGodMode(enabled: boolean): void {
      const player = entities.find(e => e.classname === 'player');
      if (player) {
        if (enabled) {
          player.flags |= EntityFlags.GodMode;
        } else {
          player.flags &= ~EntityFlags.GodMode;
        }
      }
    },
    setNoclip(enabled: boolean): void {
      const player = entities.find(e => e.classname === 'player');
      if (player) {
        if (enabled) {
          player.movetype = MoveType.Noclip;
        } else {
          player.movetype = MoveType.Walk;
        }
      }
    },
    setNotarget(enabled: boolean): void {
      const player = entities.find(e => e.classname === 'player');
      if (player) {
        if (enabled) {
          player.flags |= EntityFlags.NoTarget;
        } else {
          player.flags &= ~EntityFlags.NoTarget;
        }
      }
    },
    giveItem(itemClassname: string): void {
      const player = entities.find(e => e.classname === 'player');
      if (player) {
        giveItem(player, itemClassname);
      }
    },
    damage(amount: number): void {
      const player = entities.find(e => e.classname === 'player');
      if (player) {
        // Apply damage to player.
        // We act as if the world (null attacker) damaged the player.
        T_Damage(player as unknown as Damageable, null, null, ZERO_VEC3, player.origin, ZERO_VEC3, amount, 0, DamageFlags.NONE, DamageMod.UNKNOWN, levelClock.current.timeSeconds, undefined, { hooks: hookRegistry });
      }
    },
    teleport(origin: Vec3): void {
      const player = entities.find(e => e.classname === 'player');
      if (player) {
         entities.unlink(player);
         player.origin = { ...origin };
         player.velocity = { ...ZERO_VEC3 };
         entities.link(player);
         // Sync engine origin if strictly single player focused with global var
         // origin = { ...player.origin };
         // velocity = { ...player.velocity };
      }
    }
  };

  // Register default spawns synchronously now that gameExports is defined
  registerDefaultSpawns(spawnRegistry, gameExports);

  entities.setSpawnRegistry(spawnRegistry);

  // Patch the circular reference
  (entities as any)._game = gameExports;

  return gameExports;
}
