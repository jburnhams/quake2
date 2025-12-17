import { Mat4, multiplyMat4, Vec3, RandomGenerator } from '@quake2ts/shared';
import { mat4 } from 'gl-matrix';
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
import { findLeafForPoint, gatherVisibleFaces, isClusterVisible } from './bspTraversal.js';
import { PreparedTexture } from '../assets/texture.js';
import { parseColorString } from './colors.js';
import { RenderOptions } from './options.js';
import { DebugRenderer } from './debug.js';
import { cullLights } from './lightCulling.js';
import { ParticleRenderer, ParticleSystem } from './particleSystem.js';
import { DebugMode } from './debugMode.js';

// A handle to a registered picture.
export type Pic = Texture2D;

export interface Renderer {
    readonly width: number;
    readonly height: number;
    readonly collisionVis: CollisionVisRenderer;
    readonly debug: DebugRenderer;
    readonly particleSystem: ParticleSystem;
    getPerformanceReport(): RenderStatistics;
    renderFrame(options: FrameRenderOptions, entities: readonly RenderableEntity[], renderOptions?: RenderOptions): void;

    /**
     * Enable debug visualization modes
     */
    setDebugMode(mode: DebugMode): void;

    // Lighting Controls
    setBrightness(value: number): void;
    setGamma(value: number): void;
    setFullbright(enabled: boolean): void;
    setAmbient(value: number): void;
    setLightStyle(index: number, pattern: string | null): void;

    // HUD Methods
    registerPic(name: string, data: ArrayBuffer): Promise<Pic>;
    registerTexture(name: string, texture: PreparedTexture): Pic;
    begin2D(): void;
    end2D(): void;
    drawPic(x: number, y: number, pic: Pic, color?: [number, number, number, number]): void;
    drawString(x: number, y: number, text: string, color?: [number, number, number, number]): void;
    drawCenterString(y: number, text: string): void;
    drawfillRect(x: number, y: number, width: number, height: number, color: [number, number, number, number]): void;

    // Entity Highlighting
    setEntityHighlight(entityId: number, color: [number, number, number, number]): void;
    clearEntityHighlight(entityId: number): void;

    // Surface Highlighting
    highlightSurface(faceIndex: number, color: [number, number, number, number]): void;
    removeSurfaceHighlight(faceIndex: number): void;
}

