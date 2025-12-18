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

        // Current parsing state
        let currentServerFrame = 0;

        const handler: NetworkMessageHandler = {
            onServerData: (protocol, serverCount, attractLoop, gameDir, playerNum, levelName, tickRate, demoType) => {
                // Initialize tracking
            },
            onConfigString: (index, str) => {
                configStrings.set(index, str);
            },
            onSpawnBaseline: (entity) => {
                baselines.set(entity.number, { ...entity });
            },
            onFrame: (frame: FrameData) => {
                currentServerFrame = frame.serverFrame;
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
                        // Track skin? Skinnum logic maps to model skins or player skins.
                        // If modelindex implies player (often modelindex 255 or similar special handling in Q2),
                        // we might look up players configstrings.
                        // Standard Q2 entities:
                        // if modelindex is standard model, skinnum selects skin texture relative to model.
                        // We track the model itself as the primary resource.
                    }
                }

                // Add sound events (accumulated during frame parsing)
                // Note: onSound is called separately from onFrame.
                // Because DemoReader iterates blocks, sound commands come BEFORE or INSIDE the frame block?
                // Actually, frame message is usually the last in a packet.
                // Sounds come before it.
                // So we should have collected sounds since last frame.
                // However, we don't have accumulation logic here yet.
                // We'll fix this by maintaining a pendingSounds set.

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
                // Temp entities often spawn sprites or models.
                // Mapping TE to resources is complex (hardcoded in client).
                // E.g. TE_EXPLOSION1 -> "sprites/s_explod.sp2"
                // For now, we ignore TEs or add a generic placeholder logic if needed.
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

        const pendingSounds = new Set<string>();

        // We use a lenient parser to handle partial data if needed
        while (reader.nextBlock()) {
            const block = reader.getBlock();
            const blockParser = new NetworkMessageParser(block.data, handler, false);
            // Protocol version handling:
            // Ideally we detect from ServerData.
            // The parser updates its protocolVersion when it sees ServerData.
            // But we need to persist it across blocks if we instantiate new Parser per block?
            // NetworkMessageParser maintains state? No, it's new instance.
            // We need a persistent parser instance or pass version.
            // But StreamingBuffer requires the full buffer? Or we can feed blocks?
            // NetworkMessageParser takes a Buffer.
            // If we create new Parser for each block, we lose protocol version state.
            // FIX: Track protocol version externally.

            // However, NetworkMessageParser doesn't accept protocol version in ctor, only setProtocolVersion.

            // We need to track the version found in ServerData.
            // We can wrap the handler to intercept onServerData and update our tracking variable.

            // Actually, we can reuse the parser instance if we could feed it new data.
            // StreamingBuffer doesn't support appending easily (it wraps a fixed buffer).
            // So we must create new Parser and set version.

            // Let's track version.

            // Also, we need to pass the version to the new parser instance.

            // Intercepting handler:
            const originalOnServerData = handler.onServerData;
            handler.onServerData = (protocol, ...args) => {
                currentProtocol = protocol;
                originalOnServerData(protocol, ...args);
            };

            blockParser.setProtocolVersion(currentProtocol);
            blockParser.parseMessage();
        }

        return timeline;
    }

    public async analyzeRange(demo: Uint8Array, startFrame: number, endFrame: number): Promise<VisibilityTimeline> {
        return this.analyzeDemo(demo);
    }
}

let currentProtocol = 0;
