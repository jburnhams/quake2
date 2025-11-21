
import { createEngine, VirtualFileSystem, ingestPakFiles, BspLoader, AssetManager, createWebGLContext, Camera } from '@quake2ts/engine';
import { createLandingPage } from './ui/landing.js';
import { BspRenderer } from './demo/BspRenderer.js';
import { Mat4, Vec3 } from '@quake2ts/shared';

const vfs = new VirtualFileSystem();

async function main() {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const gl = createWebGLContext(canvas);

    createLandingPage(async (files) => {
        console.log('files', files);

        await ingestPakFiles(vfs, Array.from(files));

        const mapName = 'base1'; // Hardcoded for now
        const mapPath = `maps/${mapName}.bsp`;
        const bspLoader = new BspLoader(vfs);
        const map = await bspLoader.load(mapPath);

        const assetManager = new AssetManager(vfs);
        const bspRenderer = await BspRenderer.create(gl, assetManager, map);

        const camera = new Camera({
            fov: 75,
            aspect: gl.canvas.width / gl.canvas.height,
            near: 0.1,
            far: 10000,
        });

        const spawn = map.entities.entities.find(e => e.classname === 'info_player_start');
        if (spawn) {
            const origin = spawn.properties.origin.split(' ').map(Number);
            camera.position = { x: origin[0], y: origin[1], z: origin[2] };
        }

        function renderLoop() {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            bspRenderer.render(camera, map);
            requestAnimationFrame(renderLoop);
        }

        requestAnimationFrame(renderLoop);
    });
}

main();
