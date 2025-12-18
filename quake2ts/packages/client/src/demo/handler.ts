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
    // New Rerelease Flags
    U_ALPHA,
    U_SCALE,
    U_INSTANCE_BITS,
    U_LOOP_VOLUME,
    U_LOOP_ATTENUATION_HIGH,
    U_OWNER_HIGH,
    U_OLD_FRAME_HIGH,
    FogData,
    DamageIndicator,
    RenderableEntity,
    applyEntityDelta
} from '@quake2ts/engine';
import {
    Vec3, ZERO_VEC3,
    G_GetPowerupStat, PowerupId,
    MZ_BLASTER, MZ_MACHINEGUN, MZ_SHOTGUN, MZ_CHAINGUN1, MZ_CHAINGUN2, MZ_CHAINGUN3,
    MZ_RAILGUN, MZ_ROCKET, MZ_GRENADE, MZ_LOGIN, MZ_LOGOUT, MZ_SSHOTGUN, MZ_BFG, MZ_HYPERBLASTER,
    angleVectors, dotVec3
} from '@quake2ts/shared';
// Import from cgame
import { PredictionState, defaultPredictionState, interpolatePredictionState, ViewEffects } from '@quake2ts/cgame';
import { PmFlag, PmType, WaterLevel } from '@quake2ts/shared';
import { PlayerInventory, WeaponId, KeyId, ArmorType } from '@quake2ts/game';
import { DEMO_ITEM_MAPPING } from './itemMapping.js';
import { ClientImports } from '../index.js';
import { buildRenderableEntities } from '../entities.js';
import { ClientConfigStrings } from '../configStrings.js';

// Constants
const MAX_CONFIGSTRINGS = 32768; // Rerelease increased limits

export interface DemoHandlerCallbacks {
    onCenterPrint?: (msg: string) => void;
    onPrint?: (level: number, msg: string) => void;
    onConfigString?: (index: number, str: string) => void;
    onLevelRestart?: () => void;
    onWaitingForPlayers?: () => void;
    onMuzzleFlash?: (ent: number, weapon: number) => void;
    onMuzzleFlash2?: (ent: number, weapon: number) => void;
    onMuzzleFlash3?: (ent: number, weapon: number) => void;
    onTempEntity?: (type: number, pos: Vec3, pos2?: Vec3, dir?: Vec3, cnt?: number, color?: number, ent?: number, srcEnt?: number, destEnt?: number) => void;
    onFog?: (data: FogData) => void;
    onDamage?: (indicators: DamageIndicator[]) => void;
    onServerData?: (protocol: number, tickRate?: number) => void;
    onLocPrint?: (flags: number, base: string, args: string[]) => void;
    onLayout?: (layout: string) => void;
}

