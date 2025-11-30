import {
    NetworkMessageHandler,
    EntityState,
    FrameData,
    createEmptyEntityState,
    ProtocolPlayerState,
    U_ORIGIN1, U_ORIGIN2, U_ORIGIN3,
    U_ANGLE1, U_ANGLE2, U_ANGLE3,
    U_MODEL, U_MODEL2, U_MODEL3, U_MODEL4,
    U_FRAME8, U_FRAME16,
    U_SKIN8, U_SKIN16,
    U_EFFECTS8, U_EFFECTS16,
    U_RENDERFX8, U_RENDERFX16,
    U_OLDORIGIN,
    U_SOUND,
    U_EVENT,
    U_SOLID,
    U_REMOVE,
    // New Rerelease Flags (if available) - assuming standard delta reuse for now
    U_ALPHA,
    FogData,
    DamageIndicator
} from '@quake2ts/engine';
import {
    Vec3, ZERO_VEC3,
    G_GetPowerupStat, PowerupId,
    MZ_BLASTER, MZ_MACHINEGUN, MZ_SHOTGUN, MZ_CHAINGUN1, MZ_CHAINGUN2, MZ_CHAINGUN3,
    MZ_RAILGUN, MZ_ROCKET, MZ_GRENADE, MZ_LOGIN, MZ_LOGOUT, MZ_SSHOTGUN, MZ_BFG, MZ_HYPERBLASTER
} from '@quake2ts/shared';
// Import from cgame
import { PredictionState, defaultPredictionState, interpolatePredictionState, ViewEffects } from '@quake2ts/cgame';
import { PmFlag, PmType, WaterLevel } from '@quake2ts/shared';
import { PlayerInventory, WeaponId, KeyId, ArmorType } from '@quake2ts/game';
import { DEMO_ITEM_MAPPING } from './itemMapping.js';
import { ClientImports } from '../index.js';

// Constants
const MAX_CONFIGSTRINGS = 32768; // Rerelease increased limits

export interface DemoHandlerCallbacks {
    onCenterPrint?: (msg: string) => void;
    onPrint?: (level: number, msg: string) => void;
    onConfigString?: (index: number, str: string) => void;
    onLevelRestart?: () => void;
    onWaitingForPlayers?: () => void;
    onMuzzleFlash3?: (ent: number, weapon: number) => void;
    onFog?: (data: FogData) => void;
    onDamage?: (indicators: DamageIndicator[]) => void;
    onServerData?: (protocol: number, tickRate?: number) => void;
}

export class ClientNetworkHandler implements NetworkMessageHandler {
    public configstrings: string[] = new Array(MAX_CONFIGSTRINGS).fill('');
    public entities: Map<number, EntityState> = new Map(); // Current frame entities
    public baselines: Map<number, EntityState> = new Map();

    public previousFrame: FrameData | null = null;
    public latestFrame: FrameData | null = null;

    // Stats for HUD
    public stats: number[] = new Array(32).fill(0);
    public inventory: number[] = new Array(256).fill(0);

    private imports?: ClientImports;
    private callbacks?: DemoHandlerCallbacks;
    private view?: ViewEffects;
    private playerNum: number = 0;

    constructor(imports?: ClientImports, callbacks?: DemoHandlerCallbacks) {
        this.imports = imports;
        this.callbacks = callbacks;
    }

    setImports(imports: ClientImports) {
        this.imports = imports;
    }

    setCallbacks(callbacks: DemoHandlerCallbacks) {
        this.callbacks = callbacks;
    }

    setView(view: ViewEffects) {
        this.view = view;
    }

    onServerData(protocol: number, serverCount: number, attractLoop: number, gameDir: string, playerNum: number, levelName: string, tickRate?: number, demoType?: number): void {
        console.log(`Demo: Server Data - Protocol: ${protocol}, Level: ${levelName}, Tick: ${tickRate ?? 10}`);
        // Reset state on new server connection
        this.configstrings.fill('');
        this.entities.clear();
        this.baselines.clear();
        this.latestFrame = null;
        this.playerNum = playerNum;

        if (this.callbacks?.onServerData) {
            this.callbacks.onServerData(protocol, tickRate);
        }
    }

    onConfigString(index: number, str: string): void {
        this.configstrings[index] = str;
        if (this.callbacks?.onConfigString) {
            this.callbacks.onConfigString(index, str);
        }
    }

    onSpawnBaseline(entity: EntityState): void {
        // Deep copy to ensure baseline is preserved
        this.baselines.set(entity.number, structuredClone(entity));
    }

