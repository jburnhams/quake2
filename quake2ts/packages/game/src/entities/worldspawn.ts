import { Entity, MoveType, Solid } from './entity.js';
import { SpawnContext, SpawnRegistry } from './spawn.js';
import { ConfigStringIndex } from '@quake2ts/shared';

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
}

export function registerWorldSpawn(registry: SpawnRegistry): void {
  registry.register('worldspawn', SP_worldspawn);
}
