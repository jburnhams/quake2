import { Vec3 } from '@quake2ts/shared';

export interface DLight {
  /** The unique ID of the entity that owns this light (optional). */
  readonly key?: number;

  /** World position of the light. */
  readonly origin: Vec3;

  /** RGB color of the light (0-1 range). */
  readonly color: Vec3;

  /** Intensity/Radius of the light. */
  intensity: number;

  /** Minimum lighting value to add (usually 0). */
  readonly minLight?: number;

  /** Time when the light should be removed (seconds). */
  die: number;

  /** Rate of change for intensity (units per second). Default 0. */
  readonly radiusSpeed?: number;
}

export const MAX_DLIGHTS = 32;

/**
 * Manages a pool of dynamic lights.
 */
export class DynamicLightManager {
  private lights: DLight[] = [];

  /**
   * Adds a dynamic light or updates an existing one with the same key.
   */
  addLight(dlight: DLight, time: number): void {
    if (dlight.key !== undefined) {
      // Update existing light with same key
      const index = this.lights.findIndex(l => l.key === dlight.key);
      if (index !== -1) {
        this.lights[index] = dlight;
        return;
      }
    }

    // Add new light
    this.lights.push(dlight);
  }

  /**
   * Clears all lights (e.g., map change).
   */
  clear(): void {
    this.lights = [];
  }

  /**
   * Updates the list of active lights, removing expired ones and animating properties.
   * @param time Current game time in seconds.
   * @param dt Delta time in seconds.
   */
  update(time: number, dt: number = 0): void {
    // Filter dead lights
    this.lights = this.lights.filter(l => l.die > time);

    // Animate lights
    if (dt > 0) {
        for (const light of this.lights) {
            if (light.radiusSpeed !== undefined && light.radiusSpeed !== 0) {
                light.intensity += light.radiusSpeed * dt;
                if (light.intensity < 0) light.intensity = 0;
            }
        }
    }
  }

  /**
   * Returns the current list of active lights.
   */
  getActiveLights(): readonly DLight[] {
    return this.lights;
  }
}
