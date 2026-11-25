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
import { boxIntersectsFrustum, extractFrustumPlanes, transformAabb } from './culling.js';
import { mat4 } from 'gl-matrix';
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
  /** Model matrix for a brush model's face (a door, a lift); undefined for the world, which is drawn as the map places it. */
  readonly transform?: Float32Array;
  /** True when this draw's textures, flags, styles or transform differ from the previous draw in its pass. */
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

/**
 * A brush model the game has placed this frame: an entity whose model is a BSP submodel ("*1"),
 * such as a door, a lift, a button or a train, at its entity's origin and angles.
 */
export interface BrushModelInstance {
  /** Submodel number: 1 for "*1". Model 0 is the world, which is always drawn. */
  readonly model: number;
  readonly origin: { readonly x: number; readonly y: number; readonly z: number };
  /** Pitch, yaw and roll in degrees, as an entity's `angles`. */
  readonly angles?: { readonly x: number; readonly y: number; readonly z: number };
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
  /** Brush models to draw this frame, each at its entity's position. */
  readonly brushModels?: readonly BrushModelInstance[];
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

type Angles = { readonly x: number; readonly y: number; readonly z: number };

/**
 * R_RotateForEntity: move to the origin, then turn by yaw about z, -pitch about y and -roll
 * about x. Callers flip signs first, as the original's do.
 */
export function rotateForEntity(origin: Angles, angles: Angles | undefined): Float32Array {
  const m = mat4.create();
  mat4.translate(m, m, [origin.x, origin.y, origin.z]);
  if (angles) {
    const rad = Math.PI / 180;
    if (angles.y) mat4.rotateZ(m, m, angles.y * rad);
    if (angles.x) mat4.rotateY(m, m, -angles.x * rad);
    if (angles.z) mat4.rotateX(m, m, -angles.z * rad);
  }
  return m as Float32Array;
}

/**
 * A brush model's model matrix. R_DrawBrushModel negates pitch and roll before
 * R_RotateForEntity ("stupid quake bug"), cancelling its negations, so the drawn model turns the
 * same way as its collision model (angleVectors with positive pitch and roll).
 */
export function brushModelTransform(instance: BrushModelInstance): Float32Array {
  const a = instance.angles;
  return rotateForEntity(instance.origin, a && { x: -a.x, y: a.y, z: -a.z });
}

/** As gl_rsurf.c: a face this close to edge-on still counts as facing the camera. */
const BACKFACE_EPSILON = 0.01;

interface PlacedFace extends VisibleFace {
  readonly transform?: Float32Array;
}

/**
 * The faces of each brush model in view, with its transform. R_DrawBrushModel culls a model by
 * its bounds and draws all its faces; it does not walk the PVS, because the server only sends
 * entities the player can see.
 */
function gatherBrushModelFaces(
  map: BspMap,
  instances: readonly BrushModelInstance[],
  frustum: ReturnType<typeof extractFrustumPlanes>,
  camera: { readonly x: number; readonly y: number; readonly z: number }
): PlacedFace[] {
  const faces: PlacedFace[] = [];
  for (const instance of instances) {
    const model = map.models?.[instance.model];
    if (!model || instance.model === 0) continue;
    const transform = brushModelTransform(instance);
    const bounds = transformAabb(
      { x: model.mins[0], y: model.mins[1], z: model.mins[2] },
      { x: model.maxs[0], y: model.maxs[1], z: model.maxs[2] },
      transform as unknown as Parameters<typeof transformAabb>[2]
    );
    if (!boxIntersectsFrustum(bounds.mins, bounds.maxs, frustum)) continue;
    const dx = (bounds.mins.x + bounds.maxs.x) * 0.5 - camera.x;
    const dy = (bounds.mins.y + bounds.maxs.y) * 0.5 - camera.y;
    const dz = (bounds.mins.z + bounds.maxs.z) * 0.5 - camera.z;
    const sortKey = -(dx * dx + dy * dy + dz * dz);
    // The camera in the model's own space, to drop faces turned away from it as
    // R_DrawInlineBModel does (a glass pane's back faces would otherwise blend over its front).
    const inverse = mat4.invert(mat4.create(), transform);
    const org = inverse
      ? [
          inverse[0] * camera.x + inverse[4] * camera.y + inverse[8] * camera.z + inverse[12],
          inverse[1] * camera.x + inverse[5] * camera.y + inverse[9] * camera.z + inverse[13],
          inverse[2] * camera.x + inverse[6] * camera.y + inverse[10] * camera.z + inverse[14],
        ]
      : undefined;
    for (let i = 0; i < model.numFaces; i++) {
      const faceIndex = model.firstFace + i;
      const face = map.faces?.[faceIndex];
      const plane = face ? map.planes?.[face.planeIndex] : undefined;
      if (org && face && plane) {
        const dot = org[0] * plane.normal[0] + org[1] * plane.normal[1] + org[2] * plane.normal[2] - plane.dist;
        if (face.side ? dot > -BACKFACE_EPSILON : dot < BACKFACE_EPSILON) continue;
      }
      faces.push({ faceIndex, leafIndex: -1, sortKey, transform });
    }
  }
  return faces;
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
  const visible: PlacedFace[] = world.map ? gather(world.map, options.cameraPosition, frustum, options.portalState) : [];
  if (world.map && options.brushModels?.length) {
    visible.push(...gatherBrushModelFaces(world.map, options.brushModels, frustum, options.cameraPosition));
  }

  const opaqueFaces: PlacedFace[] = [];
  const transparentFaces: PlacedFace[] = [];
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

  const toDraws = (faces: readonly PlacedFace[]): WorldDraw<TSurface>[] => {
    const draws: WorldDraw<TSurface>[] = [];
    let previous: WorldDraw<TSurface> | undefined;
    for (const { faceIndex, transform } of faces) {
      const surface = world.surfaces[faceIndex]!;
      const material = world.materials?.getMaterial(surface.texture);
      const texture = animatedTextureName(world.map, faceIndex, timeSeconds) ?? surface.texture;

      let renderMode = options.renderMode;
      if (renderMode && !renderMode.applyToAll && (options.hasTexture?.(texture) ?? true)) {
        renderMode = undefined;
      }

      const styleIndices = surface.styleIndices ?? DEFAULT_STYLE_INDICES;
      // Translucent and warping surfaces are drawn unlit, at their texture's colour, as
      // R_DrawAlphaSurfaces does, even where qbsp stored a lightmap for them.
      const lightmapAtlas =
        options.disableLightmaps || isTransparentSurface(surface.surfaceFlags) ? undefined : surface.lightmap?.atlasIndex;
      const startsBatch =
        !previous ||
        previous.texture !== texture ||
        previous.lightmapAtlas !== lightmapAtlas ||
        previous.surface.surfaceFlags !== surface.surfaceFlags ||
        previous.transform !== transform ||
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
        transform,
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
