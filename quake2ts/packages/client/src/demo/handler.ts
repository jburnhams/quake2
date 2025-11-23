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
    U_REMOVE
} from '@quake2ts/engine';
import { Vec3, ZERO_VEC3 } from '@quake2ts/shared';
import { PredictionState, defaultPredictionState, interpolatePredictionState } from '../prediction.js';
import { PmFlag, PmType, WaterLevel } from '@quake2ts/shared';
import { PlayerInventory, WeaponId, PowerupId, KeyId, ArmorType } from '@quake2ts/game';
import { DEMO_ITEM_MAPPING } from './itemMapping.js';
import { ClientImports } from '../index.js';

// Constants
const MAX_CONFIGSTRINGS = 2048; // approximate

export interface DemoHandlerCallbacks {
    onCenterPrint?: (msg: string) => void;
    onPrint?: (level: number, msg: string) => void;
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

    onServerData(protocol: number, serverCount: number, attractLoop: number, gameDir: string, playerNum: number, levelName: string): void {
        console.log(`Demo: Server Data - Protocol: ${protocol}, Level: ${levelName}`);
        // Reset state on new server connection
        this.configstrings.fill('');
        this.entities.clear();
        this.baselines.clear();
        this.latestFrame = null;
    }

    onConfigString(index: number, str: string): void {
        this.configstrings[index] = str;
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
    }

    onCenterPrint(msg: string): void {
        if (this.callbacks?.onCenterPrint) {
            this.callbacks.onCenterPrint(msg);
        } else {
            console.log(`[Center]: ${msg}`);
        }
    }

    onStuffText(msg: string): void {
        // Should be handled by command buffer
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
            keys: new Set()
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
            }
        }

        const origin: Vec3 = { ...ps.origin };
        const velocity: Vec3 = { ...ps.velocity };
        const viewangles: Vec3 = { ...ps.viewangles };
        const deltaAngles: Vec3 = { ...ps.delta_angles };

        return {
            origin,
            velocity,
            viewangles,
            pmFlags: ps.pm_flags,
            pmType: ps.pm_type,
            waterlevel: WaterLevel.None,
            gravity: ps.gravity,
            deltaAngles,
            client: {
                inventory,
                weaponStates: {
                    states: new Map()
                }
            },
            health: ps.stats[1], // STAT_HEALTH
            armor: ps.stats[4], // STAT_ARMOR
            ammo: ps.stats[2], // STAT_AMMO
            blend: [0, 0, 0, 0], // No blend from demo frame currently (need to parse svc_playerinfo more fully)
            damageAlpha: 0, // Need to extract from renderfx/flash
            damageIndicators: []
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
}
