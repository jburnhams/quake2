import { Vec3 } from '@quake2ts/shared';

// We need a common EntityDef to represent parsed map entities
// This matches what mapParser produces
export interface EntityDef {
  classname: string;
  properties: Map<string, string>;
  brushes: any[]; // we don't care about brushes for lights
  line: number;
}

export interface Light {
  type: 'point' | 'spot' | 'surface' | 'sun';
  origin: Vec3;
  intensity: number;
  color: Vec3;  // RGB, 0-1

  // Spot light
  direction?: Vec3;
  innerCone?: number;  // degrees
  outerCone?: number;  // degrees

  // Attenuation
  falloff?: 'linear' | 'inverse' | 'inverse_square';

  // Surface light
  surface?: string;  // Texture name for surface emission

  style?: number; // Optional light style (animation)
}

function parseVec3(str: string | undefined): Vec3 | undefined {
  if (!str) return undefined;
  const parts = str.split(/\s+/).map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    return { x: parts[0], y: parts[1], z: parts[2], 0: parts[0], 1: parts[1], 2: parts[2] } as Vec3;
  }
  return undefined;
}

/**
 * Extract lights from entity definitions
 *
 * Based on q2tools/src/rad.c MakeLights
 */
export function parseLights(entities: EntityDef[]): Light[] {
  const lights: Light[] = [];

  for (const entity of entities) {
    if (entity.classname === 'worldspawn') {
      // Check for sun
      const sunTarget = entity.properties.get('_sun');
      if (sunTarget) {
        // Find the target entity to determine direction, but for now we'll just check
        // if there's a sun_color or sun_light
        const colorStr = entity.properties.get('_sun_color');
        let color: Vec3 = { x: 1, y: 1, z: 1, 0: 1, 1: 1, 2: 1 } as Vec3;
        if (colorStr) {
          const parsedColor = parseVec3(colorStr);
          if (parsedColor) color = parsedColor;
        }

        const intensity = parseFloat(entity.properties.get('_sun_light') || '50');

        // We don't have direction yet, it would require resolving the target.
        // For MVP, we'll assign a default direction if sun_pos isn't present
        // q2tools doesn't really have a 'sun' per se natively but some compilers do.
        lights.push({
          type: 'sun',
          origin: { x: 0, y: 0, z: 0, 0: 0, 1: 0, 2: 0 } as Vec3, // Sun doesn't really have an origin
          intensity,
          color,
          direction: { x: 0, y: 0, z: -1, 0: 0, 1: 0, 2: -1 } as Vec3 // Default straight down
        });
      }
      continue;
    }

    if (entity.classname === 'light') {
      const originStr = entity.properties.get('origin');
      if (!originStr) continue;

      const origin = parseVec3(originStr);
      if (!origin) continue;

      // Color
      const colorStr = entity.properties.get('_color') || entity.properties.get('color');
      let color: Vec3 = { x: 1, y: 1, z: 1, 0: 1, 1: 1, 2: 1 } as Vec3; // Default white
      if (colorStr) {
        const parsedColor = parseVec3(colorStr);
        if (parsedColor) color = parsedColor;
      }

      // Intensity
      let intensity = parseFloat(entity.properties.get('light') || '300');
      if (isNaN(intensity)) intensity = 300;

      // Style
      let styleStr = entity.properties.get('_style') || entity.properties.get('style');
      let style = parseInt(styleStr || '0', 10);
      if (isNaN(style) || style < 0 || style >= 256) style = 0;

      // Type
      let type: 'point' | 'spot' | 'surface' = 'point';
      const target = entity.properties.get('target');

      let innerCone: number | undefined;
      let outerCone: number | undefined;

      if (target) {
        type = 'spot';
        // Quake 2 doesn't have a direct spotlight direction in the light entity usually,
        // it requires tracing to the target entity.
        // For standard parsing without resolving targets, we mark it as spot
        // but can't calculate direction until we have all entities.
        // For now, _cone provides the cone.
        const coneStr = entity.properties.get('_cone');
        outerCone = parseFloat(coneStr || '10');
        if (isNaN(outerCone)) outerCone = 10;
        innerCone = outerCone - 10; // Q2 tools style inner cone heuristic
        if (innerCone < 0) innerCone = 0;
      }

      const surface = entity.properties.get('_surface');
      if (surface) {
        type = 'surface';
      }

      const light: Light = {
        type,
        origin,
        intensity,
        color,
        style
      };

      if (type === 'spot') {
        light.outerCone = outerCone;
        light.innerCone = innerCone;
      }
      if (type === 'surface') {
        light.surface = surface;
      }

      lights.push(light);
    }
  }

  return lights;
}
