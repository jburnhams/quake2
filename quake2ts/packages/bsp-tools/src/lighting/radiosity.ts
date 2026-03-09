import {
  Vec3,
  type Winding,
  copyWinding,
  windingCenter,
  windingArea,
  windingBounds,
  clipWindingEpsilon,
  windingPlane
} from '@quake2ts/shared';
import type { TreeElement } from '../compiler/tree.js';
import type { CompilePlane, CompileFace } from '../types/compile.js';
import {
  subtractVec3,
  lengthVec3,
  normalizeVec3,
  dotVec3
} from '@quake2ts/shared';
import { traceRay } from './trace.js';

export interface PatchTransfer {
  patchIndex: number;
  formFactor: number;  // How much light transfers
}

export interface Patch {
  winding: Winding;
  origin: Vec3;  // Center point
  normal: Vec3;
  area: number;
  emissive: Vec3;  // Initial emission (for lights/sky)
  totalLight: Vec3;  // Accumulated light
  numTransfers: number;
  transfers: PatchTransfer[];
}

export interface RadiosityOptions {
  bounces: number;  // Number of bounce iterations
  threshold: number;  // Minimum energy to continue
  onProgress?: (bounce: number, energy: number) => void;
}

/**
 * Subdivide faces into radiosity patches
 * Ported from q2tools/src/patches.c MakePatches
 * Default patch size is 64x64 units.
 */
export function createPatches(
  faces: CompileFace[],
  planes: CompilePlane[],
  patchSize: number = 64
): Patch[] {
  const patches: Patch[] = [];

  for (const face of faces) {
    // Only process valid faces with enough points
    if (!face.winding || face.winding.numPoints < 3) continue;

    const plane = planes[face.planeNum];
    const normal = plane.normal;

    // Start with the face's full winding
    let currentPatches: Winding[] = [copyWinding(face.winding)];

    // Queue of windings to evaluate
    const queue: Winding[] = [copyWinding(face.winding)];
    const finalWindings: Winding[] = [];

    while (queue.length > 0) {
      const w = queue.shift()!;
      const bounds = windingBounds(w);
      const sizeX = bounds.maxs.x - bounds.mins.x;
      const sizeY = bounds.maxs.y - bounds.mins.y;
      const sizeZ = bounds.maxs.z - bounds.mins.z;

      // Check if winding needs splitting
      let splitAxis = -1;
      if (sizeX > patchSize) splitAxis = 0;
      else if (sizeY > patchSize) splitAxis = 1;
      else if (sizeZ > patchSize) splitAxis = 2;

      if (splitAxis !== -1) {
        let splitNormal = { x: 0, y: 0, z: 0 };
        let splitDist = 0;

        if (splitAxis === 0) {
          splitNormal = { x: 1, y: 0, z: 0 };
          splitDist = (bounds.mins.x + bounds.maxs.x) / 2;
        } else if (splitAxis === 1) {
          splitNormal = { x: 0, y: 1, z: 0 };
          splitDist = (bounds.mins.y + bounds.maxs.y) / 2;
        } else {
          splitNormal = { x: 0, y: 0, z: 1 };
          splitDist = (bounds.mins.z + bounds.maxs.z) / 2;
        }

        const epsilon = 0.1;
        const frontW = clipWindingEpsilon(w, splitNormal, splitDist, epsilon, true);
        const backW = clipWindingEpsilon(w, splitNormal, splitDist, epsilon, false);

        // Security fix: If a split produces a child winding with the exact same
        // number of points and bounds (which happens when points fall within epsilon),
        // it means the split did nothing. This leads to an infinite loop.
        // We ensure we don't endlessly re-queue identically sized windings.
        const originalArea = windingArea(w);

        let splitSucceeded = false;
        if (frontW && backW && frontW.numPoints >= 3 && backW.numPoints >= 3) {
           const frontArea = windingArea(frontW);
           const backArea = windingArea(backW);

           // If either split piece is suspiciously close to the original area,
           // we failed to make a meaningful cut.
           if (frontArea < originalArea - 0.1 && backArea < originalArea - 0.1) {
              splitSucceeded = true;
              queue.push(frontW);
              queue.push(backW);
           }
        }

        if (!splitSucceeded) {
           // We could not split it properly, likely due to epsilon issues. Accept as-is.
           finalWindings.push(w);
        }
      } else {
        // Patch is small enough
        finalWindings.push(w);
      }
    }

    // Convert final windings to Patch objects
    for (const w of finalWindings) {
      const area = windingArea(w);
      if (area < 1.0) continue; // Ignore tiny slivers

      const origin = windingCenter(w);

      patches.push({
        winding: w,
        origin,
        normal: { x: normal.x, y: normal.y, z: normal.z },
        area,
        emissive: { x: 0, y: 0, z: 0 }, // Setup later based on texture/light
        totalLight: { x: 0, y: 0, z: 0 },
        numTransfers: 0,
        transfers: []
      });
    }
  }

  return patches;
}

