/**
 * Per-surface state both backends derive the same way from a BSP surface's flags: blending,
 * depth writes, warp, flow scroll and its light-style factors. Was copied in each pipeline.
 */
import {
  SURF_FLOWING,
  SURF_NONE,
  SURF_SKY,
  SURF_TRANS33,
  SURF_TRANS66,
  SURF_WARP,
  type SurfaceFlag,
} from '@quake2ts/shared';

export interface SurfaceRenderState {
  readonly alpha: number;
  readonly blend: boolean;
  readonly depthWrite: boolean;
  readonly warp: boolean;
  readonly flowOffset: readonly [number, number];
  readonly sky: boolean;
}

export const DEFAULT_STYLE_INDICES: readonly number[] = [0, 255, 255, 255];
export const DEFAULT_STYLE_LAYERS: readonly number[] = [0, -1, -1, -1];

/** The four light-style multipliers of a surface: 0 for an unused slot, else the style's value (1 when unknown). */
export function resolveLightStyles(
  styleIndices: readonly number[] = DEFAULT_STYLE_INDICES,
  styleValues: ReadonlyArray<number> = []
): Float32Array {
  const factors = new Float32Array(4);
  for (let i = 0; i < 4; i += 1) {
    const styleIndex = styleIndices[i] ?? 255;
    if (styleIndex === 255) {
      factors[i] = 0;
      continue;
    }
    const value = styleValues[styleIndex];
    factors[i] = value !== undefined ? value : 1;
  }
  return factors;
}

function computeFlowOffset(timeSeconds: number): readonly [number, number] {
  const cycle = (timeSeconds * 0.25) % 1;
  return [-cycle, 0];
}

export function deriveSurfaceRenderState(
  surfaceFlags: SurfaceFlag = SURF_NONE,
  timeSeconds = 0
): SurfaceRenderState {
  const flowing = (surfaceFlags & SURF_FLOWING) !== 0;
  const warp = (surfaceFlags & SURF_WARP) !== 0;
  const sky = (surfaceFlags & SURF_SKY) !== 0;
  const trans33 = (surfaceFlags & SURF_TRANS33) !== 0;
  const trans66 = (surfaceFlags & SURF_TRANS66) !== 0;

  const alpha = trans33 ? 0.33 : trans66 ? 0.66 : 1;
  const blend = trans33 || trans66 || warp; // water blends
  const depthWrite = !blend && !sky;
  const flowOffset: readonly [number, number] = flowing ? computeFlowOffset(timeSeconds) : [0, 0];

  return { alpha, blend, depthWrite, warp, flowOffset, sky };
}
