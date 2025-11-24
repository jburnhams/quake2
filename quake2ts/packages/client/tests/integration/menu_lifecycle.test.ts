import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MainMenuFactory, MainMenuOptions } from '../../src/ui/menu/main.js';
import { SaveLoadMenuFactory } from '../../src/ui/menu/saveLoad.js';
import { MenuSystem } from '../../src/ui/menu/system.js';
import { SaveStorage, SaveSlotMetadata } from '@quake2ts/game';

describe('Menu Lifecycle Integration', () => {
  let menuSystem: MenuSystem;
  let storage: SaveStorage;
  let onSave: any;
  let onLoad: any;
  let onDelete: any;
  let onNewGame: any;
  let onQuit: any;
  let saveLoadFactory: SaveLoadMenuFactory;
  let mainMenuFactory: MainMenuFactory;
  let storageData: SaveSlotMetadata[] = [];

  beforeEach(() => {
    // Reset storage data
    storageData = [
      { id: 'save1', name: 'Level 1 Start', map: 'base1', playtimeSeconds: 100, timestamp: 1000 },
      { id: 'save2', name: 'Boss Fight', map: 'boss1', playtimeSeconds: 500, timestamp: 2000 },
    ];

    menuSystem = new MenuSystem();

    // Mock storage
    storage = {
      list: vi.fn().mockImplementation(async () => [...storageData]),
      save: vi.fn(),
      load: vi.fn(),
      delete: vi.fn().mockImplementation(async (id) => {
        storageData = storageData.filter(s => s.id !== id);
      }),
      has: vi.fn(),
    };

    onSave = vi.fn().mockResolvedValue(undefined);
    onLoad = vi.fn().mockResolvedValue(undefined);
    onDelete = vi.fn().mockImplementation(async (id) => {
        await storage.delete(id);
    });
    onNewGame = vi.fn();
    onQuit = vi.fn();

    saveLoadFactory = new SaveLoadMenuFactory(menuSystem, storage, onSave, onLoad, onDelete);

    // Create MainMenuFactory
    const options: MainMenuOptions = {
      onNewGame,
      onQuit,
      optionsFactory: { createOptionsMenu: vi.fn() } as any
    };

    mainMenuFactory = new MainMenuFactory(menuSystem, saveLoadFactory, options);
  });

  it('Full flow: Main Menu -> Load Game -> Select Save -> Load', async () => {
    // 1. Create Main Menu
    const mainMenu = mainMenuFactory.createMainMenu();
    menuSystem.pushMenu(mainMenu);

    expect(menuSystem.getState().activeMenu?.title).toBe('Main Menu');

    // 2. Select "Load Game"
    const loadItem = mainMenu.items.find(i => i.label === 'Load Game');
    expect(loadItem).toBeDefined();
    loadItem!.action!();

    // Wait for promise (createLoadMenu is async inside the action)
    await new Promise(resolve => setTimeout(resolve, 0));

    // 3. Verify Load Menu is active
    const loadMenu = menuSystem.getState().activeMenu!;
    expect(loadMenu.title).toBe('Load Game');
    expect(loadMenu.items.length).toBeGreaterThan(0);

    // 4. Find "Level 1 Start" save
    const saveItem = loadMenu.items.find(i => i.label.includes('Level 1 Start'));
    expect(saveItem).toBeDefined();

    // 5. Select the save
    saveItem!.action!();

    // 6. Verify Action Menu (Load/Delete)
    const actionMenu = menuSystem.getState().activeMenu!;
    expect(actionMenu.title).toContain('Slot: Level 1 Start');

    // 7. Select "Load Game" from action menu
    const confirmLoadItem = actionMenu.items.find(i => i.label === 'Load Game');
    expect(confirmLoadItem).toBeDefined();

    confirmLoadItem!.action!();

    // Wait for promise resolution
    await new Promise(resolve => setTimeout(resolve, 0));

    // 8. Verify Load Callback was triggered with correct ID
    expect(onLoad).toHaveBeenCalledWith('save1');

    // 9. Verify menu closed (closeAll called)
    expect(menuSystem.getState().activeMenu).toBeNull();
  });

  it('Full flow: Main Menu -> Load Game -> Select Save -> Delete', async () => {
    // 1. Open Main Menu
    const mainMenu = mainMenuFactory.createMainMenu();
    menuSystem.pushMenu(mainMenu);

    // 2. Open Load Game
    mainMenu.items.find(i => i.label === 'Load Game')!.action!();
    await new Promise(resolve => setTimeout(resolve, 0));

    // 3. Select Save 2
    const loadMenu = menuSystem.getState().activeMenu!;
    const saveItem = loadMenu.items.find(i => i.label.includes('Boss Fight'));
    expect(saveItem).toBeDefined();
    saveItem!.action!();

    // 4. Select Delete
    const actionMenu = menuSystem.getState().activeMenu!;
    const deleteItem = actionMenu.items.find(i => i.label === 'Delete Save');
    deleteItem!.action!();

    // 5. Verify Confirm Menu
    const confirmMenu = menuSystem.getState().activeMenu!;
    expect(confirmMenu.title).toContain('Delete Boss Fight?');

    // 6. Confirm Delete
    const yesItem = confirmMenu.items.find(i => i.label === 'Yes, Delete');
    yesItem!.action!();

    // Wait for promise resolution
    await new Promise(resolve => setTimeout(resolve, 0));

    // 7. Verify Delete callback
    expect(onDelete).toHaveBeenCalledWith('save2');
    expect(storage.delete).toHaveBeenCalledWith('save2');

    // 8. Verify save is gone from storage mock data
    expect(storageData.find(s => s.id === 'save2')).toBeUndefined();
  });
});
