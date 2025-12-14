import { Mat4, multiplyMat4, Vec3 } from '@quake2ts/shared';
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
import { GpuProfiler, RenderStatistics } from './gpuProfiler.js';
import { boxIntersectsFrustum, extractFrustumPlanes, transformAabb } from './culling.js';
import { findLeafForPoint, gatherVisibleFaces, isClusterVisible } from './bspTraversal.js';
import { PreparedTexture } from '../assets/texture.js';
import { parseColorString } from './colors.js';
import { RenderOptions } from './options.js';
import { DebugRenderer } from './debug.js';
import { cullLights } from './lightCulling.js';

// A handle to a registered picture.
export type Pic = Texture2D;

export interface Renderer {
    readonly width: number;
    readonly height: number;
    readonly collisionVis: CollisionVisRenderer;
    readonly debug: DebugRenderer;
    getPerformanceReport(): RenderStatistics;
    renderFrame(options: FrameRenderOptions, entities: readonly RenderableEntity[], renderOptions?: RenderOptions): void;

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

    const md3MeshCache = new Map<object, Md3ModelMesh>();
    const md2MeshCache = new Map<object, Md2MeshBuffers>();
    const picCache = new Map<string, Pic>();
    let font: Pic | null = null;
    let lastFrameStats = { drawCalls: 0, vertexCount: 0, batches: 0 };
    const highlightedEntities = new Map<number, [number, number, number, number]>();
    const highlightedSurfaces = new Map<number, [number, number, number, number]>();

    const frameRenderer = createFrameRenderer(gl, bspPipeline, skyboxPipeline);

    const renderFrame = (options: FrameRenderOptions, entities: readonly RenderableEntity[], renderOptions?: RenderOptions) => {
        gpuProfiler.startFrame();

        // 1. Clear buffers, render world, sky, and viewmodel
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);

        // Apply Render Options to pipelines/rendering
        const currentRenderMode = options.renderMode;

        // Handle wireframe option
        let effectiveRenderMode: RenderModeConfig | undefined = currentRenderMode;
        if (renderOptions?.wireframe) {
            effectiveRenderMode = {
                mode: 'wireframe',
                applyToAll: true,
                color: [1, 1, 1, 1] // White wireframe
            };
        }

        // Handle showSkybox option
        let effectiveSky = options.sky;
        if (renderOptions?.showSkybox === false) {
            effectiveSky = undefined;
        }

