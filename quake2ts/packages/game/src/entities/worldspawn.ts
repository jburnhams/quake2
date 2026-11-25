import { Entity, MoveType, Solid } from './entity.js';
import { SpawnContext, SpawnRegistry } from './spawn.js';
import { ConfigStringIndex, DEFAULT_LIGHT_STYLES } from '@quake2ts/shared';

export function SP_worldspawn(self: Entity, context: SpawnContext): void {
  self.classname = 'worldspawn';
  self.movetype = MoveType.Push;
  self.solid = Solid.Bsp;
  self.modelindex = self.modelindex || 1; // Default to first model (the map itself)

  // Parse world-specific keys that aren't on standard Entity
  const sky = context.keyValues['sky'];
  const skyrotate = context.keyValues['skyrotate'];
  const skyaxis = context.keyValues['skyaxis'];
  const sounds = context.keyValues['sounds'];

  if (sky) {
    context.entities.imports.configstring(ConfigStringIndex.Sky, sky);
  }

  if (skyrotate) {
    context.entities.imports.configstring(ConfigStringIndex.SkyRotate, skyrotate);
  }

  if (skyaxis) {
     context.entities.imports.configstring(ConfigStringIndex.SkyAxis, skyaxis);
  }

  if (sounds) {
      // Logic from g_spawn.c: sounds key maps to CD track
      // It sets "1" if 1, etc.
      // But sounds is int.
      context.entities.imports.configstring(ConfigStringIndex.CdTrack, sounds);
  }

  // "message" is already parsed by applyEntityKeyValues into self.message
  if (self.message) {
      // Logic to display message on client connect is usually handled by the client
      // reading the entity string or configstrings.
      // In Q2, it's printed in ClientBegin.
  }

  //
  // Setup light animation tables. 'a' is total darkness, 'z' is doublebright.
  // (g_spawn.cpp; styles 32-62 are assigned by the light program for switchable lights)
  //
  for (const [style, { pattern }] of DEFAULT_LIGHT_STYLES) {
    context.entities.imports.configstring(ConfigStringIndex.Lights + style, pattern);
  }
}

export function registerWorldSpawn(registry: SpawnRegistry): void {
  registry.register('worldspawn', SP_worldspawn);
}
