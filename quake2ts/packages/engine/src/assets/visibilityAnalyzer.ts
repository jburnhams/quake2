import { ResourceLoadTracker } from './resourceTracker.js';
import { DemoReader } from '../demo/demoReader.js';
import { NetworkMessageParser, NetworkMessageHandler, FrameData, EntityState } from '../demo/parser.js';
import { BinaryStream, Vec3, ConfigStringIndex, MAX_MODELS, MAX_SOUNDS, MAX_IMAGES, MAX_CLIENTS } from '@quake2ts/shared';

export interface FrameResources {
    visible: Set<string>;
    audible: Set<string>;
    loaded: Set<string>;
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

    public async analyzeDemo(demo: Uint8Array): Promise<VisibilityTimeline> {
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

        const getImagePath = (index: number): string | undefined => {
            if (index < 0) return undefined;
            return configStrings.get(ConfigStringIndex.Images + index);
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
                const resources: FrameResources = {
                    visible: new Set(),
                    audible: new Set(),
                    loaded: new Set()
                };

                // Track visible entities
                // We assume frame.packetEntities includes all visible entities for the frame
                if (frame.packetEntities && frame.packetEntities.entities) {
                    for (const ent of frame.packetEntities.entities) {
                        // Track model
                        if (ent.modelindex > 0) {
                            const path = getModelPath(ent.modelindex);
                            if (path) resources.visible.add(path);
                        }
                        // Track sound (if entity has constant sound)
                        if (ent.sound > 0) {
                            const path = getSoundPath(ent.sound);
                            if (path) resources.audible.add(path);
                        }
                    }
                }

                // Add sound events (accumulated during frame parsing)
                if (pendingSounds.size > 0) {
                    for (const s of pendingSounds) resources.audible.add(s);
                    pendingSounds.clear();
                }

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

            // Note: If the block contained ServerData, currentProtocol was updated by the handler during parseMessage.
            // This updated protocol will be used for the NEXT block.
            // However, ServerData is usually the first command in a block if present.
            // NetworkMessageParser updates its internal protocol version when it parses ServerData,
            // so it handles mixed-protocol blocks correctly internally.
            // We just need to persist it for the next block.
            // To ensure we capture the *updated* protocol from the parser if it changed *during* parsing:
            if (blockParser.getProtocolVersion() !== currentProtocol) {
                currentProtocol = blockParser.getProtocolVersion();
            }
        }

        return timeline;
    }

    public async analyzeRange(demo: Uint8Array, startFrame: number, endFrame: number): Promise<VisibilityTimeline> {
        // Simple implementation respecting range
        // Note: We must still parse linearly to track state (baselines, configstrings),
        // but we only record frames within the range.

        const reader = new DemoReader(demo.buffer as ArrayBuffer);
        const timeline: VisibilityTimeline = {
            frames: new Map(),
            time: new Map()
        };

        // ... Copy setup from analyzeDemo ...
        // To avoid code duplication, we could refactor, but for now we inline or adapt.
        // Actually, we can reuse analyzeDemo logic if we add range filtering inside onFrame.

        // Let's refactor analyzeDemo to accept optional range filter?
        // But analyzeDemo signature is fixed in the class.
        // We'll implement analyzeRange by duplicating the loop logic but adding the check.

        // Better: Make a private internal method.
        return this.analyzeInternal(demo, startFrame, endFrame);
    }

    private async analyzeInternal(demo: Uint8Array, startFrame: number = 0, endFrame: number = Number.MAX_SAFE_INTEGER): Promise<VisibilityTimeline> {
        const reader = new DemoReader(demo.buffer as ArrayBuffer);
        const timeline: VisibilityTimeline = {
            frames: new Map(),
            time: new Map()
        };

        const configStrings = new Map<number, string>();
        const baselines = new Map<number, EntityState>();

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

                const resources: FrameResources = {
                    visible: new Set(),
                    audible: new Set(),
                    loaded: new Set()
                };

                if (frame.packetEntities && frame.packetEntities.entities) {
                    for (const ent of frame.packetEntities.entities) {
                        if (ent.modelindex > 0) {
                            const path = getModelPath(ent.modelindex);
                            if (path) resources.visible.add(path);
                        }
                        if (ent.sound > 0) {
                            const path = getSoundPath(ent.sound);
                            if (path) resources.audible.add(path);
                        }
                    }
                }

                if (pendingSounds.size > 0) {
                    for (const s of pendingSounds) resources.audible.add(s);
                    pendingSounds.clear();
                }

                timeline.frames.set(frame.serverFrame, resources);
            },
            onSound: (mask, soundNum, volume, attenuation, offset, ent, pos) => {
                const path = getSoundPath(soundNum);
                if (path) pendingSounds.add(path);
            },
            onTempEntity: () => {},
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

        while (reader.nextBlock()) {
            const block = reader.getBlock();
            const blockParser = new NetworkMessageParser(block.data, handler, false);
            blockParser.setProtocolVersion(currentProtocol);
            blockParser.parseMessage();
            if (blockParser.getProtocolVersion() !== currentProtocol) {
                currentProtocol = blockParser.getProtocolVersion();
            }
        }

        return timeline;
    }
}
