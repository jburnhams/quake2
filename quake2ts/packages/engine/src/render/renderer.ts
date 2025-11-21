
import { Mat4, multiplyMat4, createMat4Identity } from '@quake2ts/shared';
import { BspSurfacePipeline } from './bspPipeline.js';
import { Camera } from './camera.js';
import { createFrameRenderer, FrameRenderOptions } from './frame.js';
import { Md2Pipeline } from './md2Pipeline.js';
import { Md3ModelMesh, Md3Pipeline } from './md3Pipeline.js';
import { RenderableEntity } from './scene.js';
import { SkyboxPipeline } from './skybox.js';
import { SpriteRenderer } from './sprite.js';
import { Texture2D } from './resources.js';
import { parsePcx, pcxToRgba } from '../assets/pcx.js';

// A handle to a registered picture.
export type Pic = Texture2D;

export interface Renderer {
    renderFrame(options: FrameRenderOptions, entities: readonly RenderableEntity[]): void;

    // HUD Methods
    registerPic(name: string, data: ArrayBuffer): Promise<Pic>;
    drawPic(x: number, y: number, pic: Pic): void;
    drawString(x: number, y: number, text: string): void;
}

export const createRenderer = (
    gl: WebGL2RenderingContext,
): Renderer => {
    const bspPipeline = new BspSurfacePipeline(gl);
    const skyboxPipeline = new SkyboxPipeline(gl);
    const md2Pipeline = new Md2Pipeline(gl);
    const md3Pipeline = new Md3Pipeline(gl);
    const spriteRenderer = new SpriteRenderer(gl);

    const md3MeshCache = new Map<object, Md3ModelMesh>();
    const picCache = new Map<string, Pic>();
    let font: Pic | null = null;

    const frameRenderer = createFrameRenderer(gl, bspPipeline, skyboxPipeline);

    const renderFrame = (options: FrameRenderOptions, entities: readonly RenderableEntity[]) => {
        // 1. Clear buffers, render world, sky, and viewmodel
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);

        const stats = frameRenderer.renderFrame(options);
        const viewProjection = options.camera.viewProjectionMatrix;

        // 2. Render models (entities)
        for (const entity of entities) {
            switch (entity.type) {
                case 'md2':
                    // TODO: implement MD2 rendering
                    break;
                case 'md3':
                    {
                        let mesh = md3MeshCache.get(entity.model);
                        if (!mesh) {
                            mesh = new Md3ModelMesh(gl, entity.model, entity.blend, entity.lighting);
                            md3MeshCache.set(entity.model, mesh);
                        } else {
                            mesh.update(entity.blend, entity.lighting);
                        }

                        const modelViewProjection = multiplyMat4(viewProjection as Float32Array, entity.transform);
                        md3Pipeline.bind(modelViewProjection);

                        for (const surface of entity.model.surfaces) {
                            const surfaceMesh = mesh.surfaces.get(surface.name);
                            if (surfaceMesh) {
                                md3Pipeline.drawSurface(surfaceMesh);
                            }
                        }
                    }
                    break;
            }
        }
    };

    const registerPic = async (name: string, data: ArrayBuffer): Promise<Pic> => {
        if (picCache.has(name)) {
            return picCache.get(name)!;
        }

        // For now, assume all pics are PCX. A more robust solution would inspect the data.
        const pcx = parsePcx(data);
        const rgba = pcxToRgba(pcx);
        const texture = new Texture2D(gl);
        texture.upload(pcx.width, pcx.height, rgba);
        picCache.set(name, texture);

        if (name === 'pics/conchars.pcx') {
            font = texture;
        }

        return texture;
    };

    const begin2D = () => {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.DEPTH_TEST);
        gl.depthMask(false);

        const projection = createMat4Identity();
        // A simple orthographic projection.
        // A more robust solution would use mat4.ortho and handle resizing.
        projection[0] = 2 / gl.canvas.width;
        projection[5] = -2 / gl.canvas.height;
        projection[12] = -1;
        projection[13] = 1;

        spriteRenderer.begin(projection);
    };

    const drawPic = (x: number, y: number, pic: Pic) => {
        begin2D();
        pic.bind(0);
        spriteRenderer.draw(x, y, pic.width, pic.height);
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

        // This is inefficient. A better solution would batch all characters.
        begin2D();
        font.bind(0);
        spriteRenderer.draw(x, y, charWidth, charHeight, u0, v0, u1, v1);
    }

    const drawString = (x: number, y: number, text: string) => {
        const charWidth = 8;
        for (let i = 0; i < text.length; i++) {
            drawChar(x + i * charWidth, y, text.charCodeAt(i));
        }
    };

    return {
        renderFrame,
        registerPic,
        drawPic,
        drawString,
    };
};
