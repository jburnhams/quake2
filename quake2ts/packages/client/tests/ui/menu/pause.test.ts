import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PauseMenuFactory, PauseMenuOptions } from '../../../src/ui/menu/pause.js';
import { MenuSystem } from '../../../src/ui/menu/system.js';
import { OptionsMenuFactory } from '../../../src/ui/menu/options.js';
import { SaveLoadMenuFactory } from '../../../src/ui/menu/saveLoad.js';

describe('PauseMenuFactory', () => {
  let menuSystem: MenuSystem;
  let optionsFactory: OptionsMenuFactory;
  let saveLoadFactory: SaveLoadMenuFactory;
  let options: PauseMenuOptions;
  let factory: PauseMenuFactory;

  beforeEach(() => {
    menuSystem = new MenuSystem();
    optionsFactory = { createOptionsMenu: vi.fn() } as any;
    saveLoadFactory = { createSaveMenu: vi.fn().mockResolvedValue({}), createLoadMenu: vi.fn().mockResolvedValue({}) } as any;

    options = {
      onResume: vi.fn(),
      onRestart: vi.fn(),
      onQuit: vi.fn(),
      optionsFactory,
      saveLoadFactory
    };

    factory = new PauseMenuFactory(menuSystem, options);
  });

  it('creates a menu with expected items', () => {
    const menu = factory.createPauseMenu();
    expect(menu.title).toBe('Game Paused');

    const labels = menu.items.map(i => i.label);
    expect(labels).toContain('Resume Game');
    expect(labels).toContain('Save Game');
    expect(labels).toContain('Load Game');
    expect(labels).toContain('Options');
    expect(labels).toContain('Restart Level');
    expect(labels).toContain('Quit to Main Menu');
  });

  it('Resume action calls onResume', () => {
    const menu = factory.createPauseMenu();
    const item = menu.items.find(i => i.label === 'Resume Game');
    item?.action?.();
    expect(options.onResume).toHaveBeenCalled();
  });

  it('Restart action calls onRestart', () => {
    const menu = factory.createPauseMenu();
    const item = menu.items.find(i => i.label === 'Restart Level');
    item?.action?.();
    expect(options.onRestart).toHaveBeenCalled();
  });

  it('Quit action calls onQuit', () => {
    const menu = factory.createPauseMenu();
    const item = menu.items.find(i => i.label === 'Quit to Main Menu');
    item?.action?.();
    expect(options.onQuit).toHaveBeenCalled();
  });

  it('Options action pushes options menu', () => {
    const pushSpy = vi.spyOn(menuSystem, 'pushMenu');
    const mockOptionsMenu = { title: 'Options', items: [] };
    (optionsFactory.createOptionsMenu as any).mockReturnValue(mockOptionsMenu);

    const menu = factory.createPauseMenu();
    const item = menu.items.find(i => i.label === 'Options');
    item?.action?.();

    expect(optionsFactory.createOptionsMenu).toHaveBeenCalled();
    expect(pushSpy).toHaveBeenCalledWith(mockOptionsMenu);
  });

  it('Save/Load actions trigger factory creation', async () => {
    const menu = factory.createPauseMenu();

    const saveItem = menu.items.find(i => i.label === 'Save Game');
    saveItem?.action?.();
    expect(saveLoadFactory.createSaveMenu).toHaveBeenCalled();

    const loadItem = menu.items.find(i => i.label === 'Load Game');
    loadItem?.action?.();
    expect(saveLoadFactory.createLoadMenu).toHaveBeenCalled();
  });
});
