import { type Vec3 } from '@quake2ts/shared';
import { type DLight } from './dlight.js';
import { type FrustumPlane } from './culling.js';

/**
 * Culls dynamic lights based on frustum visibility and optional distance/importance.
 *
 * @param lights The list of all active dynamic lights.
 * @param planes The view frustum planes.
 * @param cameraPosition The position of the camera (optional, used for sorting).
 * @param maxLights The maximum number of lights to return (default 32).
 * @returns A filtered and sorted list of visible lights.
 */
export function cullLights(
    lights: readonly DLight[],
    planes: readonly FrustumPlane[],
    cameraPosition?: { x: number, y: number, z: number },
    maxLights: number = 32
): DLight[] {
    const visibleLights: { light: DLight, distSq: number }[] = [];

    for (const light of lights) {
        // Frustum cull
        // A light is a sphere defined by origin and intensity (radius).
        // It is visible if it intersects or is inside the frustum.
        // Sphere-plane intersection: distance(plane, center) > -radius
        let visible = true;
        for (const plane of planes) {
            const dist = plane.normal.x * light.origin.x +
                         plane.normal.y * light.origin.y +
                         plane.normal.z * light.origin.z +
                         plane.distance;

            // If the sphere is completely behind any plane, it is culled.
            if (dist < -light.intensity) {
                visible = false;
                break;
            }
        }

        if (visible) {
            let distSq = 0;
            if (cameraPosition) {
                const dx = light.origin.x - cameraPosition.x;
                const dy = light.origin.y - cameraPosition.y;
                const dz = light.origin.z - cameraPosition.z;
                distSq = dx * dx + dy * dy + dz * dz;
            }
            visibleLights.push({ light, distSq });
        }
    }

    // Sort by distance (ascending) if camera position is provided
    if (cameraPosition) {
        visibleLights.sort((a, b) => a.distSq - b.distSq);
    }

    // Return up to maxLights
    const result: DLight[] = [];
    const count = Math.min(visibleLights.length, maxLights);
    for (let i = 0; i < count; i++) {
        result.push(visibleLights[i].light);
    }

    return result;
}
