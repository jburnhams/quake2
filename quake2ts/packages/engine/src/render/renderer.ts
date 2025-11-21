
import { Mat4, multiplyMat4 } from '@quake2ts/shared';
import { mat4 } from 'gl-matrix';
import { BspSurfacePipeline } from './bspPipeline.js';
import { Camera } from './camera.js';
import { createFrameRenderer, FrameRenderOptions } from './frame.js';
import { Md2Pipeline } from './md2Pipeline.js';
import { Md3ModelMesh, Md3Pipeline } from './md3Pipeline.js';
import { RenderableEntity } from './scene.js';
import { SkyboxPipeline } from './skybox.js';
import { SpriteRenderer } from './sprite.js';
import { Texture2D } from './resources.js';

// A handle to a registered picture.
export type Pic = Texture2D;

export interface Renderer {
    renderFrame(options: FrameRenderOptions, entities: readonly RenderableEntity[]): void;

    // HUD Methods
    registerPic(name: string, data: ArrayBuffer): Promise<Pic>;
    begin2D(): void;
    end2D(): void;
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
        let lastTexture: Texture2D | undefined;

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

    const drawPic = (x: number, y: number, pic: Pic) => {
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
        begin2D,
        end2D,
        drawPic,
        drawString,
    };
};
