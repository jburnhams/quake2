import { FrameRenderOptions } from './frame.js';
import { RenderOptions } from './options.js'; // Corrected import
import { RenderableEntity } from './scene.js';
import { PreparedTexture } from '../assets/texture.js';
import { DebugMode } from './debugMode.js';
import { RenderStatistics } from './gpuProfiler.js';
import { MemoryUsage } from './types.js'; // Corrected import
import { CollisionVisRenderer } from './collisionVis.js';
import { DebugRenderer } from './debug.js';
import { ParticleSystem } from './particleSystem.js';
import { InstanceData } from './instancing.js';
import { Md2Model } from '../assets/md2.js';
import { Md3Model } from '../assets/md3.js';
import { Texture2D } from './resources.js';

// A handle to a registered picture.
export type Pic = Texture2D; // Or a more generic interface if needed for WebGPU

export interface IRenderer {
    readonly width: number;
    readonly height: number;

    // These might need to be abstracted further if implementations differ significantly,
    // but for now we keep them as part of the interface.
    readonly collisionVis: CollisionVisRenderer;
    readonly debug: DebugRenderer;
    readonly particleSystem: ParticleSystem;

    getPerformanceReport(): RenderStatistics;
    getMemoryUsage(): MemoryUsage;

    renderFrame(options: FrameRenderOptions, entities: readonly RenderableEntity[], renderOptions?: RenderOptions): void;
    renderInstanced(model: Md2Model | Md3Model, instances: InstanceData[]): void;

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

    // Post Process
    setUnderwaterWarp(enabled: boolean): void;
    setBloom(enabled: boolean): void;
    setBloomIntensity(value: number): void;
}