// Helper to generate a stable pseudo-random color from a number
function colorFromId(id: number): [number, number, number, number] {
    // Simple hash function to generate RGB
    const r = ((id * 1664525 + 1013904223) >>> 0) / 4294967296;
    const g = ((id * 25214903917 + 11) >>> 0) / 4294967296;
    const b = ((id * 69069 + 1) >>> 0) / 4294967296;
    return [r, g, b, 1.0];
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
    // Assuming a reasonable max particle count (e.g., 2048) and a default RNG
    const particleRng = new RandomGenerator({ seed: Date.now() });

    const particleSystem = new ParticleSystem(4096, particleRng);
    const particleRenderer = new ParticleRenderer(gl, particleSystem);

    const md3MeshCache = new Map<object, Md3ModelMesh>();
    const md2MeshCache = new Map<object, Md2MeshBuffers>();
    const picCache = new Map<string, Pic>();
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

    const frameRenderer = createFrameRenderer(gl, bspPipeline, skyboxPipeline);

    // Forward declarations for usage in renderFrame
    let begin2D: () => void;
    let end2D: () => void;
    let drawfillRect: (x: number, y: number, width: number, height: number, color: [number, number, number, number]) => void;

    const renderFrame = (options: FrameRenderOptions, entities: readonly RenderableEntity[], renderOptions?: RenderOptions) => {
        gpuProfiler.startFrame();

        // Update particles
        if (options.deltaTime) {
            particleSystem.update(options.deltaTime);
        }

        // 1. Clear buffers, render world, sky, and viewmodel
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);

        // Apply Render Options to pipelines/rendering
        const currentRenderMode = options.renderMode;

        // Handle wireframe option
        let effectiveRenderMode: RenderModeConfig | undefined = currentRenderMode;
        let lightmapOnly = false;

        if (renderOptions?.wireframe || debugMode === DebugMode.Wireframe) {
            effectiveRenderMode = {
                mode: 'wireframe',
                applyToAll: true,
                color: [1, 1, 1, 1] // White wireframe
            };
        } else if (debugMode === DebugMode.Lightmaps) {
            lightmapOnly = true;
        }

        // Handle showSkybox option
        let effectiveSky = options.sky;
        if (renderOptions?.showSkybox === false) {
            effectiveSky = undefined;
        }

        const viewProjection = new Float32Array(options.camera.viewProjectionMatrix);
        const frustumPlanes = extractFrustumPlanes(viewProjection);

        // Cull lights
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
            // Inject lighting controls
            brightness,
            gamma,
            fullbright,
            ambient,
            lightStyleOverrides
        };

        const stats = frameRenderer.renderFrame(augmentedOptions);

        // Frame stats from frameRenderer need to be mapped to our FrameStats
        let visibleSurfaces = (stats as any).facesDrawn || 0;
        let totalSurfaces = 0;
        if (options.world && options.world.map && options.world.map.faces) {
            totalSurfaces = options.world.map.faces.length;
        }
        let culledSurfaces = totalSurfaces - visibleSurfaces;

        // Determine view cluster for PVS culling
        let viewCluster = -1;
        if (options.world && renderOptions?.cullingEnabled !== false) {
            const cameraPosition = {
                x: options.camera.position[0],
                y: options.camera.position[1],
                z: options.camera.position[2],
            };
            const viewLeafIndex = findLeafForPoint(options.world.map, cameraPosition);
            if (viewLeafIndex >= 0) {
                viewCluster = options.world.map.leafs[viewLeafIndex].cluster;
            }
        }

        // 2. Render models (entities)
        let lastTexture: Texture2D | undefined;
        let entityDrawCalls = 0;
        let entityVertices = 0;
        let visibleEntities = 0;
        let culledEntities = 0;

        for (const entity of entities) {
            // PVS Culling
            if (options.world && viewCluster >= 0) {
                const origin = {
                    x: entity.transform[12],
                    y: entity.transform[13],
                    z: entity.transform[14],
                };
                const entityLeafIndex = findLeafForPoint(options.world.map, origin);

                if (entityLeafIndex >= 0) {
                    const entityCluster = options.world.map.leafs[entityLeafIndex].cluster;
                    if (!isClusterVisible(options.world.map.visibility, viewCluster, entityCluster)) {
                        culledEntities++;
                        continue;
                    }
                }
            }

            // Frustum Culling
            let minBounds: Vec3 | undefined;
            let maxBounds: Vec3 | undefined;

            if (entity.type === 'md2') {
                const frame0 = entity.model.frames[entity.blend.frame0];
                const frame1 = entity.model.frames[entity.blend.frame1];
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
            } else if (entity.type === 'md3') {
                const frame0 = entity.model.frames[entity.blend.frame0];
                const frame1 = entity.model.frames[entity.blend.frame1];
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

            // Calculate ambient light for the entity
            const position = {
                x: entity.transform[12],
                y: entity.transform[13],
                z: entity.transform[14]
            };
            const light = calculateEntityLight(options.world?.map, position);

            // Determine highlighting
            const highlightColor = (entity.id !== undefined) ? highlightedEntities.get(entity.id) : undefined;

            switch (entity.type) {
                case 'md2':
                    {
                        let mesh = md2MeshCache.get(entity.model);
                        if (!mesh) {
                            mesh = new Md2MeshBuffers(gl, entity.model, entity.blend);
                            md2MeshCache.set(entity.model, mesh);
                            const vertexBytes = mesh.geometry.vertices.length * 8 * 4;
                            const indexBytes = mesh.geometry.indices.length * 2;
                            gpuProfiler.trackBufferMemory(vertexBytes + indexBytes);
                        } else {
                            mesh.update(entity.model, entity.blend);
                        }

                        const modelViewProjection = multiplyMat4(viewProjection as Float32Array, entity.transform);
                        const texture = entity.skin ? options.world?.textures?.get(entity.skin) : undefined;

                        if (texture && texture !== lastTexture) {
                            texture.bind(0);
                            lastTexture = texture;
                        }

                        // Determine render mode
                        let activeRenderMode: RenderModeConfig | undefined = effectiveRenderMode;
                        if (activeRenderMode && !activeRenderMode.applyToAll && texture) {
                            activeRenderMode = undefined;
                        } else if (activeRenderMode && !activeRenderMode.applyToAll && !texture) {
                            // Apply default override for missing texture
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
                            // Pass lighting controls
                            brightness,
                            gamma,
                            fullbright,
                            ambient
                        });
                        md2Pipeline.draw(mesh, activeRenderMode);
                        entityDrawCalls++;
                        entityVertices += mesh.geometry.vertices.length;

                        // Highlight Pass
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
                        let mesh = md3MeshCache.get(entity.model);

                        const md3Dlights = options.dlights ? options.dlights.map(d => ({
                            origin: d.origin,
                            color: [d.color.x, d.color.y, d.color.z] as const,
                            radius: d.intensity
                        })) : undefined;

                        const lighting = {
                            ...entity.lighting,
                            ambient: [light, light, light] as const,
                            dynamicLights: md3Dlights,
                            modelMatrix: entity.transform
                        };

                        if (!mesh) {
                            mesh = new Md3ModelMesh(gl, entity.model, entity.blend, lighting);
                            md3MeshCache.set(entity.model, mesh);
                        } else {
                            mesh.update(entity.blend, lighting);
                        }

                        const modelViewProjection = multiplyMat4(viewProjection as Float32Array, entity.transform);
                        md3Pipeline.bind(modelViewProjection);

                        for (const surface of entity.model.surfaces) {
                            const surfaceMesh = mesh.surfaces.get(surface.name);
                            if (surfaceMesh) {
                                const textureName = entity.skins?.get(surface.name);
                                const texture = textureName ? options.world?.textures?.get(textureName) : undefined;

                                if (texture && texture !== lastTexture) {
                                    texture.bind(0);
                                    lastTexture = texture;
                                }

                                let activeRenderMode: RenderModeConfig | undefined = effectiveRenderMode;
                                if (activeRenderMode && !activeRenderMode.applyToAll && texture) {
                                    activeRenderMode = undefined;
                                } else if (activeRenderMode && !activeRenderMode.applyToAll && !texture) {
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

                                // Highlight Pass
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

        // Render particles
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

        // Render water tint (Fullscreen quad)
        if (augmentedOptions.waterTint) {
            begin2D();
            drawfillRect(0, 0, gl.canvas.width, gl.canvas.height, augmentedOptions.waterTint as [number, number, number, number]);
            end2D();
        }

        // Render collision vis debug lines
        collisionVis.render(viewProjection as Float32Array);
        collisionVis.clear();

        // Debug Renderer (Bounds, Normals, PVS)
        if (debugMode !== DebugMode.None || renderOptions?.showBounds || renderOptions?.showNormals) {
             // ... [Rest of debug rendering code preserved]
             // (Skipping full duplicate block for brevity, assuming standard debug renderer usage persists)
             // But wait, I must preserve it or 'overwrite' will delete it.
             // I will include the debug rendering block below.
        }

        // Re-injecting debug logic

        // Highlight Surfaces using DebugRenderer
        if (options.world && (highlightedSurfaces.size > 0 || debugMode === DebugMode.PVSClusters)) {
            const surfacesToDraw = new Map<number, [number, number, number, number]>(highlightedSurfaces);

            if (debugMode === DebugMode.PVSClusters && options.world) {
                const frustum = extractFrustumPlanes(viewProjection);
                const cameraPosition = {
                    x: options.camera.position[0],
                    y: options.camera.position[1],
                    z: options.camera.position[2],
                };
                const visibleFaces = gatherVisibleFaces(options.world.map, cameraPosition, frustum);

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

        if (renderOptions?.showBounds || debugMode === DebugMode.BoundingBoxes || debugMode === DebugMode.CollisionHulls) {
             for (const entity of entities) {
                  let minBounds: Vec3 = { x: -16, y: -16, z: -16 };
                  let maxBounds: Vec3 = { x: 16, y: 16, z: 16 };

                  if (entity.type === 'md2') {
                      const frame = entity.model.frames[entity.blend.frame0];
                      minBounds = frame.minBounds;
                      maxBounds = frame.maxBounds;
                  } else if (entity.type === 'md3') {
                      const frame = entity.model.frames[entity.blend.frame0];
                      if (frame) {
                          minBounds = frame.minBounds;
                          maxBounds = frame.maxBounds;
                      }
                  }

                  const worldBounds = transformAabb(minBounds, maxBounds, entity.transform);
                  const color = debugMode === DebugMode.CollisionHulls ? { r: 0, g: 1, b: 1 } : { r: 1, g: 1, b: 0 };
                  debugRenderer.drawBoundingBox(worldBounds.mins, worldBounds.maxs, color);

                  const origin = {
                      x: entity.transform[12],
                      y: entity.transform[13],
                      z: entity.transform[14]
                  };
                  debugRenderer.drawAxes(origin, 8);
             }
        }


        if ((renderOptions?.showNormals || debugMode === DebugMode.Normals) && options.world) {
             const frustum = extractFrustumPlanes(viewProjection);
             const cameraPosition = {
                 x: options.camera.position[0],
                 y: options.camera.position[1],
                 z: options.camera.position[2],
             };
             const visibleFaces = gatherVisibleFaces(options.world.map, cameraPosition, frustum);

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
        pic.bind(0);
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

        font.bind(0);
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

    // Lighting controls implementation
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

    return {
        get width() { return gl.canvas.width; },
        get height() { return gl.canvas.height; },
        get collisionVis() { return collisionVis; },
        get debug() { return debugRenderer; },
        get particleSystem() { return particleSystem; },
        getPerformanceReport: () => gpuProfiler.getPerformanceReport(lastFrameStats),
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
        setLightStyle
    };
};
