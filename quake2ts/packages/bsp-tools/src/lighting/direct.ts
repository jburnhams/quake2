import { Vec3, dotVec3, scaleVec3, subtractVec3, normalizeVec3 } from '@quake2ts/shared';
import type { Light } from './lights.js';
import type { TreeElement, TreeNode } from '../compiler/tree.js';
import type { CompilePlane, CompileFace } from '../types/compile.js';
import type { BspTexInfo } from '../types/bsp.js';
import { isInShadow } from './trace.js';
import { LightmapInfo, generateSamplePoints } from './lightmap.js';

function lengthVec3(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export interface LightSample {
  color: Vec3;  // RGB, can exceed 1.0
}

/**
 * Calculate direct lighting at a sample point
 * Ported from q2tools/src/lightmap.c LightContributionToPoint
 */
export function calculateDirectLight(
  point: Vec3,
  normal: Vec3,
  lights: Light[],
  tree: TreeElement,
  planes: CompilePlane[]
): LightSample {
  let r = 0, g = 0, b = 0;

  for (const light of lights) {
    if (light.type === 'sun') {
      // Sun/directional light
      const dir = light.direction!;
      const dot = dotVec3(dir, normal);

      // Light is coming FROM dir. In Q2, normal dot -dir > 0 means lit.
      if (dot > 0) continue; // Face is pointing same way as light, so away from light source

      const dot2 = -dot;

      if (isInShadow(point, light, tree, planes)) continue;

      r += light.color.x * light.intensity * dot2;
      g += light.color.y * light.intensity * dot2;
      b += light.color.z * light.intensity * dot2;

      continue;
    }

    // Point or spot light
    const delta = subtractVec3(light.origin, point);
    const dist = lengthVec3(delta);

    // Very close?
    if (dist < 1.0) continue;

    const dir = scaleVec3(delta, 1.0 / dist);
    const dot = dotVec3(dir, normal);

    // Face points away from light
    if (dot <= 0.001) continue;

    // Check shadow
    if (isInShadow(point, light, tree, planes)) continue;

    let scale = 0;

    // Default linear falloff (Q2 style)
    if (light.falloff === 'inverse') {
      scale = (light.intensity / dist) * dot;
    } else if (light.falloff === 'inverse_square') {
      scale = (light.intensity / (dist * dist)) * dot;
    } else {
      // Linear falloff, intensity - wait * dist. Let's use standard Q2 formula
      const wait = 1.0;
      scale = (light.intensity - wait * dist) * dot;
      if (scale < 0) scale = 0;
    }

    if (light.type === 'spot' && light.direction) {
      // Spot attenuation
      const spotDot = -dotVec3(dir, light.direction);
      const outerCos = Math.cos((light.outerCone || 10) * Math.PI / 180);
      const innerCos = Math.cos((light.innerCone || 0) * Math.PI / 180);

      if (spotDot < outerCos) {
        scale = 0;
      } else if (spotDot < innerCos) {
        // smooth falloff
        scale *= (spotDot - outerCos) / (innerCos - outerCos);
      }
    }

    if (scale > 0) {
      r += light.color.x * scale;
      g += light.color.y * scale;
      b += light.color.z * scale;
    }
  }

  return { color: { x: r, y: g, z: b } as Vec3 };
}

/**
 * Calculate lighting for all samples on a face
 */
export function lightFace(
  face: CompileFace,
  lightmapInfo: LightmapInfo,
  texInfo: BspTexInfo,
  lights: Light[],
  tree: TreeElement,
  planes: CompilePlane[]
): LightSample[] {
  const samples: LightSample[] = [];
  const points = generateSamplePoints(face, lightmapInfo, texInfo, planes);
  const normal = planes[face.planeNum].normal;

  // Q2 nudges sample points slightly off the face to avoid self-shadowing
  const NUDGE_EPSILON = 1.0; // 1 unit in Q2

  for (const point of points) {
    // Nudge point along normal
    const nudgedPoint = {
      x: point.x + normal.x * NUDGE_EPSILON,
      y: point.y + normal.y * NUDGE_EPSILON,
      z: point.z + normal.z * NUDGE_EPSILON
    } as Vec3;

    samples.push(calculateDirectLight(nudgedPoint, normal, lights, tree, planes));
  }

  return samples;
}
