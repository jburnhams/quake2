
import { createEngine, VirtualFileSystem, ingestPakFiles, BspLoader, AssetManager, createWebGLContext, Camera } from '@quake2ts/engine';
import { createClient } from '@quake2ts/client';
import { createGame } from '@quake2ts/game';
import { createLandingPage } from './ui/landing.js';
import { createMapSelectPage } from './ui/mapSelect.js';
import { BspRenderer } from './demo/BspRenderer.js';
import { Mat4, Vec3 } from '@quake2ts/shared';
import { DemoPlayer } from './demo/DemoPlayer.js';
import { createBspTrace } from './demo/BspTrace.js';
import { DebugOverlay } from './debug/DebugOverlay.js';

const vfs = new VirtualFileSystem();

async function main() {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const gl = createWebGLContext(canvas);

    createLandingPage(async (files) => {
        console.log('files', files);

        await ingestPakFiles(vfs, Array.from(files));

        const maps = vfs.findAllFiles('maps/')
            .filter(f => f.endsWith('.bsp'))
            .map(f => f.substring(5, f.length - 4));

        createMapSelectPage(maps, async (mapName) => {
            const mapPath = `maps/${mapName}.bsp`;
            const bspLoader = new BspLoader(vfs);
            const map = await bspLoader.load(mapPath);

            const assetManager = new AssetManager(vfs);
            const bspRenderer = await BspRenderer.create(gl, assetManager, map);

            const trace = createBspTrace(map);
            const player = new DemoPlayer(trace);

            const camera = new Camera({
                fov: 75,
                aspect: gl.canvas.width / gl.canvas.height,
                near: 0.1,
                far: 10000,
            });

            const spawn = map.entities.entities.find(e => e.classname === 'info_player_start');
            if (spawn) {
                const origin = spawn.properties.origin.split(' ').map(Number);
                const angle = parseFloat(spawn.properties.angle);
                player.spawn({ origin, angle });
            }

            const debugOverlay = new DebugOverlay();

            let forward = 0;
            let right = 0;
            let up = 0;

            window.addEventListener('keydown', (e) => {
                if (e.key === 'w') forward = 1;
                if (e.key === 's') forward = -1;
                if (e.key === 'a') right = -1;
                if (e.key === 'd') right = 1;
                if (e.key === ' ') up = 1;
                if (e.key === 'c') up = -1;
            });

            window.addEventListener('keyup', (e) => {
                if (e.key === 'w' || e.key === 's') forward = 0;
                if (e.key === 'a' || e.key === 'd') right = 0;
                if (e.key === ' ' || e.key === 'c') up = 0;
            });

            canvas.addEventListener('mousemove', (e) => {
                if (document.pointerLockElement === canvas) {
                    camera.rotate(e.movementY, e.movementX, 0);
                }
            });

            canvas.addEventListener('click', () => {
                canvas.requestPointerLock();
            });

            let lastTime = 0;
            function renderLoop(time: number) {
                const dt = (time - lastTime) / 1000;
                lastTime = time;

                player.move(camera, forward, right, up, dt);

                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                bspRenderer.render(camera, map);

                debugOverlay.update({
                    position: player.state.origin,
                    velocity: player.state.velocity,
                });

                requestAnimationFrame(renderLoop);
            }

            requestAnimationFrame(renderLoop);
        });
    });
}

main();
