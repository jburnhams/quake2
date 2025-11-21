
import { Mat4, multiplyMat4 } from '@quake2ts/shared';
import { BspSurfacePipeline } from './bspPipeline.js';
import { Camera } from './camera.js';
import { createFrameRenderer, FrameRenderOptions, FrameRenderer } from './frame.js';
import { Md2Pipeline } from './md2Pipeline.js';
import { Md3ModelMesh, Md3Pipeline } from './md3Pipeline.js';
import { RenderableEntity } from './scene.js';
import { SkyboxPipeline } from './skybox.js';

export interface Renderer {
    renderFrame(options: FrameRenderOptions, entities: readonly RenderableEntity[]): void;
}

export const createRenderer = (
    gl: WebGL2RenderingContext,
): Renderer => {
    const bspPipeline = new BspSurfacePipeline(gl);
    const skyboxPipeline = new SkyboxPipeline(gl);
    const md2Pipeline = new Md2Pipeline(gl);
    const md3Pipeline = new Md3Pipeline(gl);
    const md3MeshCache = new Map<object, Md3ModelMesh>();

    const frameRenderer = createFrameRenderer(gl, bspPipeline, skyboxPipeline);

    const renderFrame = (options: FrameRenderOptions, entities: readonly RenderableEntity[]) => {
        // 1. Clear buffers, render world, sky, and viewmodel
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

                        const modelViewProjection = multiplyMat4(viewProjection, entity.transform);
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

        // 3. Render particles
        // TODO: implement

        // 4. Switch to 2D mode, render HUD
        // The client is responsible for drawing the HUD.
    };

    return {
        renderFrame,
    };
};
