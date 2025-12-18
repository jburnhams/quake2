import { ResourceLoadTracker } from './resourceTracker.js';
import { DemoReader } from '../demo/demoReader.js';
import { NetworkMessageParser, NetworkMessageHandler, FrameData, EntityState } from '../demo/parser.js';
import { BinaryStream, Vec3, ConfigStringIndex, MAX_MODELS, MAX_SOUNDS, MAX_IMAGES, MAX_CLIENTS } from '@quake2ts/shared';
import { AssetManager } from './manager.js';

export interface FrameResources {
    models: Set<string>;
    sounds: Set<string>;
    textures: Set<string>;
    loaded: Set<string>;
    /** @deprecated Use models instead */
    visible: Set<string>;
    /** @deprecated Use sounds instead */
    audible: Set<string>;
}

export interface VisibilityTimeline {
    // Map from server frame number to resource set
    frames: Map<number, FrameResources>;
    // Map from time (seconds) to resource set
    time: Map<number, FrameResources>;
}

export class ResourceVisibilityAnalyzer {
    private tracker: ResourceLoadTracker;

    constructor() {
        this.tracker = new ResourceLoadTracker();
    }

    public async analyzeDemo(demo: Uint8Array, assetManager?: AssetManager): Promise<VisibilityTimeline> {
        return this.analyzeInternal(demo, 0, Number.MAX_SAFE_INTEGER, assetManager);
    }

    public async analyzeRange(demo: Uint8Array, startFrame: number, endFrame: number, assetManager?: AssetManager): Promise<VisibilityTimeline> {
        return this.analyzeInternal(demo, startFrame, endFrame, assetManager);
    }

    private async analyzeInternal(demo: Uint8Array, startFrame: number = 0, endFrame: number = Number.MAX_SAFE_INTEGER, assetManager?: AssetManager): Promise<VisibilityTimeline> {
        const reader = new DemoReader(demo.buffer as ArrayBuffer);
        const timeline: VisibilityTimeline = {
            frames: new Map(),
            time: new Map()
        };

        const configStrings = new Map<number, string>();
        const baselines = new Map<number, EntityState>();

        // Helper to resolve config string to path
        const getModelPath = (index: number): string | undefined => {
            if (index <= 0) return undefined;
            return configStrings.get(ConfigStringIndex.Models + index - 1);
        };

        const getSoundPath = (index: number): string | undefined => {
            if (index <= 0) return undefined;
            return configStrings.get(ConfigStringIndex.Sounds + index - 1);
        };

        let currentProtocol = 0;
        const pendingSounds = new Set<string>();

        const handler: NetworkMessageHandler = {
            onServerData: (protocol, serverCount, attractLoop, gameDir, playerNum, levelName, tickRate, demoType) => {
                currentProtocol = protocol;
            },
            onConfigString: (index, str) => {
                configStrings.set(index, str);
            },
            onSpawnBaseline: (entity) => {
                baselines.set(entity.number, { ...entity });
            },
            onFrame: (frame: FrameData) => {
                if (frame.serverFrame < startFrame || frame.serverFrame > endFrame) {
                    pendingSounds.clear(); // Discard sounds for skipped frames
                    return;
                }

                const models = new Set<string>();
                const sounds = new Set<string>();
                const textures = new Set<string>();
                const loaded = new Set<string>();

                // Track visible entities
                // We assume frame.packetEntities includes all visible entities for the frame
                if (frame.packetEntities && frame.packetEntities.entities) {
                    for (const ent of frame.packetEntities.entities) {
                        // Track model
                        if (ent.modelindex > 0) {
                            const path = getModelPath(ent.modelindex);
                            if (path) {
                                models.add(path);
                                // If assetManager is provided, we could resolve model dependencies here.
                                // But that's async and we are in a sync callback.
                                // We might need a post-processing pass.
                            }
                        }
                        // Track sound (if entity has constant sound)
                        if (ent.sound > 0) {
                            const path = getSoundPath(ent.sound);
                            if (path) sounds.add(path);
                        }
                    }
                }

                // Add sound events (accumulated during frame parsing)
                if (pendingSounds.size > 0) {
                    for (const s of pendingSounds) sounds.add(s);
                    pendingSounds.clear();
                }

                const resources: FrameResources = {
                    models,
                    sounds,
                    textures,
                    loaded,
                    visible: models, // Alias for backward compat
                    audible: sounds  // Alias for backward compat
                };

                timeline.frames.set(frame.serverFrame, resources);
            },
            onSound: (mask, soundNum, volume, attenuation, offset, ent, pos) => {
                const path = getSoundPath(soundNum);
                if (path) pendingSounds.add(path);
            },
            onTempEntity: (type, pos, pos2, dir, cnt, color, ent, srcEnt, destEnt) => {
                // Placeholder for TempEntity logic
            },
            onCenterPrint: () => {},
            onStuffText: () => {},
            onPrint: () => {},
            onLayout: () => {},
            onInventory: () => {},
            onMuzzleFlash: () => {},
            onMuzzleFlash2: () => {},
            onDisconnect: () => {},
            onReconnect: () => {},
            onDownload: () => {}
        };

        // We use a lenient parser to handle partial data if needed
        while (reader.nextBlock()) {
            const block = reader.getBlock();
            const blockParser = new NetworkMessageParser(block.data, handler, false);
            // Pass the current protocol state to the new parser instance
            blockParser.setProtocolVersion(currentProtocol);
            blockParser.parseMessage();

            if (blockParser.getProtocolVersion() !== currentProtocol) {
                currentProtocol = blockParser.getProtocolVersion();
            }
        }

        // Post-processing: If AssetManager is available, try to derive textures.
        if (assetManager) {
            // TODO: Implement dependency resolution (Task 5.2 / 5.1 extension)
            // For now we just tracked models and sounds.
        }

        return timeline;
    }
}
