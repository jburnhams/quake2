import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoMenuFactory } from '../../../src/ui/menu/demo.js';
import { MenuSystem } from '../../../src/ui/menu/system.js';
import { ClientExports } from '../../../src/index.js';

describe('DemoMenuFactory', () => {
  let menuSystem: MenuSystem;
  let client: ClientExports;
  let factory: DemoMenuFactory;

  beforeEach(() => {
    menuSystem = new MenuSystem();
    client = {
      startDemoPlayback: vi.fn(),
      errorDialog: {
        show: vi.fn(),
        render: vi.fn()
      }
    } as unknown as ClientExports;

    factory = new DemoMenuFactory(menuSystem, client);
  });

  it('should create a demo menu structure', () => {
    const menu = factory.createDemoMenu();
    expect(menu.title).toBe('Demos');
    expect(menu.items.length).toBeGreaterThan(0);

    // Check for "Load Demo File..."
    const loadItem = menu.items.find(i => i.label === 'Load Demo File...');
    expect(loadItem).toBeDefined();

    // Check for "Back"
    const backItem = menu.items.find(i => i.label === 'Back');
    expect(backItem).toBeDefined();
  });

  it('should handle Load Demo File action via callback if provided', async () => {
      const onLoadDemoFile = vi.fn().mockResolvedValue(undefined);
      factory = new DemoMenuFactory(menuSystem, client, { onLoadDemoFile });

      const menu = factory.createDemoMenu();
      const loadItem = menu.items.find(i => i.label === 'Load Demo File...');

      await loadItem?.action();

      expect(onLoadDemoFile).toHaveBeenCalled();
  });

  it('should pop menu on Back action', () => {
      const spy = vi.spyOn(menuSystem, 'popMenu');
      const menu = factory.createDemoMenu();
      const backItem = menu.items.find(i => i.label === 'Back');

      backItem?.action();
      expect(spy).toHaveBeenCalled();
  });
});
