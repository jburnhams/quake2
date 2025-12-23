import { ResourceLoadTracker } from './resourceTracker.js';
import { DemoReader } from '../demo/demoReader.js';
import { NetworkMessageParser, NetworkMessageHandler, FrameData, EntityState } from '../demo/parser.js';
import { BinaryStream, Vec3, ConfigStringIndex, MAX_MODELS, MAX_SOUNDS, MAX_IMAGES, MAX_CLIENTS } from '@quake2ts/shared';
import { AssetManager } from './manager.js';
import { Camera } from '../render/camera.js';
import { BspLoader, BspMap, BspLeaf } from './bsp.js'; // Fixed Import
import { vec3, mat4 } from 'gl-matrix';

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

// Relaxed vector type for compatibility
interface Vector3Like {
    x: number;
    y: number;
    z: number;
}

export class ResourceVisibilityAnalyzer {
    private tracker: ResourceLoadTracker;

    constructor() {
        this.tracker = new ResourceLoadTracker();
    }

    public async analyzeDemo(demo: Uint8Array, assetManager?: AssetManager, bspMap?: BspMap): Promise<VisibilityTimeline> {
        return this.analyzeInternal(demo, 0, Number.MAX_SAFE_INTEGER, assetManager, bspMap);
    }

    public async analyzeRange(demo: Uint8Array, startFrame: number, endFrame: number, assetManager?: AssetManager, bspMap?: BspMap): Promise<VisibilityTimeline> {
        return this.analyzeInternal(demo, startFrame, endFrame, assetManager, bspMap);
    }

    private extractFrustumPlanes(viewProjection: mat4): Float32Array[] {
        const planes: Float32Array[] = [];
        for (let i = 0; i < 6; i++) {
            planes.push(new Float32Array(4));
        }

        const m = viewProjection;

        // Left plane
        planes[0][0] = m[3] + m[0];
        planes[0][1] = m[7] + m[4];
        planes[0][2] = m[11] + m[8];
        planes[0][3] = m[15] + m[12];

        // Right plane
        planes[1][0] = m[3] - m[0];
        planes[1][1] = m[7] - m[4];
        planes[1][2] = m[11] - m[8];
        planes[1][3] = m[15] - m[12];

        // Bottom plane
        planes[2][0] = m[3] + m[1];
        planes[2][1] = m[7] + m[5];
        planes[2][2] = m[11] + m[9];
        planes[2][3] = m[15] + m[13];

        // Top plane
        planes[3][0] = m[3] - m[1];
        planes[3][1] = m[7] - m[5];
        planes[3][2] = m[11] - m[9];
        planes[3][3] = m[15] - m[13];

        // Near plane
        planes[4][0] = m[3] + m[2];
        planes[4][1] = m[7] + m[6];
        planes[4][2] = m[11] + m[10];
        planes[4][3] = m[15] + m[14];

        // Far plane
        planes[5][0] = m[3] - m[2];
        planes[5][1] = m[7] - m[6];
        planes[5][2] = m[11] - m[10];
        planes[5][3] = m[15] - m[14];

        // Normalize planes
        for (let i = 0; i < 6; i++) {
            const p = planes[i];
            const len = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
            if (len > 0) {
                p[0] /= len;
                p[1] /= len;
                p[2] /= len;
                p[3] /= len;
            }
        }

        return planes;
    }

    private isBoxInFrustum(planes: Float32Array[], mins: Vector3Like, maxs: Vector3Like, origin: Vector3Like): boolean {
        // Transform box to world space (simple translation for AABB)
        const absMins = { x: mins.x + origin.x, y: mins.y + origin.y, z: mins.z + origin.z };
        const absMaxs = { x: maxs.x + origin.x, y: maxs.y + origin.y, z: maxs.z + origin.z };

        for (let i = 0; i < 6; i++) {
            const p = planes[i];

            // Find the point on the box closest to the plane normal (positive side)
            let x = absMins.x;
            let y = absMins.y;
            let z = absMins.z;

            if (p[0] >= 0) x = absMaxs.x;
            if (p[1] >= 0) y = absMaxs.y;
            if (p[2] >= 0) z = absMaxs.z;

            // If the "positive" point is behind the plane, the whole box is behind
            if (p[0] * x + p[1] * y + p[2] * z + p[3] < 0) {
                return false;
            }
        }
        return true;
    }

    private findLeaf(map: BspMap, point: Vector3Like): BspLeaf {
        let nodeIndex = map.models[0].headNode;

        while (nodeIndex >= 0) {
            const node = map.nodes[nodeIndex];
            const plane = map.planes[node.planeIndex];

            // Check which side of the plane the point is on
            // Plane equation: normal * point - dist
            const dist = plane.normal[0] * point.x + plane.normal[1] * point.y + plane.normal[2] * point.z - plane.dist;

            if (dist >= 0) {
                nodeIndex = node.children[0];
            } else {
                nodeIndex = node.children[1];
            }
        }

        // nodeIndex is now leaf index (negative)
        // leaf index = -1 - nodeIndex
        const leafIndex = -1 - nodeIndex;
        return map.leafs[leafIndex];
    }

    private isClusterVisible(map: BspMap, fromCluster: number, toCluster: number): boolean {
        if (!map.visibility || fromCluster === -1 || toCluster === -1) {
            return true; // No PVS or invalid cluster, assume visible
        }

        // Check range
        if (fromCluster >= map.visibility.numClusters || toCluster >= map.visibility.numClusters) {
            return true;
        }

        const cluster = map.visibility.clusters[fromCluster];
        if (!cluster || !cluster.pvs) return true;

        const pvs = cluster.pvs;
        const byteIndex = toCluster >> 3;
        const bitIndex = toCluster & 7;

        if (byteIndex >= pvs.length) return false;

        return (pvs[byteIndex] & (1 << bitIndex)) !== 0;
    }

