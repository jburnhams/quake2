import { BinaryStream, ServerCommand, ConfigStringIndex, MAX_MODELS, MAX_SOUNDS, MAX_IMAGES, MAX_LIGHTSTYLES, MAX_ITEMS } from '@quake2ts/shared';
import { WorldState } from './clipper.js';
import { DemoMessageBlock } from './demoReader.js';
import { NetworkMessageParser, EntityState, U_MODEL, U_SOUND, U_EVENT, U_MODEL2, U_MODEL3, U_MODEL4, FrameData, U_REMOVE } from './parser.js';

/**
 * Optimizes a captured WorldState for a specific clip, removing unused resources
 * and entities to minimize the state size and required assets.
 */
export class WorldStateOptimizer {

    /**
     * Analyzes the clip messages and optimizes the world state.
     *
     * @param worldState The captured world state at the start of the clip
     * @param clipMessages The raw messages that make up the clip
     * @returns A new, optimized WorldState
     */
    public optimizeForClip(worldState: WorldState, clipMessages: DemoMessageBlock[]): WorldState {
        // 1. Analyze usage
        const usage = this.analyzeUsage(worldState, clipMessages);

        // 2. Filter WorldState based on usage
        return this.pruneState(worldState, usage);
    }

    private analyzeUsage(worldState: WorldState, clipMessages: DemoMessageBlock[]): UsageAnalysis {
        const usage = new UsageAnalysis();

        // 1. Mark entities active in the initial state as potential candidates
        for (const id of worldState.currentEntities.keys()) {
            usage.entityIds.add(id);
        }

        // We need to parse each block to find referenced entities and configstrings
        for (const block of clipMessages) {
             const blockData = new Uint8Array(block.data);
             const stream = new BinaryStream(blockData);

             const blockParser = new NetworkMessageParser(stream, {
                 onServerData: () => {},
                 onConfigString: (index: number, str: string) => {
                     usage.configStrings.add(index);
                 },
                 onSpawnBaseline: (ent: EntityState) => {
                     usage.entityIds.add(ent.number);
                     this.analyzeEntityState(ent, usage);
                 },
                 onFrame: (frame: FrameData) => {
                     this.analyzeFrame(frame, usage);
                 },
                 onSound: (flags: number, soundNum: number, volume?: number, attenuation?: number, offset?: number, ent?: number, pos?: any) => {
                     usage.configStrings.add(ConfigStringIndex.Sounds + soundNum);
                 },
                 onPrint: () => {},
                 onCenterPrint: () => {},
                 onStuffText: () => {},
                 onTempEntity: (type: number, pos: any, pos2?: any, dir?: any, cnt?: number, color?: number, ent?: number, srcEnt?: number, destEnt?: number) => {
                     // Temp entities often use models/sounds defined by their type.
                 },
                 onLayout: () => {},
                 onInventory: () => {},
                 onMuzzleFlash: (entityNum: number, type: number) => {
                     usage.entityIds.add(entityNum);
                 },
                 onMuzzleFlash2: (entityNum: number, type: number) => {
                     usage.entityIds.add(entityNum);
                 },
                 onDisconnect: () => {},
                 onReconnect: () => {},
                 onDownload: () => {}
             });

             blockParser.parseMessage();
        }

        // Analyze dependencies of all used entities (from start state and clip)

        // Check current entities
        for (const ent of worldState.currentEntities.values()) {
            this.analyzeEntityState(ent, usage);
        }

        // Check baselines for used entities
        for (const id of usage.entityIds) {
            const baseline = worldState.entityBaselines.get(id);
            if (baseline) {
                this.analyzeEntityState(baseline, usage);
            }
        }

        return usage;
    }

    private analyzeFrame(frame: FrameData, usage: UsageAnalysis) {
        // Player state resources
        if (frame.playerState) {
            // Check protocol for gun index vs gun_index
            // The parser interface has gun_index
            if (frame.playerState.gun_index) {
                usage.configStrings.add(ConfigStringIndex.Models + frame.playerState.gun_index);
            }
        }

        // Packet entities
        for (const ent of frame.packetEntities.entities) {
            usage.entityIds.add(ent.number);

            if (!(ent.bits & U_REMOVE)) {
                this.analyzeEntityState(ent, usage);
            }
        }
    }

    private analyzeEntityState(ent: EntityState, usage: UsageAnalysis) {
        if (ent.modelindex) usage.configStrings.add(ConfigStringIndex.Models + ent.modelindex);
        if (ent.modelindex2) usage.configStrings.add(ConfigStringIndex.Models + ent.modelindex2);
        if (ent.modelindex3) usage.configStrings.add(ConfigStringIndex.Models + ent.modelindex3);
        if (ent.modelindex4) usage.configStrings.add(ConfigStringIndex.Models + ent.modelindex4);

        if (ent.sound) {
            usage.configStrings.add(ConfigStringIndex.Sounds + ent.sound);
        }
    }

    private pruneState(worldState: WorldState, usage: UsageAnalysis): WorldState {
        const newState: WorldState = {
            ...worldState,
            configStrings: new Map(),
            entityBaselines: new Map(),
            currentEntities: new Map()
        };

        // Filter ConfigStrings
        for (const [index, str] of worldState.configStrings) {
            if (this.shouldKeepConfigString(index, usage)) {
                newState.configStrings.set(index, str);
            }
        }

        // Filter Baselines
        for (const [id, ent] of worldState.entityBaselines) {
            if (usage.entityIds.has(id)) {
                newState.entityBaselines.set(id, ent);
            }
        }

        // Filter Current Entities
        for (const [id, ent] of worldState.currentEntities) {
            if (usage.entityIds.has(id)) {
                newState.currentEntities.set(id, ent);
            }
        }

        return newState;
    }

    private shouldKeepConfigString(index: number, usage: UsageAnalysis): boolean {
        // Always keep essential configstrings
        if (index < ConfigStringIndex.Models) return true; // Server info, etc.
        if (index >= ConfigStringIndex.MaxConfigStrings) return true; // Unknown/Extension?

        // Check specific types
        if (usage.configStrings.has(index)) return true;

        // If it's a Model/Sound/Image/Item, only keep if used
        if (index >= ConfigStringIndex.Models && index < ConfigStringIndex.Sounds) {
            return usage.configStrings.has(index);
        }
        if (index >= ConfigStringIndex.Sounds && index < ConfigStringIndex.Images) {
            return usage.configStrings.has(index);
        }

        // Images (pics) are often referenced by UI or temp entities which we don't track perfectly yet.
        // Safe optimization: Keep all images? Or try to track?
        // Task says "Optimize", so we should try.
        // But UI images (HUD) are not in entity states.
        // If we drop them, HUD might break.
        // Strategy: Keep all CS_IMAGES for now to be safe, unless we track HUD usage.
        if (index >= ConfigStringIndex.Images && index < ConfigStringIndex.Lights) {
            return true; // KEEP ALL IMAGES FOR SAFE MODE
        }

        // Items are usually global?
        if (index >= ConfigStringIndex.Items && index < ConfigStringIndex.Players) {
            return true; // Keep all items metadata
        }

        // Players (UserInfo) - only keep for players in the clip?
        if (index >= ConfigStringIndex.Players && index < ConfigStringIndex.General) {
            const playerNum = index - ConfigStringIndex.Players + 1;
            return usage.entityIds.has(playerNum);
        }

        return true;
    }
}

class UsageAnalysis {
    entityIds = new Set<number>();
    configStrings = new Set<number>();
}
