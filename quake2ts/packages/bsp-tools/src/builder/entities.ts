import { type Vec3, CONTENTS_TRIGGER } from '@quake2ts/shared';
import type { EntityDef, BrushDef } from './types.js';
import { box } from './primitives.js';

export function playerStart(origin: Vec3, angle?: number): EntityDef {
  return {
    classname: 'info_player_start',
    properties: {
      origin: `${origin.x} ${origin.y} ${origin.z}`,
      ...(angle !== undefined && { angle: String(angle) }),
    },
  };
}

export function light(origin: Vec3, intensity?: number, color?: Vec3): EntityDef {
  return {
    classname: 'light',
    properties: {
      origin: `${origin.x} ${origin.y} ${origin.z}`,
      light: String(intensity ?? 300),
      ...(color && { _color: `${color.x} ${color.y} ${color.z}` }),
    },
  };
}

export function trigger(origin: Vec3, size: Vec3, target: string): EntityDef {
  const b = box({
    origin,
    size,
    contents: CONTENTS_TRIGGER,
    texture: 'common/trigger'
  });

  return {
    classname: 'trigger_multiple',
    properties: {
      target
    },
    brushes: [b]
  };
}

export function funcDoor(brush: BrushDef, properties: Record<string, string>): EntityDef {
  return {
    classname: 'func_door',
    properties: {
      ...properties
    },
    brushes: [brush]
  };
}

export function funcButton(brush: BrushDef, target: string): EntityDef {
  return {
    classname: 'func_button',
    properties: {
      target
    },
    brushes: [brush]
  };
}