    private async analyzeInternal(
        demo: Uint8Array,
        startFrame: number = 0,
        endFrame: number = Number.MAX_SAFE_INTEGER,
        assetManager?: AssetManager,
        bspMap?: BspMap
    ): Promise<VisibilityTimeline> {
        // If BspMap is provided, we use it. If not, we could potentially load it if assetManager is smart enough,
        // but here we stick to provided map.

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

        // Camera for Frustum Culling
        const camera = new Camera();
        camera.setFov(90); // Default FOV

        // Constants for sound attenuation
        const SOUND_MAX_DIST = 1000; // Approximate max audible distance

        const handler: NetworkMessageHandler = {
            onServerData: (protocol, serverCount, attractLoop, gameDir, playerNum, levelName, tickRate, demoType) => {
                currentProtocol = protocol;
                // If we had logic to auto-load BSP using assetManager.loadBsp(levelName), it would go here.
                // But we can't await here in the sync loop.
            },
            onConfigString: (index, str) => {
                configStrings.set(index, str);
            },
            onSpawnBaseline: (entity) => {
                baselines.set(entity.number, { ...entity });
            },
            onFrame: (frame: FrameData) => {
                if (frame.serverFrame < startFrame || frame.serverFrame > endFrame) {
                    pendingSounds.clear();
                    return;
                }

                // Update Camera
                if (frame.playerState) {
                    camera.setPosition(frame.playerState.origin.x, frame.playerState.origin.y, frame.playerState.origin.z);
                    camera.setRotation(frame.playerState.viewangles.x, frame.playerState.viewangles.y, frame.playerState.viewangles.z);
                }

                const frustumPlanes = this.extractFrustumPlanes(camera.viewProjectionMatrix);

                const models = new Set<string>();
                const sounds = new Set<string>();
                const textures = new Set<string>();
                const loaded = new Set<string>();

                // Get PVS cluster for player if BSP is available
                let pvsCluster = -1;
                if (bspMap && frame.playerState) {
                    const leaf = this.findLeaf(bspMap, frame.playerState.origin);
                    if (leaf) {
                        pvsCluster = leaf.cluster;
                    }
                }

                if (frame.packetEntities && frame.packetEntities.entities) {
                    for (const ent of frame.packetEntities.entities) {
                        // Check PVS
                        if (bspMap && pvsCluster !== -1) {
                            // Find entity leaf
                            const entLeaf = this.findLeaf(bspMap, ent.origin);
                            if (entLeaf && entLeaf.cluster !== -1) {
                                // check visibility
                                if (!this.isClusterVisible(bspMap, pvsCluster, entLeaf.cluster)) {
                                    continue; // Skip if not in PVS
                                }
                            }
                        }

                        // Check Frustum
                        // We use a large conservative bound to avoid culling large objects (bosses, trains).
                        const MAX_ENTITY_SIZE = 256;
                        const mins = { x: -MAX_ENTITY_SIZE, y: -MAX_ENTITY_SIZE, z: -MAX_ENTITY_SIZE };
                        const maxs = { x: MAX_ENTITY_SIZE, y: MAX_ENTITY_SIZE, z: MAX_ENTITY_SIZE };

                        if (ent.modelIndex > 0) {
                            if (!this.isBoxInFrustum(frustumPlanes, mins, maxs, ent.origin)) {
                                // Skip if outside frustum
                                continue;
                            }

                            const path = getModelPath(ent.modelIndex);
                            if (path) {
                                models.add(path);
                                // Model Texture Derivation could happen here
                            }
                        }

                        // Track sound (Looping sounds)
                        if (ent.sound && ent.sound > 0) {
                             const path = getSoundPath(ent.sound);
                             if (path) {
                                 // Check distance
                                 const dx = ent.origin.x - camera.position[0];
                                 const dy = ent.origin.y - camera.position[1];
                                 const dz = ent.origin.z - camera.position[2];
                                 const distSq = dx*dx + dy*dy + dz*dz;
                                 if (distSq < SOUND_MAX_DIST * SOUND_MAX_DIST) {
                                     sounds.add(path);
                                 }
                             }
                        }
                    }
                }

                // Add sound events
                if (pendingSounds.size > 0) {
                    for (const s of pendingSounds) sounds.add(s);
                    pendingSounds.clear();
                }

                const resources: FrameResources = {
                    models,
                    sounds,
                    textures,
                    loaded,
                    visible: models,
                    audible: sounds
                };

                timeline.frames.set(frame.serverFrame, resources);
            },
            onSound: (mask, soundNum, volume, attenuation, offset, ent, pos) => {
                const path = getSoundPath(soundNum);
                if (path) {
                    if (pos) {
                        const dx = pos.x - camera.position[0];
                        const dy = pos.y - camera.position[1];
                        const dz = pos.z - camera.position[2];
                        const distSq = dx*dx + dy*dy + dz*dz;
                         if (distSq < SOUND_MAX_DIST * SOUND_MAX_DIST) {
                             pendingSounds.add(path);
                         }
                    } else {
                        pendingSounds.add(path);
                    }
                }
            },
            onTempEntity: (type, pos, pos2, dir, cnt, color, ent, srcEnt, destEnt) => {
                // Placeholder
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
            blockParser.setProtocolVersion(currentProtocol);
            blockParser.parseMessage();

            if (blockParser.getProtocolVersion() !== currentProtocol) {
                currentProtocol = blockParser.getProtocolVersion();
            }
        }

        return timeline;
    }
}