    onFrame(frame: FrameData): void {
        if (this.latestFrame) {
            this.previousFrame = this.latestFrame;
        }
        this.latestFrame = frame;
        this.stats = [...frame.playerState.stats];

        const packetEntities = frame.packetEntities;
        const newEntities = new Map<number, EntityState>();

        // Fix: If delta frame, copy previous entities as starting state.
        if (packetEntities.delta) {
             for (const [num, ent] of this.entities) {
                 newEntities.set(num, structuredClone(ent));
             }
        } else {
            // If not delta, we start fresh (empty newEntities)
        }

        for (const partial of packetEntities.entities) {
            if (partial.bits & U_REMOVE) {
                // Explicit removal: remove from newEntities if present
                newEntities.delete(partial.number);
                continue;
            }

            const number = partial.number;
            let source: EntityState | undefined;

            // Determine source for delta compression
            if (packetEntities.delta && this.entities.has(number)) {
                source = this.entities.get(number);
            } else if (this.baselines.has(number)) {
                source = this.baselines.get(number);
            } else {
                source = createEmptyEntityState();
            }

            // Apply delta
            const final = structuredClone(source!);
            this.applyDelta(final, partial);
            newEntities.set(number, final);
        }

        this.entities = newEntities;
    }

    private applyDelta(to: EntityState, from: EntityState): void {
        const bits = from.bits;
        to.number = from.number; // Should match

        if (bits & U_MODEL) to.modelindex = from.modelindex;
        if (bits & U_MODEL2) to.modelindex2 = from.modelindex2;
        if (bits & U_MODEL3) to.modelindex3 = from.modelindex3;
        if (bits & U_MODEL4) to.modelindex4 = from.modelindex4;

        if (bits & U_FRAME8) to.frame = from.frame;
        if (bits & U_FRAME16) to.frame = from.frame;

        if ((bits & U_SKIN8) || (bits & U_SKIN16)) to.skinnum = from.skinnum;

        if ((bits & U_EFFECTS8) || (bits & U_EFFECTS16)) to.effects = from.effects;

        if ((bits & U_RENDERFX8) || (bits & U_RENDERFX16)) to.renderfx = from.renderfx;

        if (bits & U_ORIGIN1) to.origin.x = from.origin.x;
        if (bits & U_ORIGIN2) to.origin.y = from.origin.y;
        if (bits & U_ORIGIN3) to.origin.z = from.origin.z;

        if (bits & U_ANGLE1) to.angles.x = from.angles.x;
        if (bits & U_ANGLE2) to.angles.y = from.angles.y;
        if (bits & U_ANGLE3) to.angles.z = from.angles.z;

        if (bits & U_OLDORIGIN) {
             to.old_origin.x = from.old_origin.x;
             to.old_origin.y = from.old_origin.y;
             to.old_origin.z = from.old_origin.z;
        }

        if (bits & U_SOUND) to.sound = from.sound;

        if (bits & U_EVENT) to.event = from.event;

        if (bits & U_SOLID) to.solid = from.solid;

        // Rerelease fields (simple copy if present in partial)
        // Since the parser already handled the bit reading into the fields,
        // we just need to ensure we copy the property if it was updated.
        // For now, simple copy.
        if (from.alpha !== 0) to.alpha = from.alpha;
        if (from.scale !== 0) to.scale = from.scale;
        if (from.instanceBits !== 0) to.instanceBits = from.instanceBits;
        if (from.loopVolume !== 0) to.loopVolume = from.loopVolume;
        if (from.loopAttenuation !== 0) to.loopAttenuation = from.loopAttenuation;
        if (from.owner !== 0) to.owner = from.owner;
        if (from.oldFrame !== 0) to.oldFrame = from.oldFrame;
    }

    onCenterPrint(msg: string): void {
        if (this.callbacks?.onCenterPrint) {
            this.callbacks.onCenterPrint(msg);
        } else {
            console.log(`[Center]: ${msg}`);
        }
    }

    onStuffText(msg: string): void {
        if (this.imports?.engine.cmd) {
            this.imports.engine.cmd.executeText(msg);
        }
    }

    onPrint(level: number, msg: string): void {
        if (this.callbacks?.onPrint) {
            this.callbacks.onPrint(level, msg);
        } else {
            console.log(`[Print ${level}]: ${msg}`);
        }
    }

