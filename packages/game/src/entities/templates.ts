import { Entity } from './entity.js';

/**
 * Defines the type of a property in an entity template.
 */
export enum PropertyType {
  String = 'string',
  Number = 'number',
  Vec3 = 'vec3',
  Angle = 'angle',
  Boolean = 'boolean',
  Choice = 'choice',
  Reference = 'reference' // Targetname reference
}

/**
 * Defines a template for an entity type, including default values and property schemas.
 */
export interface EntityTemplate {
  classname: string;
  defaultProperties: Record<string, any>;
  requiredProperties: string[];
  propertyTypes: Record<string, PropertyType>;
  description: string;
}

/**
 * Registry of entity templates.
 *
 * Default values are derived from original Quake 2 source files:
 * - g_spawn.c
 * - g_func.c
 * - g_misc.c
 * - m_soldier.c
 */
export const ENTITY_TEMPLATES: Record<string, EntityTemplate> = {
  // Source: g_misc.c -> SP_info_player_start
  'info_player_start': {
    classname: 'info_player_start',
    defaultProperties: {
      origin: [0, 0, 0],
      angles: [0, 0, 0]
    },
    requiredProperties: ['origin'],
    propertyTypes: {
      origin: PropertyType.Vec3,
      angles: PropertyType.Angle,
      target: PropertyType.Reference
    },
    description: 'Player spawn point for single player.'
  },
  // Source: g_func.c -> SP_func_door
  'func_door': {
    classname: 'func_door',
    defaultProperties: {
      speed: 100, // g_func.c line 400 (approx)
      wait: 3,
      lip: 8,
      dmg: 2
    },
    requiredProperties: [],
    propertyTypes: {
      speed: PropertyType.Number,
      wait: PropertyType.Number,
      lip: PropertyType.Number,
      dmg: PropertyType.Number,
      targetname: PropertyType.String,
      team: PropertyType.String,
      spawnflags: PropertyType.Number
    },
    description: 'A moving door.'
  },
  // Source: g_spawn.c -> SP_light
  'light': {
    classname: 'light',
    defaultProperties: {
      light: 300,
      style: 0
    },
    requiredProperties: ['origin'],
    propertyTypes: {
      origin: PropertyType.Vec3,
      light: PropertyType.Number,
      style: PropertyType.Number,
      target: PropertyType.Reference,
      _color: PropertyType.Vec3
    },
    description: 'An invisible light source.'
  },
  // Source: m_soldier.c -> SP_monster_soldier
  'monster_soldier': {
    classname: 'monster_soldier',
    defaultProperties: {
      health: 20 // m_soldier.c
    },
    requiredProperties: ['origin'],
    propertyTypes: {
      origin: PropertyType.Vec3,
      angles: PropertyType.Angle,
      spawnflags: PropertyType.Number
    },
    description: 'A regular soldier enemy.'
  }
};

/**
 * Retrieves the template for a given entity classname.
 */
export function getEntityTemplate(classname: string): EntityTemplate | undefined {
  return ENTITY_TEMPLATES[classname];
}

/**
 * Validates an entity against its template.
 * Returns a list of error messages, or empty array if valid.
 */
export function validateEntityAgainstTemplate(entity: Partial<Entity> & { classname: string }): string[] {
  const template = ENTITY_TEMPLATES[entity.classname];
  if (!template) {
    return []; // No template, so valid by default (or unknown)
  }

  const errors: string[] = [];

  // Check required properties
  for (const prop of template.requiredProperties) {
    if ((entity as any)[prop] === undefined) {
      errors.push(`Missing required property: ${prop}`);
    }
  }

  // Type checking could go here, but JS types vs template types might differ (e.g. Vec3 as array or object)

  return errors;
}
