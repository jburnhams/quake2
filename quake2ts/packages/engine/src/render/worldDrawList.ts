/**
 * The shared front end of the world pass. Both backends used to repeat this frame logic in
 * their own `frame.ts` (PVS and frustum walk, opaque/transparent split, sort, light styles,
 * material lookup, batching); now it runs once, with no GPU calls, and each backend only
 * executes the list: resolve the draw's texture names to its own textures, bind, draw.
 *
 * Running in Node, it is also what unit tests check against a real map (visible face counts,
 * order, batches) without a GPU.
 */
import { SURF_SKY, SURF_TRANS33, SURF_TRANS66, SURF_WARP, type SurfaceFlag } from '@quake2ts/shared';
import type { BspMap } from '../assets/bsp.js';
import { gatherVisibleFaces, type VisibleFace } from './bspTraversal.js';
import { extractFrustumPlanes } from './culling.js';
import type { RenderModeConfig } from './frame.js';
import type { MaterialManager } from './materials.js';
import { sortBackToFront, sortFrontToBack } from './utils/geometry.js';
import { prepareLightStyles } from './utils/lighting.js';
import { DEFAULT_STYLE_INDICES, DEFAULT_STYLE_LAYERS } from './utils/surface.js';

/** What the draw list reads from a world surface: the CPU fields both backends' surfaces share. */
export interface WorldDrawSurface {
  readonly texture: string;
  readonly surfaceFlags: SurfaceFlag;
  readonly lightmap?: { readonly atlasIndex: number };
  readonly styleIndices?: readonly number[];
  readonly styleLayers?: readonly number[];
  readonly vertexCount: number;
}

/** The world as the front end needs it: the map for visibility and surfaces by BSP face number. */
export interface WorldDrawInput<TSurface extends WorldDrawSurface = WorldDrawSurface> {
  readonly map: BspMap;
  readonly surfaces: readonly (TSurface | undefined)[];
  readonly materials?: MaterialManager;
  readonly lightStyles?: ReadonlyArray<number>;
}

export interface WorldDraw<TSurface extends WorldDrawSurface = WorldDrawSurface> {
  readonly faceIndex: number;
  readonly surface: TSurface;
  /** Diffuse texture name: for an animated (`+0name`) texture, the frame current at this time. */
  readonly texture: string;
  /** Lightmap atlas page, or undefined to draw without a lightmap. */
  readonly lightmapAtlas: number | undefined;
  readonly styleIndices: readonly number[];
  readonly styleLayers: readonly number[];
  /** Material scroll and warp, when a material sets them; otherwise the pipeline derives them from the flags. */
  readonly texScroll?: readonly [number, number];
  readonly warp?: boolean;
  /** Render mode for this draw (a debug mode limited to untextured surfaces applies only where the texture is missing). */
  readonly renderMode?: RenderModeConfig;
  /** True when this draw's textures, flags or styles differ from the previous draw in its pass. */
  readonly startsBatch: boolean;
}

export interface WorldDrawList<TSurface extends WorldDrawSurface = WorldDrawSurface> {
  /** Front to back, so early depth rejects hidden pixels. */
  readonly opaque: readonly WorldDraw<TSurface>[];
  /** Translucent and warping surfaces, back to front for blending. */
  readonly transparent: readonly WorldDraw<TSurface>[];
  /** Light style values (index = style number) with overrides applied. */
  readonly lightStyles: ReadonlyArray<number>;
  /** Number of draws that start a batch, over both passes. */
  readonly batches: number;
  readonly vertexCount: number;
}

export interface WorldDrawListOptions {
  readonly cameraPosition: { readonly x: number; readonly y: number; readonly z: number };
  readonly viewProjection: ArrayLike<number>;
  readonly timeSeconds?: number;
  readonly portalState?: ReadonlyArray<boolean>;
  readonly lightStyleOverrides?: Map<number, string>;
  readonly renderMode?: RenderModeConfig;
  readonly disableLightmaps?: boolean;
  /** Whether the backend has a texture by this name; used for render modes limited to untextured surfaces. */
  readonly hasTexture?: (name: string) => boolean;
  /** Replace the PVS walk and frustum extraction (tests). */
  readonly gatherVisibleFaces?: typeof gatherVisibleFaces;
  readonly extractFrustumPlanes?: typeof extractFrustumPlanes;
}