    onSound(flags: number, soundNum: number, volume?: number, attenuation?: number, offset?: number, ent?: number, pos?: Vec3): void {
        if (!this.imports?.engine.audio) return;

        // Ensure volume/attenuation defaults if missing
        const vol = volume ?? 1.0;
        const attn = attenuation ?? 1.0;
        const timeofs = offset ?? 0;

        if (ent && ent > 0) {
             this.imports.engine.audio.sound(ent, 0, soundNum, vol, attn, timeofs);
        } else if (pos) {
             this.imports.engine.audio.positioned_sound(pos, soundNum, vol, attn);
        } else {
             // Global sound?
             // this.imports.engine.audio.play_channel(...);
        }
    }

    onTempEntity(type: number, pos: Vec3, pos2?: Vec3, dir?: Vec3, cnt?: number, color?: number, ent?: number, srcEnt?: number, destEnt?: number): void {
        // TODO: Trigger temp entities in renderer
        // The Renderer interface does not currently expose the particle system or generic temp entity spawning functions.
        // Once Renderer is updated to support particles, this can be implemented.
    }

    onLayout(layout: string): void {
    }

    onInventory(inventory: number[]): void {
        this.inventory = [...inventory];
    }

    onMuzzleFlash(ent: number, weapon: number): void {
    }

    onMuzzleFlash2(ent: number, weapon: number): void {
    }

    onMuzzleFlash3(ent: number, weapon: number): void {
        // EV_MUZZLEFLASH broadcast includes entity number.
        // We only want to add view kick if this is the local player.
        // ent is 1-based index (usually) or raw number.
        // playerNum is 0-based.
        // In Q2 server: player entities are at index `playernum + 1`.
        const isLocalPlayer = ent === (this.playerNum + 1);

        if (isLocalPlayer && this.view) {
             let pitch = 0;
             let yaw = 0;
             let roll = 0; // Not used often
             let kickOrigin: Vec3 = ZERO_VEC3;

             // Check Quad Damage scaling
             const quad = G_GetPowerupStat(this.stats, PowerupId.QuadDamage);
             const scale = quad ? 4 : 1;

             switch (weapon) {
                 case MZ_SHOTGUN:
                     pitch = -2;
                     kickOrigin = { x: -2, y: 0, z: 0 };
                     break;
                 case MZ_SSHOTGUN:
                     pitch = -4;
                     kickOrigin = { x: -4, y: 0, z: 0 };
                     break;
                 case MZ_MACHINEGUN:
                     pitch = -1;
                     yaw = (Math.random() - 0.5); // crandom
                     break;
                 case MZ_CHAINGUN1:
                 case MZ_CHAINGUN2:
                 case MZ_CHAINGUN3:
                     pitch = -0.5;
                     yaw = (Math.random() - 0.5);
                     break;
                 case MZ_RAILGUN:
                     pitch = -3;
                     kickOrigin = { x: -3, y: 0, z: 0 };
                     break;
                 case MZ_ROCKET:
                 case MZ_GRENADE:
                     pitch = -2;
                     kickOrigin = { x: -2, y: 0, z: 0 };
                     break;
                 case MZ_BFG:
                     pitch = -5;
                     kickOrigin = { x: -2, y: 0, z: 0 };
                     break;
                 case MZ_HYPERBLASTER:
                 case MZ_BLASTER:
                     pitch = -0.5;
                     break;
             }

             if (pitch !== 0 || yaw !== 0 || roll !== 0) {
                 this.view.addKick({
                     pitch: pitch * scale,
                     roll: roll * scale,
                     durationMs: 200,
                     origin: kickOrigin // Should origin be scaled? Q2 source P_AddWeaponKick only scales angles.
                     // But we have origin kick logic now. Let's assume origin kick is physical recoil and maybe doesn't scale with quad (magic damage)?
                     // P_AddWeaponKick only scales kick_angles.
                 });
             }
        }

        if (this.callbacks?.onMuzzleFlash3) {
            this.callbacks.onMuzzleFlash3(ent, weapon);
        }
    }

    onFog(data: FogData): void {
        if (this.callbacks?.onFog) {
            this.callbacks.onFog(data);
        }
    }

    onDamage(indicators: DamageIndicator[]): void {
        if (this.callbacks?.onDamage) {
            this.callbacks.onDamage(indicators);
        }
    }

    // New Rerelease Handlers (Stubbed)
    onLevelRestart(): void {
        if (this.callbacks?.onLevelRestart) this.callbacks.onLevelRestart();
    }

    onWaitingForPlayers(): void {
        if (this.callbacks?.onWaitingForPlayers) this.callbacks.onWaitingForPlayers();
    }

    onDisconnect(): void {
        console.log("Demo disconnected");
    }