export class ClientNetworkHandler implements NetworkMessageHandler {
    public configstrings: string[] = new Array(MAX_CONFIGSTRINGS).fill('');
    public entities: Map<number, EntityState> = new Map(); // Current frame entities
    public previousEntities: Map<number, EntityState> = new Map(); // Previous frame entities
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
        this.previousEntities.clear();
        this.baselines.clear();
        this.latestFrame = null;
        this.previousFrame = null;
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
            // Store previous entities before updating
            this.previousEntities = this.entities;
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
            applyEntityDelta(final, partial);
            newEntities.set(number, final);
        }

        this.entities = newEntities;
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
        if (this.callbacks?.onTempEntity) {
            this.callbacks.onTempEntity(type, pos, pos2, dir, cnt, color, ent, srcEnt, destEnt);
        }
    }

    onLayout(layout: string): void {
        if (this.callbacks?.onLayout) {
            this.callbacks.onLayout(layout);
        }
    }

    onInventory(inventory: number[]): void {
        this.inventory = [...inventory];
    }

    onMuzzleFlash(ent: number, weapon: number): void {
        if (this.callbacks?.onMuzzleFlash) {
            this.callbacks.onMuzzleFlash(ent, weapon);
        }
    }

    onMuzzleFlash2(ent: number, weapon: number): void {
        if (this.callbacks?.onMuzzleFlash2) {
            this.callbacks.onMuzzleFlash2(ent, weapon);
        }
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
        if (this.view) {
            // Apply damage view kick based on Quake 2's CL_ParseDamage and V_AddKick logic.
            // CL_ParseDamage calculates a directional kick to viewangles (not implemented here to avoid permanent angle modification),
            // while V_AddKick adds a temporary pitch kick (pain flinch).

            for (const ind of indicators) {
                // Use damage value directly from indicator
                const estimatedDamage = ind.damage;

                // Determine directional roll
                // Damage direction (ind.dir) is likely the vector of the attack (or from attacker to player?)
                // Assuming it represents the attack vector (velocity), or direction TO attacker.
                // Let's assume direction TO attacker (or FROM attacker to player?)
                // Quake 2 CL_ParseDamage uses (origin - cl.simorg) which is vector TO attacker (if origin is attacker pos).
                // Actually in Q2: VectorSubtract (origin, cl.simorg, v); where 'origin' is read from message.
                // MSG_ReadCoord(msg). The server sends damage origin.
                // Rerelease protocol sends a 'dir' (byte).
                // If it follows Q2 logic, 'dir' points from Player to Attacker (or Attacker to Player).
                // Let's assume it points to where the damage came FROM.

                // We need player's right vector.
                let roll = 0;
                if (this.latestFrame && this.latestFrame.playerState) {
                    const ps = this.latestFrame.playerState;
                    // Cast MutableVec3 to Vec3 for angleVectors
                    const angles: Vec3 = { x: ps.viewangles.x, y: ps.viewangles.y, z: ps.viewangles.z } as any;
                    const vectors = angleVectors(angles);
                    // Q2: cl.kick_angles[2] = damage * 0.5 * DotProduct(v, right);
                    // where v is normalized direction to damage source.
                    const side = dotVec3(ind.dir, vectors.right);
                    roll = estimatedDamage * 0.5 * side;
                }

                // Apply pitch kick to simulate pain flinch.
                // Negative pitch corresponds to looking up ("head snaps back").
                this.view.addKick({
                    pitch: -estimatedDamage * 0.5,
                    roll: roll,
                    durationMs: 200,
                });
            }
        }

        if (this.callbacks?.onDamage) {
            this.callbacks.onDamage(indicators);
        }
    }

    onLocPrint(flags: number, base: string, args: string[]): void {
        if (this.callbacks?.onLocPrint) {
            this.callbacks.onLocPrint(flags, base, args);
        }
    }

    // New Rerelease Handlers
    onLevelRestart(): void {
        if (this.callbacks?.onLevelRestart) this.callbacks.onLevelRestart();
    }

    onWaitingForPlayers(count: number): void {
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
            watertype: ps.watertype,
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
                fov: ps.fov,
                pers: {
                    connected: true,
                    inventory: [],
                    health: 100,
                    max_health: 100,
                    savedFlags: 0,
                    selected_item: 0
                }
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
            fov: ps.fov,
            renderfx: 0
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

             // Check if timeMs is alpha (0-1) or absolute time
             // We assume absolute for now if it's large, but logic above used absolute.
             // If caller passes alpha, we can handle that.
             if (timeMs <= 1.0) {
                 const previousState = this.convertFrameToPredictionState(this.previousFrame);
                 return interpolatePredictionState(previousState, latestState, Math.max(0, Math.min(1, timeMs)));
             } else if (timeMs >= previousServerTime && timeMs <= latestServerTime) {
                 const alpha = (timeMs - previousServerTime) / (latestServerTime - previousServerTime);
                 const previousState = this.convertFrameToPredictionState(this.previousFrame);
                 return interpolatePredictionState(previousState, latestState, Math.max(0, Math.min(1, alpha)));
             }
        }

        return latestState;
    }

    public getRenderableEntities(alpha: number, configStrings: ClientConfigStrings): RenderableEntity[] {
        if (!this.latestFrame) return [];
        if (!this.imports) return [];

        const latest = Array.from(this.entities.values());
        const previous = this.previousEntities.size > 0 ? this.previousEntities : latest;

        return buildRenderableEntities(
            latest,
            previous,
            alpha,
            configStrings,
            this.imports
        );
    }

    public getDemoCamera(alpha: number): { origin: Vec3, angles: Vec3, fov: number } {
        // Use getPredictionState to interpolate camera properties
        const ps = this.getPredictionState(alpha);
        return {
            origin: ps.origin,
            angles: ps.viewAngles,
            fov: ps.fov ?? 90
        };
    }

    public get latestServerFrame(): number {
        return this.latestFrame?.serverFrame ?? 0;
    }
}
