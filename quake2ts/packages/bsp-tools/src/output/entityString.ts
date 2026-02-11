import type { EntityDef } from '../builder/types.js';

export function serializeEntity(entity: EntityDef): string {
  let output = '{\n';
  output += `"classname" "${entity.classname}"\n`;
  for (const [key, value] of Object.entries(entity.properties)) {
    if (key === 'classname') continue; // Handled first
    output += `"${key}" "${value}"\n`;
  }
  output += '}\n';
  return output;
}

export function serializeEntities(entities: EntityDef[]): string {
  return entities.map(serializeEntity).join('');
}
