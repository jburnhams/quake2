import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MainMenuFactory } from '../../../src/ui/menu/main.js';
import { MenuSystem } from '../../../src/ui/menu/system.js';
import { SaveLoadMenuFactory } from '../../../src/ui/menu/saveLoad.js';

describe('MainMenuFactory', () => {
  let menuSystem: MenuSystem;
  let saveLoadFactory: SaveLoadMenuFactory;
  let options: any;
  let factory: MainMenuFactory;

  beforeEach(() => {
    menuSystem = new MenuSystem();
    saveLoadFactory = {
        createLoadMenu: vi.fn().mockResolvedValue({ title: 'Load Game', items: [] }),
        createSaveMenu: vi.fn().mockResolvedValue({ title: 'Save Game', items: [] })
    } as any;
    options = {
        onNewGame: vi.fn(),
        onQuit: vi.fn()
    };
    factory = new MainMenuFactory(menuSystem, saveLoadFactory, options);
  });

  it('createMainMenu has correct structure', () => {
    const menu = factory.createMainMenu();
    expect(menu.title).toBe('Main Menu');
    const labels = menu.items.map(i => i.label);
    expect(labels).toContain('New Game');
    expect(labels).toContain('Load Game');
    expect(labels).toContain('Save Game');
    expect(labels).toContain('Options');
    expect(labels).toContain('Quit');
  });

  it('New Game calls callback', () => {
    const menu = factory.createMainMenu();
    const item = menu.items.find(i => i.label === 'New Game')!;
    item.action!();
    expect(options.onNewGame).toHaveBeenCalled();
  });

  it('Quit calls callback', () => {
      const menu = factory.createMainMenu();
      const item = menu.items.find(i => i.label === 'Quit')!;
      item.action!();
      expect(options.onQuit).toHaveBeenCalled();
  });

  it('Load Game opens load menu', async () => {
      const menu = factory.createMainMenu();
      const item = menu.items.find(i => i.label === 'Load Game')!;
      item.action!();

      // Since action is void but calls async, we need to wait a tick
      await new Promise(process.nextTick);

      expect(saveLoadFactory.createLoadMenu).toHaveBeenCalled();
      expect(menuSystem.getState().activeMenu?.title).toBe('Load Game');
  });
});
