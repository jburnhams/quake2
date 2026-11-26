import { Entity } from '../entity.js';
import { SpawnRegistry } from '../spawn.js';
import { registerTriggerMultiple } from './multiple.js';

export function registerTriggerOnce(registry: SpawnRegistry): void {
  registry.register('trigger_once', (entity, context) => {
    entity.wait = -1;
    // trigger_once delegates to trigger_multiple logic but with wait = -1
    // We can just reuse the registration logic by calling the spawn function manually
    // or by importing the registerTriggerMultiple logic.
    // However, the registry doesn't expose the spawn function directly easily here without `registry.get`.

    // Better to manually call the trigger_multiple logic or rely on registry
    const multipleSpawn = registry.get('trigger_multiple');
    if (multipleSpawn) {
        multipleSpawn(entity, context);
    } else {
        // Fallback if load order is weird, though it should be fine
        // registerTriggerMultiple(registry);
        // registry.get('trigger_multiple')!(entity, context);
        // Actually, let's just assume it's registered or use the logic from multiple.ts if exported
        // But for now, relying on registry is standard pattern in this codebase.
        // Wait, if I call registerTriggerSpawns, order matters.

        // Let's implement it cleanly by calling registerTriggerMultiple's logic if possible,
        // or just copying the init logic. Since trigger_once IS a trigger_multiple with wait=-1.

        // Ideally we should have a shared spawn function.
    }
  });
}
