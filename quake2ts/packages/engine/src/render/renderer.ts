import { Mat4, multiplyMat4, Vec3, RandomGenerator } from '@quake2ts/shared';
import { mat4, quat, vec3 } from 'gl-matrix';
import { BspSurfacePipeline } from './bspPipeline.js';
import { Camera } from './camera.js';
import { createFrameRenderer, FrameRenderOptions, RenderModeConfig } from './frame.js';
import { Md2MeshBuffers, Md2Pipeline } from './md2Pipeline.js';
import { Md3ModelMesh, Md3Pipeline } from './md3Pipeline.js';
import { RenderableEntity } from './scene.js';
import { SkyboxPipeline } from './skybox.js';
import { SpriteRenderer } from './sprite.js';
import { Texture2D } from './resources.js';
import { CollisionVisRenderer } from './collisionVis.js';
import { calculateEntityLight } from './light.js';
import { GpuProfiler, RenderStatistics, FrameStats } from './gpuProfiler.js';
import { boxIntersectsFrustum, extractFrustumPlanes, transformAabb } from './culling.js';
import { findLeafForPoint, gatherVisibleFaces, isClusterVisible, calculateReachableAreas } from './bspTraversal.js';
import { PreparedTexture } from '../assets/texture.js';
import { parseColorString } from './colors.js';
import { RenderOptions } from './options.js';
import { DebugRenderer } from './debug.js';
import { cullLights } from './lightCulling.js';
import { ParticleRenderer, ParticleSystem } from './particleSystem.js';
import { DebugMode } from './debugMode.js';
import { MemoryUsage } from './types.js';
import { InstanceData } from './instancing.js';
import { Md2Model } from '../assets/md2.js';
import { Md3Model } from '../assets/md3.js';
import { RenderableMd2, RenderableMd3 } from './scene.js';
import { IRenderer, Pic } from './interface.js';

// Re-export Pic for backward compatibility
export type { Pic };

type MutableRenderableMd2 = { -readonly [K in keyof RenderableMd2]: RenderableMd2[K] };
type MutableRenderableMd3 = { -readonly [K in keyof RenderableMd3]: RenderableMd3[K] };
type MutableRenderableEntity = MutableRenderableMd2 | MutableRenderableMd3;

export interface Renderer extends IRenderer {
    setAreaPortalState(portalNum: number, open: boolean): void;
}

// Helper to generate a stable pseudo-random color from a number
function colorFromId(id: number): [number, number, number, number] {
    // Simple hash function to generate RGB
    const r = ((id * 1664525 + 1013904223) >>> 0) / 4294967296;
    const g = ((id * 25214903917 + 11) >>> 0) / 4294967296;
    const b = ((id * 69069 + 1) >>> 0) / 4294967296;
    return [r, g, b, 1.0];
}

interface CachedLeaf {
    leafIndex: number;
    position: Float32Array; // Clone of transform to detect movement
    lastFrameSeen: number; // For LRU eviction
}

