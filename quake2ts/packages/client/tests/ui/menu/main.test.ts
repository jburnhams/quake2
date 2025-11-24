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
<<<<<<< HEAD
<<<<<<< HEAD
        onQuit: vi.fn()
=======
=======
>>>>>>> origin/main
        onQuit: vi.fn(),
        optionsFactory: { createOptionsMenu: vi.fn() },
        mapsFactory: { createMapsMenu: vi.fn().mockReturnValue({ title: 'Select Map', items: [] }) },
        onSetDifficulty: vi.fn()
<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main
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

<<<<<<< HEAD
<<<<<<< HEAD
  it('New Game calls callback', () => {
    const menu = factory.createMainMenu();
    const item = menu.items.find(i => i.label === 'New Game')!;
    item.action!();
    expect(options.onNewGame).toHaveBeenCalled();
  });

=======
=======
>>>>>>> origin/main
  it('New Game opens difficulty menu', () => {
    const menu = factory.createMainMenu();
    const item = menu.items.find(i => i.label === 'New Game')!;
    item.action!();

    // Should push difficulty menu
    expect(menuSystem.getState().activeMenu?.title).toBe('Select Difficulty');

    // Navigate difficulty menu
    const difficultyMenu = menuSystem.getState().activeMenu!;
    const easyItem = difficultyMenu.items.find(i => i.label === 'Easy')!;

    easyItem.action!();
    expect(options.onSetDifficulty).toHaveBeenCalledWith(0);
    expect(options.onNewGame).toHaveBeenCalled();
  });

  it('New Game difficulty menu has map select', () => {
      const menu = factory.createMainMenu();
      const item = menu.items.find(i => i.label === 'New Game')!;
      item.action!();

      const difficultyMenu = menuSystem.getState().activeMenu!;
      const mapItem = difficultyMenu.items.find(i => i.label === 'Map Select...')!;

      mapItem.action!();
      expect(options.mapsFactory.createMapsMenu).toHaveBeenCalled();
      // Should also verify that map menu was pushed
      expect(menuSystem.getState().activeMenu?.title).toBe('Select Map');
  });

<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main
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
