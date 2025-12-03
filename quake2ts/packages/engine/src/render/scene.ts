import { Md2Model } from '../assets/md2.js';
import { Md3Model } from '../assets/md3.js';
import { Md2FrameBlend } from './md2Pipeline.js';
import { Md3FrameBlend, Md3LightingOptions } from './md3Pipeline.js';
import { Mat4 } from '@quake2ts/shared';

export interface RenderableMd2 {
    readonly type: 'md2';
    readonly model: Md2Model;
    readonly blend: Md2FrameBlend;
    readonly transform: Mat4;
    readonly skin?: string; // Texture name
    readonly ambientLight?: number;
    readonly alpha?: number;
    readonly id?: number; // Optional numeric ID for stable randomization
    readonly tint?: readonly [number, number, number, number];
}

export interface RenderableMd3 {
    readonly type: 'md3';
    readonly model: Md3Model;
    readonly blend: Md3FrameBlend;
    readonly transform: Mat4;
    readonly lighting?: Md3LightingOptions;
    readonly skins?: Map<string, string>; // Surface name to texture name
    readonly alpha?: number;
    readonly id?: number; // Optional numeric ID for stable randomization
    readonly tint?: readonly [number, number, number, number];
}

export type RenderableEntity = RenderableMd2 | RenderableMd3;