/** Light styles every map has: 64 entries at full value unless the world gives more. */
const MIN_LIGHT_STYLES = 64;

export function isTransparentSurface(flags: SurfaceFlag): boolean {
  return (flags & (SURF_TRANS33 | SURF_TRANS66 | SURF_WARP)) !== 0;
}

/**
 * The texture a face shows at a time, following its texinfo's animation chain at 2 frames a
 * second as R_TextureAnimation does for the world. Undefined when the face does not animate.
 */
export function animatedTextureName(map: BspMap, faceIndex: number, timeSeconds: number): string | undefined {
  const first = map.faces?.[faceIndex]?.texInfo ?? -1;
  const start = map.texInfo?.[first];
  if (!start || start.nextTexInfo < 0) return undefined;
  let frames = 1;
  for (let i = start.nextTexInfo; i !== first && i >= 0 && frames < 64; i = map.texInfo[i]?.nextTexInfo ?? -1) frames++;
  let index = first;
  for (let step = Math.floor(timeSeconds * 2) % frames; step > 0; step--) index = map.texInfo[index].nextTexInfo;
  return map.texInfo[index]?.texture;
}

export function buildWorldDrawList<TSurface extends WorldDrawSurface>(
  world: WorldDrawInput<TSurface>,
  options: WorldDrawListOptions
): WorldDrawList<TSurface> {
  const timeSeconds = options.timeSeconds ?? 0;
  world.materials?.update(timeSeconds);

  const frustum = (options.extractFrustumPlanes ?? extractFrustumPlanes)(Array.from(options.viewProjection));
  const gather = options.gatherVisibleFaces ?? gatherVisibleFaces;
  // A world with no map (model-only scenes) has nothing to walk.
  const visible = world.map ? gather(world.map, options.cameraPosition, frustum, options.portalState) : [];

  const opaqueFaces: VisibleFace[] = [];
  const transparentFaces: VisibleFace[] = [];
  for (const face of visible) {
    const surface = world.surfaces[face.faceIndex];
    if (!surface || (surface.surfaceFlags & SURF_SKY) !== 0) continue;
    (isTransparentSurface(surface.surfaceFlags) ? transparentFaces : opaqueFaces).push(face);
  }

  const baseStyles = [...(world.lightStyles ?? [])];
  while (baseStyles.length < MIN_LIGHT_STYLES) baseStyles.push(1);
  const lightStyles = prepareLightStyles(baseStyles, options.lightStyleOverrides, timeSeconds);

  let batches = 0;
  let vertexCount = 0;

  const toDraws = (faces: readonly VisibleFace[]): WorldDraw<TSurface>[] => {
    const draws: WorldDraw<TSurface>[] = [];
    let previous: WorldDraw<TSurface> | undefined;
    for (const { faceIndex } of faces) {
      const surface = world.surfaces[faceIndex]!;
      const material = world.materials?.getMaterial(surface.texture);
      const texture = animatedTextureName(world.map, faceIndex, timeSeconds) ?? surface.texture;

      let renderMode = options.renderMode;
      if (renderMode && !renderMode.applyToAll && (options.hasTexture?.(texture) ?? true)) {
        renderMode = undefined;
      }

      const styleIndices = surface.styleIndices ?? DEFAULT_STYLE_INDICES;
      const lightmapAtlas = options.disableLightmaps ? undefined : surface.lightmap?.atlasIndex;
      const startsBatch =
        !previous ||
        previous.texture !== texture ||
        previous.lightmapAtlas !== lightmapAtlas ||
        previous.surface.surfaceFlags !== surface.surfaceFlags ||
        previous.styleIndices.join() !== styleIndices.join();
      if (startsBatch) batches++;
      vertexCount += surface.vertexCount;

      const draw: WorldDraw<TSurface> = {
        faceIndex,
        surface,
        texture,
        lightmapAtlas,
        styleIndices,
        styleLayers: surface.styleLayers ?? DEFAULT_STYLE_LAYERS,
        texScroll: material?.scrollOffset,
        warp: material?.warp,
        renderMode,
        startsBatch,
      };
      draws.push(draw);
      previous = draw;
    }
    return draws;
  };

  const opaque = toDraws(sortFrontToBack(opaqueFaces));
  const transparent = toDraws(sortBackToFront(transparentFaces));
  return { opaque, transparent, lightStyles, batches, vertexCount };
}
