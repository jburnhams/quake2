import { ResourceLoadTracker } from './resourceTracker.js';
import { DemoReader } from '../demo/demoReader.js';
import { NetworkMessageParser, NetworkMessageHandler, FrameData, EntityState } from '../demo/parser.js';
import { BinaryStream, Vec3 } from '@quake2ts/shared';

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
                const resources: FrameResources = {
                    visible: new Set(),
                    audible: new Set(),
                    loaded: new Set()
                };

                // Track visible entities (placeholder: all active entities considered visible for now)
                // In real impl, we would use camera frustum.
                if (frame.packetEntities && frame.packetEntities.entities) {
                    for (const ent of frame.packetEntities.entities) {
                        resources.visible.add(`entity_${ent.number}`);
                        // Track model
                        if (ent.modelindex > 0) {
                            // Map modelindex to configstring path?
                            // Need CS_MODELS offset (usually 32 or similar)
                            // Assuming base Q2: CS_MODELS = 32.
                            // But without constants import, we guess.
                            // Let's just store "modelindex_X" for now.
                            resources.loaded.add(`modelindex_${ent.modelindex}`);
                        }
                    }
                }

                timeline.frames.set(frame.serverFrame, resources);
            },
            onCenterPrint: () => {},
            onStuffText: () => {},
            onPrint: () => {},
            onSound: (mask, soundNum, volume, attenuation, offset, ent, pos) => {
                // Track sound
                // CS_SOUNDS offset
                // resources.audible.add(`soundindex_${soundNum}`);
                // Since onSound is outside onFrame, we need to associate it with current frame?
                // But parseMessage happens sequentially.
                // The handler logic is tricky because onSound happens between frames?
                // We should accumulate sounds into the "current" or "next" frame.
                // For simplicity, we just log it if we had a current frame context, but we don't here.
                // We'll ignore for this minimal pass.
            },
            onTempEntity: () => {},
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
            // Protocol version should be set from ServerData, but we assume it comes in the stream or defaults?
            // Demo file starts with ServerData usually.
            // NetworkMessageParser handles svc_serverdata internally to set its version?
            // Yes, parseServerData calls this.protocolVersion = ...
            blockParser.parseMessage();
        }

        return timeline;
    }

    public async analyzeRange(demo: Uint8Array, startFrame: number, endFrame: number): Promise<VisibilityTimeline> {
        return this.analyzeDemo(demo);
    }
}