    onReconnect(): void {
        console.log("Demo reconnect");
    }

    onDownload(size: number, percent: number, data?: Uint8Array): void {
    }

    private convertFrameToPredictionState(frame: FrameData): PredictionState {
        const ps = frame.playerState;

        const inventory: PlayerInventory = {
            ammo: {
                caps: [],
                counts: []
            },
            ownedWeapons: new Set(),
            armor: null,
            powerups: new Map(),
            keys: new Set(),
            items: new Set(),
        };

        // Map inventory array to PlayerInventory
        for (let i = 0; i < this.inventory.length; i++) {
            const count = this.inventory[i];
            if (count <= 0) continue;

            if (i >= DEMO_ITEM_MAPPING.length) break;

            const mapping = DEMO_ITEM_MAPPING[i];

            switch (mapping.type) {
                case 'weapon':
                    inventory.ownedWeapons.add(mapping.id);
                    break;
                case 'ammo':
                    if (!inventory.ammo.counts[mapping.id]) {
                        inventory.ammo.counts[mapping.id] = 0;
                    }
                    inventory.ammo.counts[mapping.id] = count;
                    break;
                case 'armor':
                    inventory.armor = {
                        armorType: mapping.id,
                        armorCount: count
                    };
                    break;
                case 'powerup':
                    inventory.powerups.set(mapping.id, count);
                    break;
                case 'key':
                    inventory.keys.add(mapping.id);
                    break;
                case 'health':
                    // Ignore, health is in stats
                    break;
                case 'item':
                    // Map generic items (like power armor)
                    inventory.items.add(mapping.id);
                    break;
            }
        }

        const origin: Vec3 = { ...ps.origin };
        const velocity: Vec3 = { ...ps.velocity };
        const viewAngles: Vec3 = { ...ps.viewangles };
        const deltaAngles: Vec3 = { ...ps.delta_angles };

        return {
            origin,
            velocity,
            viewAngles,
            pmFlags: ps.pm_flags,
            pmType: ps.pm_type,
            waterLevel: WaterLevel.None,
            gravity: ps.gravity,
            deltaAngles,
            client: {
                inventory,
                weaponStates: {
                    states: new Map()
                },
                buttons: 0,
                pm_type: ps.pm_type,
                pm_time: ps.pm_time,
                pm_flags: ps.pm_flags,
                gun_frame: ps.gun_frame,
                rdflags: ps.rdflags,
                fov: ps.fov
            },
            health: ps.stats[1], // STAT_HEALTH
            armor: ps.stats[4], // STAT_ARMOR
            ammo: ps.stats[2], // STAT_AMMO
            blend: [0, 0, 0, 0], // No blend from demo frame currently (need to parse svc_playerinfo more fully)
            damageAlpha: 0, // Need to extract from renderfx/flash
            damageIndicators: [],

            // Stubs
            stats: [...ps.stats],
            kick_angles: ZERO_VEC3,
            kick_origin: ZERO_VEC3,
            gunoffset: ZERO_VEC3,
            gunangles: ZERO_VEC3,
            gunindex: 0,
            onGround: false, // Infer from pmFlags?
            mins: { x: -16, y: -16, z: -24 },
            maxs: { x: 16, y: 16, z: 32 },

            // New fields
            pm_time: ps.pm_time,
            pm_type: ps.pm_type,
            pm_flags: ps.pm_flags,
            gun_frame: ps.gun_frame,
            rdflags: ps.rdflags,
            fov: ps.fov
        };
    }

    public getPredictionState(timeMs?: number): PredictionState {
        if (!this.latestFrame) return defaultPredictionState();

        const latestState = this.convertFrameToPredictionState(this.latestFrame);

        // If we have a previous frame and a timeMs, try to interpolate
        if (this.previousFrame && timeMs !== undefined) {
             // Note: This assumes 10Hz (100ms) server frames as per standard Quake 2
             // Ideally we'd have exact server times on frames
             const latestServerTime = this.latestFrame.serverFrame * 100; // ms
             const previousServerTime = this.previousFrame.serverFrame * 100; // ms

             if (timeMs >= previousServerTime && timeMs <= latestServerTime) {
                 const alpha = (timeMs - previousServerTime) / (latestServerTime - previousServerTime);
                 const previousState = this.convertFrameToPredictionState(this.previousFrame);
                 return interpolatePredictionState(previousState, latestState, Math.max(0, Math.min(1, alpha)));
             }
        }

        return latestState;
    }

    public get latestServerFrame(): number {
        return this.latestFrame?.serverFrame ?? 0;
    }
}
