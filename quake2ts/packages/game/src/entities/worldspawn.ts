import { Entity, MoveType, Solid } from './entity.js';
import { SpawnContext, SpawnRegistry } from './spawn.js';

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
    // TODO: Set configstring CS_SKY
    // console.log(`World sky: ${sky}`);
  }

  if (skyrotate) {
    // TODO: Set configstring CS_SKYROTATE
    // console.log(`World skyrotate: ${skyrotate}`);
  }

  if (skyaxis) {
     // TODO: Set configstring CS_SKYAXIS
     // console.log(`World skyaxis: ${skyaxis}`);
  }

  if (sounds) {
      const track = parseInt(sounds, 10);
      // TODO: Set CD track (usually via configstring CS_CDTRACK)
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