export const createRenderer = (
    gl: WebGL2RenderingContext,
): Renderer => {
    const bspPipeline = new BspSurfacePipeline(gl);
    const skyboxPipeline = new SkyboxPipeline(gl);
    const md2Pipeline = new Md2Pipeline(gl);
    const md3Pipeline = new Md3Pipeline(gl);
    const spriteRenderer = new SpriteRenderer(gl);
    const collisionVis = new CollisionVisRenderer(gl);
    const debugRenderer = new DebugRenderer(gl);
    const gpuProfiler = new GpuProfiler(gl);

    // Create Particle System
    const particleRng = new RandomGenerator({ seed: Date.now() });

    const particleSystem = new ParticleSystem(4096, particleRng);
    const particleRenderer = new ParticleRenderer(gl, particleSystem);

    // Track shader memory
    const shaderBytes = bspPipeline.shaderSize +
                        skyboxPipeline.shaderSize +
                        md2Pipeline.shaderSize +
                        md3Pipeline.shaderSize +
                        spriteRenderer.shaderSize +
                        collisionVis.shaderSize +
                        debugRenderer.shaderSize +
                        particleRenderer.shaderSize;

    gpuProfiler.trackShaderMemory(shaderBytes);

    const md3MeshCache = new Map<object, Md3ModelMesh>();
    const md2MeshCache = new Map<object, Md2MeshBuffers>();
    const picCache = new Map<string, Pic>();

    // PVS Cache
    const entityLeafCache = new Map<number, CachedLeaf>();
    let frameCounter = 0;
    const CACHE_CLEANUP_INTERVAL = 600; // Cleanup every ~10 seconds at 60fps
    const CACHE_MAX_AGE = 300; // Evict entries older than 5 seconds

    let font: Pic | null = null;
    let lastFrameStats: FrameStats = {
        drawCalls: 0,
        vertexCount: 0,
        batches: 0,
        shaderSwitches: 0,
        visibleSurfaces: 0,
        culledSurfaces: 0,
        visibleEntities: 0,
        culledEntities: 0
    };
    const highlightedEntities = new Map<number, [number, number, number, number]>();
    const highlightedSurfaces = new Map<number, [number, number, number, number]>();
    let debugMode = DebugMode.None;

    // Lighting state
    let brightness = 1.0;
    let gamma = 1.0;
    let fullbright = false;
    let ambient = 0.0;
    const lightStyleOverrides = new Map<number, string>();
    let underwaterWarp = false;
    let bloom = false;
    let bloomIntensity = 0.5;

    // LOD state
    let lodBias = 1.0;

    // Portal state
    // MAX_MAP_AREAPORTALS is usually small (e.g. 1024 or 256)
    const portalState: boolean[] = new Array(1024).fill(true); // Default open

    const frameRenderer = createFrameRenderer(gl, bspPipeline, skyboxPipeline);

    // Object pooling for instances
    const MAX_INSTANCES = 10000;
    const instancePool: MutableRenderableEntity[] = [];
    let instanceCount = 0;

    // Reusable math objects
    const tempQuat = quat.create();
    const tempVec3Pos = vec3.create();
    const tempVec3Scale = vec3.create();

    // Pre-allocate pools
    for (let i = 0; i < MAX_INSTANCES; i++) {
        const entity: MutableRenderableMd3 = {
            id: -1,
            model: undefined as any,
            transform: new Float32Array(16),
            type: 'md3',
            blend: { frame0: 0, frame1: 0, lerp: 0 },
            tint: [1, 1, 1, 1],
            lighting: {
                ambient: [0.5, 0.5, 0.5],
                dynamicLights: [],
                modelMatrix: undefined as any
            }
        };
        if (entity.lighting) {
            (entity.lighting as any).modelMatrix = entity.transform;
        }
        instancePool.push(entity);
    }

    const queuedInstances: RenderableEntity[] = [];

    // Forward declarations
    let begin2D: () => void;
    let end2D: () => void;
    let drawfillRect: (x: number, y: number, width: number, height: number, color: [number, number, number, number]) => void;

    // Helper for LOD selection
    const selectLod = (entity: RenderableEntity, cameraPos: Vec3): { model: any, type: 'md2' | 'md3' } => {
        // LOD Check
        if (entity.type === 'md2') {
             const model = entity.model as Md2Model;
             if (!model.lods || model.lods.length === 0) {
                 return { model: entity.model, type: entity.type };
             }

             // Calculate distance
             const dx = entity.transform[12] - cameraPos.x;
             const dy = entity.transform[13] - cameraPos.y;
             const dz = entity.transform[14] - cameraPos.z;
             const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);

             const lodIndex = Math.floor((distance * lodBias) / 500);

             if (lodIndex <= 0) {
                 return { model: entity.model, type: entity.type };
             }

             const availableLods = model.lods;
             const selectedLodIndex = Math.min(lodIndex - 1, availableLods.length - 1);

             return { model: availableLods[selectedLodIndex], type: entity.type };
        }

        return { model: entity.model, type: entity.type };
    };

    const renderFrame = (options: FrameRenderOptions, entities: readonly RenderableEntity[], renderOptions?: RenderOptions) => {
        gpuProfiler.startFrame();
        frameCounter++;

        const allEntities = queuedInstances.length > 0 ? [...entities, ...queuedInstances] : entities;

        queuedInstances.length = 0;
        instanceCount = 0;

        if (options.deltaTime) {
            particleSystem.update(options.deltaTime);
        }

        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);

        const currentRenderMode = options.renderMode;

        let effectiveRenderMode: RenderModeConfig | undefined = currentRenderMode;
        let lightmapOnly = false;

        if (renderOptions?.wireframe || debugMode === DebugMode.Wireframe) {
            effectiveRenderMode = {
                mode: 'wireframe',
                applyToAll: true,
                color: [1, 1, 1, 1]
            };
        } else if (debugMode === DebugMode.Lightmaps) {
            lightmapOnly = true;
        }

        let effectiveSky = options.sky;
        if (renderOptions?.showSkybox === false) {
            effectiveSky = undefined;
        }

        const viewProjection = new Float32Array(options.camera.viewProjectionMatrix);
        const frustumPlanes = extractFrustumPlanes(viewProjection);

        const culledLights = options.dlights
            ? cullLights(
                options.dlights,
                frustumPlanes,
                { x: options.camera.position[0], y: options.camera.position[1], z: options.camera.position[2] },
                32
            )
            : undefined;

        const augmentedOptions = {
            ...options,
            sky: effectiveSky,
            renderMode: effectiveRenderMode,
            disableLightmaps: renderOptions?.showLightmaps === false && debugMode !== DebugMode.Lightmaps,
            dlights: culledLights,
            lightmapOnly,
            brightness,
            gamma,
            fullbright,
            ambient,
            lightStyleOverrides,
            underwaterWarp,
            bloom,
            bloomIntensity,
            portalState // Pass it here.
        };

        const stats = frameRenderer.renderFrame(augmentedOptions);

        let visibleSurfaces = (stats as any).facesDrawn || 0;
        let totalSurfaces = 0;
        if (options.world && options.world.map && options.world.map.faces) {
            totalSurfaces = options.world.map.faces.length;
        }
        let culledSurfaces = totalSurfaces - visibleSurfaces;

        let viewCluster = -1;
        let viewArea = -1;
        let reachableAreas: Set<number> | null = null;

        if (options.world && renderOptions?.cullingEnabled !== false) {
            const cameraPosition = {
                x: options.camera.position[0],
                y: options.camera.position[1],
                z: options.camera.position[2],
            };
            const viewLeafIndex = findLeafForPoint(options.world.map, cameraPosition);
            if (viewLeafIndex >= 0) {
                const leaf = options.world.map.leafs[viewLeafIndex];
                viewCluster = leaf.cluster;
                viewArea = leaf.area;

                if (viewArea >= 0 && options.world.map.areas.length > 0) {
                  reachableAreas = calculateReachableAreas(options.world.map, viewArea, portalState);
                }
            }
        }

        let lastTexture: Texture2D | undefined;
        let entityDrawCalls = 0;
        let entityVertices = 0;
        let visibleEntities = 0;
        let culledEntities = 0;

        const cameraPos: Vec3 = {
            x: options.camera.position[0],
            y: options.camera.position[1],
            z: options.camera.position[2]
        };

        // Cache cleanup
        if (frameCounter % CACHE_CLEANUP_INTERVAL === 0) {
            for (const [id, entry] of entityLeafCache) {
                if (frameCounter - entry.lastFrameSeen > CACHE_MAX_AGE) {
                    entityLeafCache.delete(id);
                }
            }
        }

        for (const entity of allEntities) {
            if (options.world && viewCluster >= 0) {
                const origin = {
                    x: entity.transform[12],
                    y: entity.transform[13],
                    z: entity.transform[14],
                };

                let entityLeafIndex = -1;

                if (entity.id !== undefined) {
                    const cached = entityLeafCache.get(entity.id);
                    // Check if position changed
                    if (cached &&
                        cached.position[12] === entity.transform[12] &&
                        cached.position[13] === entity.transform[13] &&
                        cached.position[14] === entity.transform[14]) {
                        entityLeafIndex = cached.leafIndex;
                        cached.lastFrameSeen = frameCounter;
                    } else {
                        entityLeafIndex = findLeafForPoint(options.world.map, origin);
                        if (entityLeafIndex >= 0) {
                            entityLeafCache.set(entity.id, {
                                leafIndex: entityLeafIndex,
                                position: new Float32Array(entity.transform), // Clone
                                lastFrameSeen: frameCounter
                            });
                        }
                    }
                } else {
                     entityLeafIndex = findLeafForPoint(options.world.map, origin);
                }

                if (entityLeafIndex >= 0) {
                    const leaf = options.world.map.leafs[entityLeafIndex];
                    const entityCluster = leaf.cluster;
                    const entityArea = leaf.area;

                    // Check area reachability
                    if (reachableAreas && entityArea >= 0 && !reachableAreas.has(entityArea)) {
                        culledEntities++;
                        continue;
                    }

                    if (!isClusterVisible(options.world.map.visibility, viewCluster, entityCluster)) {
                        culledEntities++;
                        continue;
                    }
                }
            }

            // LOD Selection
            const { model: activeModel, type: activeType } = selectLod(entity, cameraPos);

            let minBounds: Vec3 | undefined;
            let maxBounds: Vec3 | undefined;

            if (activeType === 'md2') {
                const md2Model = activeModel as Md2Model;
                const frame0 = md2Model.frames[entity.blend.frame0 % md2Model.frames.length];
                const frame1 = md2Model.frames[entity.blend.frame1 % md2Model.frames.length];
                if (frame0 && frame1) {
                    minBounds = {
                        x: Math.min(frame0.minBounds.x, frame1.minBounds.x),
                        y: Math.min(frame0.minBounds.y, frame1.minBounds.y),
                        z: Math.min(frame0.minBounds.z, frame1.minBounds.z)
                    };
                    maxBounds = {
                        x: Math.max(frame0.maxBounds.x, frame1.maxBounds.x),
                        y: Math.max(frame0.maxBounds.y, frame1.maxBounds.y),
                        z: Math.max(frame0.maxBounds.z, frame1.maxBounds.z)
                    };
                }
            } else if (activeType === 'md3') {
                const md3Model = activeModel as Md3Model;
                const frame0 = md3Model.frames[entity.blend.frame0 % md3Model.frames.length];
                const frame1 = md3Model.frames[entity.blend.frame1 % md3Model.frames.length];
                if (frame0 && frame1) {
                     minBounds = {
                        x: Math.min(frame0.minBounds.x, frame1.minBounds.x),
                        y: Math.min(frame0.minBounds.y, frame1.minBounds.y),
                        z: Math.min(frame0.minBounds.z, frame1.minBounds.z)
                    };
                    maxBounds = {
                        x: Math.max(frame0.maxBounds.x, frame1.maxBounds.x),
                        y: Math.max(frame0.maxBounds.y, frame1.maxBounds.y),
                        z: Math.max(frame0.maxBounds.z, frame1.maxBounds.z)
                    };
                } else {
                     minBounds = { x: -32, y: -32, z: -32 };
                     maxBounds = { x: 32, y: 32, z: 32 };
                }
            }

            if (minBounds && maxBounds) {
                const worldBounds = transformAabb(minBounds, maxBounds, entity.transform);
                if (!boxIntersectsFrustum(worldBounds.mins, worldBounds.maxs, frustumPlanes)) {
                    culledEntities++;
                    continue;
                }
            }

            visibleEntities++;

            const position = {
                x: entity.transform[12],
                y: entity.transform[13],
                z: entity.transform[14]
            };
            const light = calculateEntityLight(options.world?.map, position);

            const highlightColor = (entity.id !== undefined) ? highlightedEntities.get(entity.id) : undefined;

            switch (activeType) {
                case 'md2':
                    {
                        const md2Model = activeModel as Md2Model;
                        let mesh = md2MeshCache.get(md2Model);
                        if (!mesh) {
                            mesh = new Md2MeshBuffers(gl, md2Model, entity.blend);
                            md2MeshCache.set(md2Model, mesh);
                            const vertexBytes = mesh.geometry.vertices.length * 8 * 4;
                            const indexBytes = mesh.geometry.indices.length * 2;
                            gpuProfiler.trackBufferMemory(vertexBytes + indexBytes);
                        } else {
                            mesh.update(md2Model, entity.blend);
                        }

                        const modelViewProjection = multiplyMat4(viewProjection as Float32Array, entity.transform);

                        // Use type assertion to access skin since it might not exist on all RenderableEntity types
                        const skinName = (entity as any).skin;
                        const texture = skinName ? options.world?.textures?.get(skinName) : undefined;

                        if (texture && texture !== lastTexture) {
                            texture.bind(0);
                            lastTexture = texture;
                        }

                        let activeRenderMode: RenderModeConfig | undefined = effectiveRenderMode;
                        if (activeRenderMode && !activeRenderMode.applyToAll && texture) {
                            activeRenderMode = undefined;
                        }

                        if (activeRenderMode?.generateRandomColor && entity.id !== undefined) {
                            const randColor = colorFromId(entity.id);
                            activeRenderMode = { ...activeRenderMode, color: randColor };
                        }

                        md2Pipeline.bind({
                            modelViewProjection,
                            modelMatrix: entity.transform,
                            ambientLight: light,
                            dlights: options.dlights,
                            renderMode: activeRenderMode,
                            tint: entity.tint,
                            brightness,
                            gamma,
                            fullbright,
                            ambient
                        });
                        md2Pipeline.draw(mesh, activeRenderMode);
                        entityDrawCalls++;
                        entityVertices += mesh.geometry.vertices.length;

                        if (highlightColor) {
                             const highlightMode: RenderModeConfig = {
                                 mode: 'wireframe',
                                 applyToAll: true,
                                 color: highlightColor
                             };
                            md2Pipeline.bind({
                                modelViewProjection,
                                modelMatrix: entity.transform,
                                ambientLight: 1.0,
                                renderMode: highlightMode,
                                tint: [1, 1, 1, 1],
                                brightness: 1.0,
                                gamma: 1.0,
                                fullbright: true,
                                ambient: 0.0
                            });
                            md2Pipeline.draw(mesh, highlightMode);
                            entityDrawCalls++;
                        }
                    }
                    break;
                case 'md3':
                    {
                        const md3Model = activeModel as Md3Model;
                        let mesh = md3MeshCache.get(md3Model);

                        // Use type assertion for Md3 properties
                        const md3Entity = entity as RenderableMd3;

                        const md3Dlights = options.dlights ? options.dlights.map(d => ({
                            origin: d.origin,
                            color: [d.color.x, d.color.y, d.color.z] as const,
                            radius: d.intensity
                        })) : undefined;

                        const lighting = {
                            ...md3Entity.lighting,
                            ambient: [light, light, light] as const,
                            dynamicLights: md3Dlights,
                            modelMatrix: entity.transform
                        };

                        if (!mesh) {
                            mesh = new Md3ModelMesh(gl, md3Model, entity.blend, lighting);
                            md3MeshCache.set(md3Model, mesh);
                        } else {
                            mesh.update(entity.blend, lighting);
                        }

                        const modelViewProjection = multiplyMat4(viewProjection as Float32Array, entity.transform);
                        md3Pipeline.bind(modelViewProjection);

                        for (const surface of md3Model.surfaces) {
                            const surfaceMesh = mesh.surfaces.get(surface.name);
                            if (surfaceMesh) {
                                const textureName = md3Entity.skins?.get(surface.name);
                                const texture = textureName ? options.world?.textures?.get(textureName) : undefined;

                                if (texture && texture !== lastTexture) {
                                    texture.bind(0);
                                    lastTexture = texture;
                                }

                                let activeRenderMode: RenderModeConfig | undefined = effectiveRenderMode;
                                if (activeRenderMode && !activeRenderMode.applyToAll && texture) {
                                    activeRenderMode = undefined;
                                }

                                if (activeRenderMode?.generateRandomColor && entity.id !== undefined) {
                                    const randColor = colorFromId(entity.id);
                                    activeRenderMode = { ...activeRenderMode, color: randColor };
                                }

                                const material = {
                                     renderMode: activeRenderMode,
                                     brightness,
                                     gamma,
                                     fullbright,
                                     globalAmbient: ambient
                                };

                                md3Pipeline.drawSurface(surfaceMesh, material);
                                entityDrawCalls++;
                                entityVertices += surfaceMesh.geometry.vertices.length;

                                if (highlightColor) {
                                     const highlightMode: RenderModeConfig = {
                                         mode: 'wireframe',
                                         applyToAll: true,
                                         color: highlightColor
                                     };
                                     const highlightMaterial = {
                                         renderMode: highlightMode,
                                         brightness: 1.0,
                                         gamma: 1.0,
                                         fullbright: true,
                                         globalAmbient: 0
                                     };
                                     md3Pipeline.drawSurface(surfaceMesh, highlightMaterial);
                                     entityDrawCalls++;
                                }
                            }
                        }
                    }
                    break;
            }
        }

        const viewMatrix = options.camera.viewMatrix;
        if (viewMatrix) {
            const viewRight = { x: viewMatrix[0], y: viewMatrix[4], z: viewMatrix[8] };
            const viewUp = { x: viewMatrix[1], y: viewMatrix[5], z: viewMatrix[9] };

            particleRenderer.render({
                viewProjection: viewProjection as Float32Array,
                viewRight,
                viewUp
            });
        }

        if (augmentedOptions.waterTint) {
            begin2D();
            drawfillRect(0, 0, gl.canvas.width, gl.canvas.height, augmentedOptions.waterTint as [number, number, number, number]);
            end2D();
        }

        collisionVis.render(viewProjection as Float32Array);
        collisionVis.clear();

        if (options.world && (highlightedSurfaces.size > 0 || debugMode === DebugMode.PVSClusters)) {
            const surfacesToDraw = new Map<number, [number, number, number, number]>(highlightedSurfaces);

            if (debugMode === DebugMode.PVSClusters && options.world) {
                const frustum = extractFrustumPlanes(viewProjection);
                const cameraPosition = {
                    x: options.camera.position[0],
                    y: options.camera.position[1],
                    z: options.camera.position[2],
                };
                const visibleFaces = gatherVisibleFaces(options.world.map, cameraPosition, frustum, portalState); // Pass portalState

                for (const { faceIndex, leafIndex } of visibleFaces) {
                    const leaf = options.world.map.leafs[leafIndex];
                    if (leaf && !surfacesToDraw.has(faceIndex)) {
                        surfacesToDraw.set(faceIndex, colorFromId(leaf.cluster));
                    }
                }
            }

            for (const [faceIndex, color] of surfacesToDraw) {
                const geometry = options.world.surfaces[faceIndex];
                if (geometry && geometry.vertexCount > 0) {
                    const vertices: Vec3[] = [];
                    const stride = 7;
                    for (let i = 0; i < geometry.vertexCount; i++) {
                        vertices.push({
                            x: geometry.vertexData[i * stride],
                            y: geometry.vertexData[i * stride + 1],
                            z: geometry.vertexData[i * stride + 2]
                        });
                    }

                    const c = { r: color[0], g: color[1], b: color[2] };
                    for (let i = 0; i < vertices.length; i++) {
                        const p0 = vertices[i];
                        const p1 = vertices[(i + 1) % vertices.length];
                        debugRenderer.drawLine(p0, p1, c);
                    }
                    debugRenderer.drawLine(vertices[0], vertices[(vertices.length/2)|0], c);
                }
            }
        }

        if ((renderOptions?.showNormals || debugMode === DebugMode.Normals) && options.world) {
             const frustum = extractFrustumPlanes(viewProjection);
             const cameraPosition = {
                 x: options.camera.position[0],
                 y: options.camera.position[1],
                 z: options.camera.position[2],
             };
             const visibleFaces = gatherVisibleFaces(options.world.map, cameraPosition, frustum, portalState); // Pass portalState

             for (const { faceIndex } of visibleFaces) {
                  const face = options.world.map.faces[faceIndex];
                  const plane = options.world.map.planes[face.planeIndex];
                  const geometry = options.world.surfaces[faceIndex];

                  if (!geometry) continue;

                  let cx = 0, cy = 0, cz = 0;
                  const count = geometry.vertexCount;
                  for (let i = 0; i < count; i++) {
                       const idx = i * 7;
                       cx += geometry.vertexData[idx];
                       cy += geometry.vertexData[idx+1];
                       cz += geometry.vertexData[idx+2];
                  }
                  if (count > 0) {
                      cx /= count;
                      cy /= count;
                      cz /= count;

                      const nx = face.side === 0 ? plane.normal[0] : -plane.normal[0];
                      const ny = face.side === 0 ? plane.normal[1] : -plane.normal[1];
                      const nz = face.side === 0 ? plane.normal[2] : -plane.normal[2];

                      const center = { x: cx, y: cy, z: cz };
                      const end = { x: cx + nx * 8, y: cy + ny * 8, z: cz + nz * 8 };
                      debugRenderer.drawLine(center, end, { r: 1, g: 1, b: 0 });
                  }
             }
        }

        debugRenderer.render(viewProjection as Float32Array);

        const labels = debugRenderer.getLabels(viewProjection as Float32Array, gl.canvas.width, gl.canvas.height);
        if (labels.length > 0) {
            begin2D();
            for (const label of labels) {
                drawString(label.x, label.y, label.text, [1, 1, 1, 1]);
            }
            end2D();
        }

        debugRenderer.clear();

        lastFrameStats = {
            drawCalls: stats.drawCalls + entityDrawCalls,
            vertexCount: stats.vertexCount + entityVertices,
            batches: stats.batches,
            shaderSwitches: 0,
            visibleSurfaces,
            culledSurfaces,
            visibleEntities,
            culledEntities
        };

        gpuProfiler.endFrame();
    };

    const registerPic = async (name: string, data: ArrayBuffer): Promise<Pic> => {
        if (picCache.has(name)) {
            return picCache.get(name)!;
        }

        const blob = new Blob([data]);
        const imageBitmap = await createImageBitmap(blob);

        const texture = new Texture2D(gl);
        texture.upload(imageBitmap.width, imageBitmap.height, imageBitmap);
        picCache.set(name, texture);
        gpuProfiler.trackTextureMemory(imageBitmap.width * imageBitmap.height * 4);

        if (name.includes('conchars')) {
            font = texture;
        }

        return texture;
    };

    const registerTexture = (name: string, texture: PreparedTexture): Pic => {
        if (picCache.has(name)) {
            return picCache.get(name)!;
        }

        const tex = new Texture2D(gl);
        const level = texture.levels[0];
        tex.upload(level.width, level.height, level.rgba);

        picCache.set(name, tex);
        gpuProfiler.trackTextureMemory(level.width * level.height * 4);

        if (name.includes('conchars')) {
            font = tex;
        }

        return tex;
    };

    begin2D = () => {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.DEPTH_TEST);
        gl.depthMask(false);

        const projection = mat4.create();
        mat4.ortho(projection, 0, gl.canvas.width, gl.canvas.height, 0, -1, 1);

        spriteRenderer.begin(projection as Float32Array);
    };

    end2D = () => {
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
    };

    const drawPic = (x: number, y: number, pic: Pic, color?: [number, number, number, number]) => {
        // WebGL renderer expects WebGL Texture2D
        (pic as Texture2D).bind(0);
        spriteRenderer.draw(x, y, pic.width, pic.height, 0, 0, 1, 1, color);
    };

    const drawChar = (x: number, y: number, char: number, color?: [number, number, number, number]) => {
        if (!font) {
            return;
        }

        const charWidth = 8;
        const charHeight = 8;
        const numCols = font.width / charWidth;

        const charIndex = char & 255;
        const u0 = ((charIndex % numCols) * charWidth) / font.width;
        const v0 = (Math.floor(charIndex / numCols) * charHeight) / font.height;
        const u1 = u0 + charWidth / font.width;
        const v1 = v0 + charHeight / font.height;

        // WebGL renderer expects WebGL Texture2D
        (font as Texture2D).bind(0);
        spriteRenderer.draw(x, y, charWidth, charHeight, u0, v0, u1, v1, color);
    }

    const drawString = (x: number, y: number, text: string, color?: [number, number, number, number]) => {
        const segments = parseColorString(text);
        let currentX = x;
        const charWidth = 8;

        for (const segment of segments) {
            const segmentColor = segment.color || color;
            for (let i = 0; i < segment.text.length; i++) {
                drawChar(currentX, y, segment.text.charCodeAt(i), segmentColor);
                currentX += charWidth;
            }
        }
    };

    const drawCenterString = (y: number, text: string) => {
        const charWidth = 8;
        const stripped = text.replace(/\^[0-9]/g, '');
        const width = stripped.length * charWidth;
        const x = (gl.canvas.width - width) / 2;
        drawString(x, y, text);
    };

    drawfillRect = (x: number, y: number, width: number, height: number, color: [number, number, number, number]) => {
        spriteRenderer.drawRect(x, y, width, height, color);
    };

    const setEntityHighlight = (entityId: number, color: [number, number, number, number]) => {
        highlightedEntities.set(entityId, color);
    };

    const clearEntityHighlight = (entityId: number) => {
        highlightedEntities.delete(entityId);
    };

    const highlightSurface = (faceIndex: number, color: [number, number, number, number]) => {
        highlightedSurfaces.set(faceIndex, color);
    };

    const removeSurfaceHighlight = (faceIndex: number) => {
        highlightedSurfaces.delete(faceIndex);
    };

    const setDebugMode = (mode: DebugMode) => {
        debugMode = mode;
    };

    const setBrightness = (value: number) => {
        brightness = Math.max(0.0, Math.min(2.0, value));
    };

    const setGamma = (value: number) => {
        gamma = Math.max(0.5, Math.min(3.0, value));
    };

    const setFullbright = (enabled: boolean) => {
        fullbright = enabled;
    };

    const setAmbient = (value: number) => {
        ambient = Math.max(0.0, Math.min(1.0, value));
    };

    const setLightStyle = (index: number, pattern: string | null) => {
        if (pattern === null) {
            lightStyleOverrides.delete(index);
        } else {
            lightStyleOverrides.set(index, pattern);
        }
    };

    const setUnderwaterWarp = (enabled: boolean) => {
        underwaterWarp = enabled;
    }

    const setBloom = (enabled: boolean) => {
        bloom = enabled;
    };

    const setBloomIntensity = (value: number) => {
        bloomIntensity = value;
    };

    const setLodBias = (bias: number) => {
        lodBias = Math.max(0.0, Math.min(2.0, bias));
    };

    const setAreaPortalState = (portalNum: number, open: boolean) => {
        if (portalNum >= 0 && portalNum < portalState.length) {
            portalState[portalNum] = open;
        }
    };

    const renderInstanced = (model: Md2Model | Md3Model, instances: InstanceData[]) => {
        const isMd2 = 'glCommands' in model;
        const type = isMd2 ? 'md2' : 'md3';

        for (const instance of instances) {
            if (instanceCount >= MAX_INSTANCES) {
                console.warn('Max instances reached');
                break;
            }

            const entity = instancePool[instanceCount++];

            entity.model = model as any;
            entity.type = type;

            const blend = entity.blend as any;
            if (instance.frame !== undefined) {
                blend.frame0 = instance.frame;
                blend.frame1 = instance.frame;
                blend.lerp = 0;
            } else {
                blend.frame0 = instance.frame0 || 0;
                blend.frame1 = instance.frame1 || 0;
                blend.lerp = instance.lerp || 0;
            }

            if (isMd2) {
                (entity as MutableRenderableMd2).skin = instance.skin !== undefined ? 'skin' + instance.skin : undefined;
            }

            const rotation = instance.rotation;
            const position = instance.position;
            const scale = instance.scale || { x: 1, y: 1, z: 1 };

            mat4.fromRotationTranslationScale(
                entity.transform as any,
                tempQuat,
                tempVec3Pos,
                tempVec3Scale
            );

            const lighting = (entity as any).lighting;
            if (lighting) {
                if (lighting.dynamicLights) {
                    (lighting.dynamicLights as any[]).length = 0;
                } else {
                    (lighting as any).dynamicLights = [];
                }
                if (!lighting.ambient) {
                    (lighting as any).ambient = [0.5, 0.5, 0.5];
                } else {
                    (lighting.ambient as number[])[0] = 0.5;
                    (lighting.ambient as number[])[1] = 0.5;
                    (lighting.ambient as number[])[2] = 0.5;
                }
            }

            queuedInstances.push(entity);
        }
    };

    return {
        get width() { return gl.canvas.width; },
        get height() { return gl.canvas.height; },
        get collisionVis() { return collisionVis; },
        get debug() { return debugRenderer; },
        get particleSystem() { return particleSystem; },
        getPerformanceReport: () => gpuProfiler.getPerformanceReport(lastFrameStats),
        getMemoryUsage: () => gpuProfiler.getMemoryUsage(),
        renderFrame,
        registerPic,
        registerTexture,
        begin2D,
        end2D,
        drawPic,
        drawString,
        drawCenterString,
        drawfillRect,
        setEntityHighlight,
        clearEntityHighlight,
        highlightSurface,
        removeSurfaceHighlight,
        setDebugMode,
        setBrightness,
        setGamma,
        setFullbright,
        setAmbient,
        setLightStyle,
        setUnderwaterWarp,
        setBloom,
        setBloomIntensity,
        setLodBias,
        setAreaPortalState,
        renderInstanced,
        dispose: () => {
            // Cleanup logic if needed, typically resource disposal
            gpuProfiler.dispose();
        }
    };
};