        const viewProjection = options.camera.viewProjectionMatrix;
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
            disableLightmaps: renderOptions?.showLightmaps === false,
            dlights: culledLights,
        };

        const stats = frameRenderer.renderFrame(augmentedOptions);

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

        // Render collision vis debug lines (if any)
        collisionVis.render(viewProjection as Float32Array);
        collisionVis.clear();

        // Highlight Surfaces using DebugRenderer
        if (options.world && highlightedSurfaces.size > 0) {
            for (const [faceIndex, color] of highlightedSurfaces) {
                const face = options.world.map.faces[faceIndex];
                if (!face) continue;

                // Get vertices from BSP (via surfEdges -> edges -> vertices)
                // We don't have direct access to 'geometry' here unless we query options.world.surfaces[faceIndex]
                // which is cleaner.
                const geometry = options.world.surfaces[faceIndex];
                if (geometry && geometry.vertexCount > 0) {
                    // Draw polygon boundary
                    const vertices: Vec3[] = [];
                    const stride = 7;
                    for (let i = 0; i < geometry.vertexCount; i++) {
                        vertices.push({
                            x: geometry.vertexData[i * stride],
                            y: geometry.vertexData[i * stride + 1],
                            z: geometry.vertexData[i * stride + 2]
                        });
                    }

                    // Use drawLine to draw the loop
                    const c = { r: color[0], g: color[1], b: color[2] };
                    for (let i = 0; i < vertices.length; i++) {
                        const p0 = vertices[i];
                        const p1 = vertices[(i + 1) % vertices.length];
                        debugRenderer.drawLine(p0, p1, c);
                    }
                    // Also draw cross to make it solid-ish or distinct
                    debugRenderer.drawLine(vertices[0], vertices[(vertices.length/2)|0], c);
                }
            }
        }

        // Render debug renderer (Bounds, Normals)
        if (renderOptions?.showBounds) {
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
                  debugRenderer.drawBoundingBox(worldBounds.mins, worldBounds.maxs, { r: 1, g: 1, b: 0 });

                  // Also draw origin/axes as requested in task 1.3.2
                  const origin = {
                      x: entity.transform[12],
                      y: entity.transform[13],
                      z: entity.transform[14]
                  };
                  debugRenderer.drawAxes(origin, 8); // 8 units size
             }
        }


        if (renderOptions?.showNormals && options.world) {
             // Draw BSP surface normals
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

                  // Calculate center of face
                  let cx = 0, cy = 0, cz = 0;
                  const count = geometry.vertexCount;
                  // vertexData stride is 7 floats. Position is at offset 0, 1, 2.
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

                      const center = { x: cx, y: cy, z: cz };
                      // Normal is plane.normal. Make sure to respect face.side (0 or 1)

                      const nx = face.side === 0 ? plane.normal[0] : -plane.normal[0];
                      const ny = face.side === 0 ? plane.normal[1] : -plane.normal[1];
                      const nz = face.side === 0 ? plane.normal[2] : -plane.normal[2];

                      const end = { x: cx + nx * 8, y: cy + ny * 8, z: cz + nz * 8 };
                      debugRenderer.drawLine(center, end, { r: 1, g: 1, b: 0 }); // Yellow normal
                  }
             }
        }

        debugRenderer.render(viewProjection as Float32Array);

        // Draw 3D Text Labels as 2D overlay
        const labels = debugRenderer.getLabels(viewProjection as Float32Array, gl.canvas.width, gl.canvas.height);
        if (labels.length > 0) {
            begin2D();
            for (const label of labels) {
                drawString(label.x, label.y, label.text, [1, 1, 1, 1]);
            }
            end2D();
        }

        debugRenderer.clear();

        // 2. Render models (entities)
        let lastTexture: Texture2D | undefined;
        let entityDrawCalls = 0;
        let entityVertices = 0;

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
                    continue;
                }
            }

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

                        // Handle Random Color Generation logic
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
                        });
                        md2Pipeline.draw(mesh, activeRenderMode);
                        entityDrawCalls++;
                        entityVertices += mesh.geometry.vertices.length;

                        // Highlight Pass
                        if (highlightColor) {
                             // Draw a second pass with wireframe/solid mode and the highlight color
                             const highlightMode: RenderModeConfig = {
                                 mode: 'wireframe',
                                 applyToAll: true,
                                 color: highlightColor
                             };

                             // Disable depth test for overlay or use EQUAL if we want it to be occluded?
                             // Usually highlights should be visible or at least distinct.
                             // Let's keep depth test enabled but maybe draw wireframe.
                             // Or disable depth test to show through walls? For now, standard depth test.

                             md2Pipeline.bind({
                                modelViewProjection,
                                modelMatrix: entity.transform,
                                ambientLight: 1.0, // Full bright for highlight
                                renderMode: highlightMode,
                                tint: [1, 1, 1, 1]
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

                                md3Pipeline.drawSurface(surfaceMesh, { renderMode: activeRenderMode });
                                entityDrawCalls++;
                                entityVertices += surfaceMesh.geometry.vertices.length;

                                // Highlight Pass
                                if (highlightColor) {
                                     const highlightMode: RenderModeConfig = {
                                         mode: 'wireframe',
                                         applyToAll: true,
                                         color: highlightColor
                                     };
                                     // Re-bind MD3 pipeline to ensure full brightness for highlight
                                     // Unlike MD2, we don't have separate bind call exposed easily on pipeline to override light only
                                     // But bind() sets MVP and tint. We need to make sure shader doesn't darken it.
                                     // The MD3 fragment shader uses v_color (vertex color lighting).
                                     // To make it full bright, we'd need to re-upload vertex data with full white lighting
                                     // OR change the shader.
                                     // However, looking at MD3_FRAGMENT_SHADER:
                                     // if (u_renderMode == 1) { vec3 color = u_solidColor.rgb; finalColor = vec4(color, u_solidColor.a * u_tint.a); }
                                     // It IGNORES v_color in solid/wireframe mode!
                                     // So simple wireframe mode should already be full bright (unlit).

                                     // Wait, let's check MD3_FRAGMENT_SHADER again in `md3Pipeline.ts`.
                                     // "if (u_renderMode == 0) ... else { vec3 color = u_solidColor.rgb; ... finalColor = vec4(color, u_solidColor.a * u_tint.a); }"
                                     // Yes, in non-textured mode (solid/wireframe), it uses u_solidColor directly and ignores lighting (v_color is not used).

                                     // BUT, we still need to make sure we are bound correctly?
                                     // We are inside the loop of surfaces. md3Pipeline.bind was called before the loop.
                                     // The highlight pass just calls drawSurface with a new renderMode.
                                     // drawSurface updates uniforms: u_renderMode, u_solidColor.

                                     // So it should be fine?
                                     // Re-reading MD2 logic:
                                     // md2Pipeline.bind is called with ambientLight: 1.0.
                                     // MD2 shader: "vec3 lightAcc = vec3(min(1.0, u_ambient + dotL));"
                                     // "if (u_renderMode == 0) ... else { vec3 color = u_solidColor.rgb; ... }"
                                     // MD2 shader ALSO ignores lighting in solid mode!
                                     // "finalColor = vec4(color, u_solidColor.a * u_tint.a);"

                                     // So actually, for both MD2 and MD3, solid/wireframe mode is UNLIT by default in the shader logic I see.
                                     // So the extra bind with ambientLight=1.0 for MD2 might be redundant for the solid color part,
                                     // unless I missed something in MD2 shader.

                                     // MD2 Fragment Shader:
                                     // if (u_renderMode == 0) { ... * v_lightColor ... } else { ... }
                                     // v_lightColor is NOT used in else block.

                                     // So MD3 should also be fine without re-binding, as long as drawSurface updates the uniforms.
                                     // Let's double check MD3 drawSurface.
                                     // It updates u_renderMode and u_solidColor.

                                     // So consistency should be fine. The reviewer might have been cautious or I might have missed a detail.
                                     // "This means highlights on MD3 models in dark corners might be dim or invisible"
                                     // If the shader ignores lighting in wireframe mode, then they won't be dim.

                                     // Let's verify MD3 shader again.
                                     /*
                                     void main() {
                                          vec4 finalColor;
                                          if (u_renderMode == 0) {
                                              vec4 albedo = texture(u_diffuseMap, v_texCoord) * u_tint;
                                              finalColor = vec4(albedo.rgb * v_color.rgb, albedo.a * v_color.a);
                                          } else {
                                              vec3 color = u_solidColor.rgb;
                                              if (u_renderMode == 2) { ... }
                                              finalColor = vec4(color, u_solidColor.a * u_tint.a);
                                          }
                                          o_color = finalColor;
                                     }
                                     */
                                     // v_color (vertex lighting) is indeed only used in renderMode == 0.

                                     // So both should be unlit.
                                     // However, to be absolutely safe and consistent with MD2 (which does rebind), I can leave MD2 as is (it doesn't hurt)
                                     // and for MD3, I don't need to rebind because `drawSurface` handles the uniforms.

                                     // Wait, MD2 rebind also resets `tint`.
                                     // MD3 `drawSurface` accepts `tint` via `material` arg.
                                     // In the loop: `md3Pipeline.drawSurface(surfaceMesh, { renderMode: highlightMode });`
                                     // `tint` defaults to [1,1,1,1] in `drawSurface` if not provided in `material`.

                                     // So MD3 logic seems correct and consistent: unlit wireframe.

                                     // I will re-apply the file just to be sure, and perhaps add a comment or ensure logic is identical.

                                     md3Pipeline.drawSurface(surfaceMesh, { renderMode: highlightMode });
                                     entityDrawCalls++;
                                }
                            }
                        }
                    }
                    break;
            }
        }

        // Aggregate stats
        lastFrameStats = {
            drawCalls: stats.drawCalls + entityDrawCalls,
            vertexCount: stats.vertexCount + entityVertices,
            batches: stats.batches // Approximation
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

        if (name.includes('conchars')) {
            font = tex;
        }

        return tex;
    };

    const begin2D = () => {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.DEPTH_TEST);
        gl.depthMask(false);

        const projection = mat4.create();
        mat4.ortho(projection, 0, gl.canvas.width, gl.canvas.height, 0, -1, 1);

        spriteRenderer.begin(projection as Float32Array);
    };

    const end2D = () => {
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

    const drawfillRect = (x: number, y: number, width: number, height: number, color: [number, number, number, number]) => {
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

    return {
        get width() { return gl.canvas.width; },
        get height() { return gl.canvas.height; },
        get collisionVis() { return collisionVis; },
        get debug() { return debugRenderer; },
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
    };
};
