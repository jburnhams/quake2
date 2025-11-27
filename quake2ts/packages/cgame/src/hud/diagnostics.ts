import { Renderer, FrameRenderStats } from '@quake2ts/engine';

export const Draw_Diagnostics = (renderer: Renderer, stats: FrameRenderStats) => {
    const lines = [
        `FPS: ${stats.fps}`,
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
