import { ServerCommand, ConfigStringIndex, MAX_MODELS, MAX_SOUNDS, MAX_IMAGES, MAX_LIGHTSTYLES, MAX_ITEMS, MAX_CLIENTS } from '@quake2ts/shared';
import { WorldState } from './clipper.js';
import { Message, FrameMessage, SoundMessage, SpawnBaselineMessage } from './message.js';
import { EntityState, U_MODEL, U_MODEL2, U_MODEL3, U_MODEL4, U_SOUND } from './parser.js';

export class WorldStateOptimizer {

    /**
     * Optimizes the WorldState for a specific clip by removing unreferenced resources and entities.
     *
     * @param worldState The initial state at the start of the clip.
     * @param clipMessages The parsed messages from the clip.
     * @returns A new optimized WorldState.
     */
    public optimizeForClip(worldState: WorldState, clipMessages: Message[]): WorldState {
        // 1. Identify all referenced Entity IDs and ConfigString Indices
        const referencedEntities = new Set<number>();
        const referencedConfigStrings = new Set<number>();

        // Helper to mark config string as used
        const markConfigString = (index: number) => {
            if (index >= 0 && index < ConfigStringIndex.MaxConfigStrings) {
                referencedConfigStrings.add(index);
            }
        };

        // Helper to mark entity dependencies
        const analyzeEntityState = (ent: EntityState) => {
            referencedEntities.add(ent.number);

            // Models
            if (ent.modelIndex > 0) markConfigString(ConfigStringIndex.Models + ent.modelIndex);
            if (ent.modelIndex2 && ent.modelIndex2 > 0) markConfigString(ConfigStringIndex.Models + ent.modelIndex2);
            if (ent.modelIndex3 && ent.modelIndex3 > 0) markConfigString(ConfigStringIndex.Models + ent.modelIndex3);
            if (ent.modelIndex4 && ent.modelIndex4 > 0) markConfigString(ConfigStringIndex.Models + ent.modelIndex4);

            // Sounds
            if (ent.sound && ent.sound > 0) markConfigString(ConfigStringIndex.Sounds + ent.sound);
        };

        // 2. Analyze Current Entities (Start State)
        for (const [id, ent] of worldState.currentEntities) {
            analyzeEntityState(ent);
        }

        // 3. Analyze Clip Messages
        for (const msg of clipMessages) {
            switch (msg.type) {
                case ServerCommand.frame: {
                    const frame = (msg as FrameMessage).data;
                    const ps = frame.playerState;
                    if (ps.gun_index > 0) markConfigString(ConfigStringIndex.Models + ps.gun_index);

                    if (frame.packetEntities && frame.packetEntities.entities) {
                        for (const ent of frame.packetEntities.entities) {
                             referencedEntities.add(ent.number);

                             // Since 'bits' is dynamically attached in parser or we need to check blindly
                             // But entity updates are delta compressed. If we don't have 'bits', we assume values are updated if present?
                             // But in EntityState, fields are just values.
                             // 'bits' was used in parsing to know what changed.
                             // If we are looking at a full entity state, we should just check the values.
                             // But wait, are these EntityStates delta states or full states?
                             // parser.onFrame provides packetEntities.entities which are DELTA states if packetEntities.delta is true.
                             // But the parser implementation accumulates/mutates a temporary entity and pushes copy?
                             // No, `parseDelta` modifies `to` (which is accumulatively updated if we were tracking state, but the parser's `collectPacketEntities` uses `createEmptyEntityState` and applies delta to it).
                             // So `packetEntities.entities` contains sparse delta updates relative to... baseline?
                             // No, `collectPacketEntities` applies delta to a FRESH empty state.
                             // So it's effectively just the fields that changed.

                             // So checking the value > 0 is correct-ish, but 0 is a valid value for some fields?
                             // modelIndex 0 is usually invalid/null.
                             // But we used to check `ent.bits & U_MODEL`.
                             // Since I removed `bits` from type but attached it dynamically as `any` in parser...
                             // I can cast to any here to check bits if I trust they are there.
                             const bits = (ent as any).bits || 0;

                             if (bits & U_MODEL) markConfigString(ConfigStringIndex.Models + ent.modelIndex);
                             if (bits & U_MODEL2) markConfigString(ConfigStringIndex.Models + (ent.modelIndex2 || 0));
                             if (bits & U_MODEL3) markConfigString(ConfigStringIndex.Models + (ent.modelIndex3 || 0));
                             if (bits & U_MODEL4) markConfigString(ConfigStringIndex.Models + (ent.modelIndex4 || 0));

                             if (bits & U_SOUND) markConfigString(ConfigStringIndex.Sounds + (ent.sound || 0));
                        }
                    }
                    break;
                }
                case ServerCommand.sound: {
                    const snd = msg as SoundMessage;
                    if (snd.soundNum > 0) markConfigString(ConfigStringIndex.Sounds + snd.soundNum);
                    if (snd.ent !== undefined) referencedEntities.add(snd.ent);
                    break;
                }
                case ServerCommand.temp_entity: {
                    // TODO: Implement dependency tracking for TempEntities.
                    break;
                }
                case ServerCommand.spawnbaseline: {
                    const bl = msg as SpawnBaselineMessage;
                    referencedEntities.add(bl.entity.number);
                    analyzeEntityState(bl.entity);
                    break;
                }
            }
        }

        // 4. Always keep essential ConfigStrings
        markConfigString(ConfigStringIndex.Name);
        markConfigString(ConfigStringIndex.CdTrack);
        markConfigString(ConfigStringIndex.Sky);
        markConfigString(ConfigStringIndex.SkyAxis);
        markConfigString(ConfigStringIndex.SkyRotate);
        markConfigString(ConfigStringIndex.StatusBar);
        markConfigString(ConfigStringIndex.HealthBarName);
        markConfigString(ConfigStringIndex.AirAccel);
        markConfigString(ConfigStringIndex.MaxClients);
        markConfigString(ConfigStringIndex.MapChecksum);

        for (let i = 0; i < MAX_CLIENTS; i++) {
            markConfigString(ConfigStringIndex.Players + i);
        }

        for (let i = 0; i < MAX_IMAGES; i++) {
             markConfigString(ConfigStringIndex.Images + i);
        }

        // Filter WorldState

        const newBaselines = new Map<number, EntityState>();
        for (const [num, ent] of worldState.entityBaselines) {
            if (referencedEntities.has(num)) {
                newBaselines.set(num, ent);
                // Also ensure dependencies of this baseline are marked
                analyzeEntityState(ent);
            }
        }

        const newConfigStrings = new Map<number, string>();
        for (const [idx, str] of worldState.configStrings) {
            if (referencedConfigStrings.has(idx)) {
                newConfigStrings.set(idx, str);
            }
        }

        return {
            ...worldState,
            configStrings: newConfigStrings,
            entityBaselines: newBaselines
        };
    }
}
