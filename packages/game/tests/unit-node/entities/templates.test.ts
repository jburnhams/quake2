import { describe, it, expect } from 'vitest';
import { ENTITY_TEMPLATES, getEntityTemplate, validateEntityAgainstTemplate, PropertyType } from '../../../src/entities/templates';

describe('Entity Templates', () => {
  it('should retrieve existing templates', () => {
    const template = getEntityTemplate('info_player_start');
    expect(template).toBeDefined();
    expect(template?.classname).toBe('info_player_start');
    expect(template?.requiredProperties).toContain('origin');
  });

  it('should return undefined for unknown templates', () => {
    const template = getEntityTemplate('unknown_entity');
    expect(template).toBeUndefined();
  });

  it('should validate entity against template', () => {
    // Valid entity
    const validEntity = {
      classname: 'info_player_start',
      origin: [0, 0, 0]
    };
    expect(validateEntityAgainstTemplate(validEntity)).toEqual([]);

    // Invalid entity (missing required property)
    const invalidEntity = {
      classname: 'info_player_start',
      angles: [0, 0, 0]
    };
    const errors = validateEntityAgainstTemplate(invalidEntity);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Missing required property: origin');
  });

  it('should pass validation for unknown entities', () => {
    const unknownEntity = {
      classname: 'unknown_entity',
      someProp: 123
    };
    expect(validateEntityAgainstTemplate(unknownEntity)).toEqual([]);
  });

  it('should have correct property types', () => {
    const template = getEntityTemplate('func_door');
    expect(template?.propertyTypes.speed).toBe(PropertyType.Number);
    expect(template?.propertyTypes.targetname).toBe(PropertyType.String);
  });
});
