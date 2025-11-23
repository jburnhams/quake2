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
import { PredictionState, defaultPredictionState } from '../prediction.js';
import { PmFlag, PmType, WaterLevel } from '@quake2ts/shared';
import { PlayerInventory, WeaponId, PowerupId, KeyId } from '@quake2ts/game';

// Constants
const MAX_CONFIGSTRINGS = 2048; // approximate

export class ClientNetworkHandler implements NetworkMessageHandler {
    public configstrings: string[] = new Array(MAX_CONFIGSTRINGS).fill('');
    public entities: Map<number, EntityState> = new Map(); // Current frame entities
    public baselines: Map<number, EntityState> = new Map();

    public latestFrame: FrameData | null = null;

    // Stats for HUD
    public stats: number[] = new Array(32).fill(0);
    public inventory: number[] = new Array(256).fill(0);

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
        console.log(`[Center]: ${msg}`);
    }

    onStuffText(msg: string): void {
    }

    onPrint(level: number, msg: string): void {
    }

    onSound(flags: number, soundNum: number, volume?: number, attenuation?: number, offset?: number, ent?: number, pos?: Vec3): void {
    }

    onTempEntity(type: number, pos: Vec3, pos2?: Vec3, dir?: Vec3, cnt?: number, color?: number, ent?: number, srcEnt?: number, destEnt?: number): void {
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
    }

    onReconnect(): void {
    }

    onDownload(size: number, percent: number, data?: Uint8Array): void {
    }

    public getPredictionState(): PredictionState {
        if (!this.latestFrame) return defaultPredictionState();

        const ps = this.latestFrame.playerState;

        // TODO: Map inventory array to PlayerInventory correctly
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

        // Cast MutableVec3 to Vec3 (readonly)
        const origin: Vec3 = { ...ps.origin };
        const velocity: Vec3 = { ...ps.velocity };
        const viewangles: Vec3 = { ...ps.viewangles };
        const deltaAngles: Vec3 = { ...ps.delta_angles };

        // TODO: Implement interpolation for smooth playback
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
        };
    }
}
