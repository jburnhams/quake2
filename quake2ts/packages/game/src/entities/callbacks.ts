import type { DieCallback, PainCallback, ThinkCallback, TouchCallback, UseCallback } from './entity.js';

export type AnyCallback = ThinkCallback | TouchCallback | UseCallback | PainCallback | DieCallback;

export type CallbackRegistry = Map<string, AnyCallback>;

export function createCallbackRegistry(): CallbackRegistry {
  return new Map<string, AnyCallback>();
}

export function registerCallback(registry: CallbackRegistry, name: string, fn: AnyCallback): void {
  if (registry.has(name)) {
    return;
  }
  registry.set(name, fn);
}
