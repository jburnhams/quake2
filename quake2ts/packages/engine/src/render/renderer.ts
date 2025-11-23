import { Mat4, multiplyMat4, Vec3 } from '@quake2ts/shared';
import { mat4 } from 'gl-matrix';
import { BspSurfacePipeline } from './bspPipeline.js';
import { Camera } from './camera.js';
import { createFrameRenderer, FrameRenderOptions } from './frame.js';
import { Md2MeshBuffers, Md2Pipeline } from './md2Pipeline.js';
import { Md3ModelMesh, Md3Pipeline } from './md3Pipeline.js';
import { RenderableEntity } from './scene.js';
import { SkyboxPipeline } from './skybox.js';
import { SpriteRenderer } from './sprite.js';
import { Texture2D } from './resources.js';
import { CollisionVisRenderer } from './collisionVis.js';
import { calculateEntityLight } from './light.js';
import { GpuProfiler, GpuProfilerStats } from './gpuProfiler.js';
import { boxIntersectsFrustum, extractFrustumPlanes, transformAabb } from './culling.js';
import { findLeafForPoint, isClusterVisible } from './bspTraversal.js';
import { PreparedTexture } from '../assets/texture.js';

// A handle to a registered picture.
export type Pic = Texture2D;

export interface Renderer {
    readonly width: number;
    readonly height: number;
    readonly collisionVis: CollisionVisRenderer;
    readonly stats: GpuProfilerStats;
    renderFrame(options: FrameRenderOptions, entities: readonly RenderableEntity[]): void;

    // HUD Methods
    registerPic(name: string, data: ArrayBuffer): Promise<Pic>;
    registerTexture(name: string, texture: PreparedTexture): Pic;
    begin2D(): void;
    end2D(): void;
    drawPic(x: number, y: number, pic: Pic, color?: [number, number, number, number]): void;
    drawString(x: number, y: number, text: string): void;
    drawCenterString(y: number, text: string): void;
    drawfillRect(x: number, y: number, width: number, height: number, color: [number, number, number, number]): void;
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
    const gpuProfiler = new GpuProfiler(gl);

    const md3MeshCache = new Map<object, Md3ModelMesh>();
    const md2MeshCache = new Map<object, Md2MeshBuffers>();
    const picCache = new Map<string, Pic>();
    let font: Pic | null = null;

    const frameRenderer = createFrameRenderer(gl, bspPipeline, skyboxPipeline);

    const renderFrame = (options: FrameRenderOptions, entities: readonly RenderableEntity[]) => {
        gpuProfiler.startFrame();

        // 1. Clear buffers, render world, sky, and viewmodel
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);

        const stats = frameRenderer.renderFrame(options);
        const viewProjection = options.camera.viewProjectionMatrix;
        const frustumPlanes = extractFrustumPlanes(viewProjection);

        // Determine view cluster for PVS culling
        let viewCluster = -1;
        if (options.world) {
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
        // Clear the lines after rendering (immediate mode style)
        collisionVis.clear();

        // 2. Render models (entities)
        let lastTexture: Texture2D | undefined;

        for (const entity of entities) {
            // PVS Culling
            if (options.world && viewCluster >= 0) {
                // Use entity origin from transform (last column)
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
                // Conservative bounds: union of both frames
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
                    // Fallback if frames missing (shouldn't happen)
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
            // We can extract position from the transform matrix (last column)
            const position = {
                x: entity.transform[12],
                y: entity.transform[13],
                z: entity.transform[14]
            };
            const light = calculateEntityLight(options.world?.map, position);

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

                        md2Pipeline.bind({
                            modelViewProjection,
                            modelMatrix: entity.transform,
                            ambientLight: light,
                            dlights: options.dlights
                        });
                        md2Pipeline.draw(mesh);
                    }
                    break;
                case 'md3':
                    {
                        let mesh = md3MeshCache.get(entity.model);

                        // Convert DLight to Md3DynamicLight
                        const md3Dlights = options.dlights ? options.dlights.map(d => ({
                            origin: d.origin,
                            color: [d.color.x, d.color.y, d.color.z] as const,
                            radius: d.intensity
                        })) : undefined;

                        // Merge calculated light into lighting options if provided, or create new
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

                                md3Pipeline.drawSurface(surfaceMesh);
                            }
                        }
                    }
                    break;
            }
        }

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
        // Assume level 0 for 2D drawing
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

    const drawChar = (x: number, y: number, char: number) => {
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
        spriteRenderer.draw(x, y, charWidth, charHeight, u0, v0, u1, v1);
    }

    const drawString = (x: number, y: number, text: string) => {
        const charWidth = 8;
        for (let i = 0; i < text.length; i++) {
            drawChar(x + i * charWidth, y, text.charCodeAt(i));
        }
    };

    const drawCenterString = (y: number, text: string) => {
        const charWidth = 8;
        const width = text.length * charWidth;
        const x = (gl.canvas.width - width) / 2;
        drawString(x, y, text);
    };

    const drawfillRect = (x: number, y: number, width: number, height: number, color: [number, number, number, number]) => {
        spriteRenderer.drawRect(x, y, width, height, color);
    };

    return {
        get width() { return gl.canvas.width; },
        get height() { return gl.canvas.height; },
        get collisionVis() { return collisionVis; },
        get stats() { return gpuProfiler.stats; },
        renderFrame,
        registerPic,
        registerTexture,
        begin2D,
        end2D,
        drawPic,
        drawString,
        drawCenterString,
        drawfillRect,
    };
};