/**
 * Calculate form factor between two patches
 * (How much light transfers from one to another)
 * Ported from q2tools/src/patches.c MakeTransfers
 */
export function calculateFormFactor(
  source: Patch,
  dest: Patch,
  tree: TreeElement,
  planes: CompilePlane[]
): number {
  // Vector from dest to source
  const delta = subtractVec3(source.origin, dest.origin);
  const dist = lengthVec3(delta);

  // Very close patches (e.g. adjacent faces) might cause math issues
  if (dist < 1.0) {
    return 0;
  }

  const dir = normalizeVec3(delta);

  // Calculate angles
  // Normal of dest must face source
  const dotDest = dotVec3(dest.normal, dir);
  if (dotDest <= 0.001) {
    return 0; // Source is behind dest
  }

  // Normal of source must face dest (dir is dest->source, so -dir is source->dest)
  const dotSource = dotVec3(source.normal, { x: -dir.x, y: -dir.y, z: -dir.z });
  if (dotSource <= 0.001) {
    return 0; // Dest is behind source
  }

  // Check visibility (shadow ray)
  // q2tools uses TestLine for visibility. Trace from dest to source.
  const trace = traceRay(dest.origin, source.origin, tree, planes);
  if (trace.hit) {
    return 0; // Blocked by geometry
  }

  // Standard radiosity form factor formula
  // FormFactor = (cos(theta1) * cos(theta2) * Area) / (pi * r^2)
  // Q2 approximation
  let formFactor = (dotDest * dotSource) / (dist * dist);

  // Adjust for source area (larger source emits more light)
  // Note: Standard form factor to calculate light *received* by dest from source
  // needs to be multiplied by the area of the source.
  formFactor *= source.area;

  return formFactor;
}

/**
 * Compute radiosity with light bouncing
 * Ported from q2tools/src/rad.c BounceLight
 */
export function computeRadiosity(
  patches: Patch[],
  tree: TreeElement,
  planes: CompilePlane[],
  options?: RadiosityOptions
): void {
  const bounces = options?.bounces ?? 2;
  const threshold = options?.threshold ?? 1.0;

  // Initialize transfer data
  // Q2 optimizes this by building a compressed sparse matrix of form factors,
  // since form factors are symmetric and mostly zero.
  // We'll calculate them on the fly for simplicity unless we find it too slow.

  // Initialize emissive values
  let currentEnergy = new Float32Array(patches.length * 3);
  let nextEnergy = new Float32Array(patches.length * 3);
  let totalEnergy = new Float32Array(patches.length * 3);

  let startEnergy = 0;

  for (let i = 0; i < patches.length; i++) {
    const p = patches[i];

    // Seed total light with initial direct light + emissive
    p.totalLight = { x: p.emissive.x, y: p.emissive.y, z: p.emissive.z };

    // First bounce distributes emissive light
    currentEnergy[i * 3 + 0] = p.emissive.x;
    currentEnergy[i * 3 + 1] = p.emissive.y;
    currentEnergy[i * 3 + 2] = p.emissive.z;

    startEnergy += p.emissive.x + p.emissive.y + p.emissive.z;
  }

  // Iterate bounces
  for (let bounce = 0; bounce < bounces; bounce++) {
    let bounceEnergy = 0;
    nextEnergy.fill(0);

    for (let i = 0; i < patches.length; i++) {
      const source = patches[i];

      // Skip patches with no energy to give
      const r = currentEnergy[i * 3 + 0];
      const g = currentEnergy[i * 3 + 1];
      const b = currentEnergy[i * 3 + 2];

      if (r < threshold && g < threshold && b < threshold) {
        continue;
      }

      // Distribute light to all other patches
      for (let j = 0; j < patches.length; j++) {
        if (i === j) continue; // Don't self-illuminate directly

        const dest = patches[j];
        const ff = calculateFormFactor(source, dest, tree, planes);

        if (ff > 0) {
          // Add light to dest's *next* energy buffer
          nextEnergy[j * 3 + 0] += r * ff;
          nextEnergy[j * 3 + 1] += g * ff;
          nextEnergy[j * 3 + 2] += b * ff;

          // Also accumulate to total light directly so we don't need a final pass
          dest.totalLight = {
            x: dest.totalLight.x + r * ff,
            y: dest.totalLight.y + g * ff,
            z: dest.totalLight.z + b * ff
          };

          bounceEnergy += (r + g + b) * ff;
        }
      }
    }

    if (options?.onProgress) {
      options.onProgress(bounce, bounceEnergy);
    }

    // Swap buffers
    const temp = currentEnergy;
    currentEnergy = nextEnergy;
    nextEnergy = temp;

    // Early exit if energy dissipates
    if (bounceEnergy < threshold) {
      break;
    }
  }
}
