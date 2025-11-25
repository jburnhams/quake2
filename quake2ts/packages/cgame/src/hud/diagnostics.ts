import { FrameRenderStats, Renderer } from '@quake2ts/shared/dist/cgame/interfaces';

export const Draw_Diagnostics = (renderer: Renderer, stats: FrameRenderStats) => {
    const lines = [
        `FPS: ${stats.fps}`,
        `GPU Time: ${stats.gpuTimeMs.toFixed(2)}ms`,
        `Draw Calls: ${stats.drawCalls}`,
        `Batches: ${stats.batches}`,
        `Faces Drawn: ${stats.facesDrawn}`,
        `Vertices: ${stats.vertexCount}`,
    ];

    let y = 10;
    for (const line of lines) {
        renderer.drawString(10, y, line);
        y += 10;
    }
};
