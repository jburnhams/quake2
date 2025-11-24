import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientImports, ClientExports } from '../../src/index.js';
import { SaveStorage, SaveSlotMetadata, GameSaveFile } from '@quake2ts/game';
import { MenuSystem } from '../../src/ui/menu/system.js';
import { MainMenuFactory } from '../../src/ui/menu/main.js';

// Mock SaveStorage
class MockSaveStorage implements SaveStorage {
  private saves: Map<string, GameSaveFile> = new Map();

  async list(): Promise<SaveSlotMetadata[]> {
    return Array.from(this.saves.values()).map(save => ({
      id: save.map + '_' + save.timestamp, // Simplified ID generation
      name: 'Save ' + save.timestamp,
      map: save.map,
      timestamp: save.timestamp,
      playtimeSeconds: save.playtimeSeconds,
      difficulty: save.difficulty,
      checksum: save.checksum ?? 0
    }));
  }

  async save(name: string, data: GameSaveFile): Promise<void> {
    this.saves.set(name, data);
  }

  async load(id: string): Promise<GameSaveFile | null> {
    // In this mock, we don't have a direct ID mapping from list() back to the map key easily unless we enforce ID = Name for simplicity in test
    // For test simplicity, let's assume we search by ID (which we mocked as map_timestamp)
    for (const [key, save] of this.saves.entries()) {
        if ((save.map + '_' + save.timestamp) === id) return save;
    }
    return null;
  }

  async delete(id: string): Promise<void> {
     for (const [key, save] of this.saves.entries()) {
        if ((save.map + '_' + save.timestamp) === id) {
            this.saves.delete(key);
            return;
        }
    }
  }

  // Helper for test setup
  addMockSave(name: string, save: GameSaveFile) {
      this.saves.set(name, save);
  }
}

describe('Save/Load Menu Integration', () => {
  let client: ClientExports;
  let mockStorage: MockSaveStorage;
  let executeCommand: any;
  let menuSystem: MenuSystem;

  beforeEach(() => {
    const mockEngine = {
      trace: vi.fn().mockReturnValue({ allsolid: false, startsolid: false, fraction: 1.0 }),
      renderer: {},
    } as any;

    mockStorage = new MockSaveStorage();
    executeCommand = vi.fn();

    const imports: ClientImports = {
      engine: mockEngine,
      host: {
          commands: {
              register: vi.fn(),
              execute: executeCommand
          },
          cvars: {
              register: vi.fn(),
              get: vi.fn().mockReturnValue(undefined)
          }
      } as any,
      storage: mockStorage
    };

    client = createClient(imports);
    menuSystem = client.menuSystem;
  });

  it('navigates to Load Menu and lists saves', async () => {
    // Setup a save
    mockStorage.addMockSave('slot1', {
        version: 2,
        timestamp: 123456789,
        map: 'base1',
        difficulty: 1,
        playtimeSeconds: 60,
        gameState: {},
        level: { frameNumber: 0, timeSeconds: 0, previousTimeSeconds: 0, deltaSeconds: 0 },
        rng: { mt: { index: 0, state: [] } },
        entities: { timeSeconds: 0, pool: { capacity: 0, activeOrder: [], freeList: [], pendingFree: [] }, entities: [], thinks: [] },
        cvars: [],
        configstrings: []
    });

    // Load menu is currently only accessible via Pause Menu in my implementation
    // So let's toggle menu (which opens pause menu because we have a host)
    client.toggleMenu();

    const pauseMenu = menuSystem.getState().activeMenu!;
    expect(pauseMenu.title).toBe('Game Paused');

    // Find "Load Game"
    const loadItem = pauseMenu.items.find(i => i.label === 'Load Game');
    expect(loadItem).toBeDefined();

    // Trigger Load Game
    if (loadItem && loadItem.action) {
        loadItem.action();
    }

    // Wait for async storage list
    await new Promise(process.nextTick);

    // Verify active menu is Load Game
    const activeMenu = menuSystem.getState().activeMenu;
    expect(activeMenu?.title).toBe('Load Game');

    // Verify save is listed
    const expectedLabel = 'Save 123456789 - base1 (0:01:00)';
    const saveItem = activeMenu?.items.find(i => i.label === expectedLabel);
    expect(saveItem).toBeDefined();
  });

  it('triggers load command when a save is selected', async () => {
     // Setup a save
    const timestamp = 123456789;
    mockStorage.addMockSave('slot1', {
        version: 2,
        timestamp: timestamp,
        map: 'base1',
        difficulty: 1,
        playtimeSeconds: 60,
        gameState: {},
        level: { frameNumber: 0, timeSeconds: 0, previousTimeSeconds: 0, deltaSeconds: 0 },
        rng: { mt: { index: 0, state: [] } },
        entities: { timeSeconds: 0, pool: { capacity: 0, activeOrder: [], freeList: [], pendingFree: [] }, entities: [], thinks: [] },
        cvars: [],
        configstrings: []
    });

    client.toggleMenu(); // Open Pause Menu
    const pauseMenu = menuSystem.getState().activeMenu!;
    pauseMenu.items.find(i => i.label === 'Load Game')!.action!();
    await new Promise(process.nextTick);

    const loadMenu = menuSystem.getState().activeMenu!;
    const saveItem = loadMenu.items.find(i => i.label.includes('base1'))!;

    // Click save item -> Should open action menu (Load / Delete)
    saveItem.action!();

    const actionMenu = menuSystem.getState().activeMenu!;
    const doLoadItem = actionMenu.items.find(i => i.label === 'Load Game')!;
    doLoadItem.action!();

    await new Promise(process.nextTick);

    // Verify load command executed
    const expectedId = 'base1_' + timestamp;
    expect(executeCommand).toHaveBeenCalledWith(`load "${expectedId}"`);
  });

  it('creates new save via Save Menu', async () => {
    client.toggleMenu(); // Open Pause Menu
    const pauseMenu = menuSystem.getState().activeMenu!;

    // Find "Save Game"
    const saveItem = pauseMenu.items.find(i => i.label === 'Save Game')!;
    saveItem.action!();
    await new Promise(process.nextTick);

    const saveMenu = menuSystem.getState().activeMenu!;
    expect(saveMenu.title).toBe('Save Game');

    // Find "New Save..."
    const newSaveItem = saveMenu.items.find(i => i.label === 'New Save...')!;
    newSaveItem.action!();

    const inputMenu = menuSystem.getState().activeMenu!;
    expect(inputMenu.title).toBe('Enter Save Name');

    // Simulate entering name "MySave"
    const inputItem = inputMenu.items.find(i => i.label === 'Name')!;
    if (inputItem.onUpdate) inputItem.onUpdate('MySave');

    // Click "Save"
    const confirmSaveItem = inputMenu.items.find(i => i.label === 'Save')!;
    confirmSaveItem.action!();
    await new Promise(process.nextTick);

    expect(executeCommand).toHaveBeenCalledWith('save "MySave"');
  });

  it('deletes a save via Load Menu', async () => {
     // Setup a save
    const timestamp = 987654321;
    mockStorage.addMockSave('slotToDelete', {
        version: 2,
        timestamp: timestamp,
        map: 'base1',
        difficulty: 1,
        playtimeSeconds: 60,
        gameState: {},
        level: { frameNumber: 0, timeSeconds: 0, previousTimeSeconds: 0, deltaSeconds: 0 },
        rng: { mt: { index: 0, state: [] } },
        entities: { timeSeconds: 0, pool: { capacity: 0, activeOrder: [], freeList: [], pendingFree: [] }, entities: [], thinks: [] },
        cvars: [],
        configstrings: []
    });

    client.toggleMenu(); // Open Pause Menu
    const pauseMenu = menuSystem.getState().activeMenu!;
    pauseMenu.items.find(i => i.label === 'Load Game')!.action!();
    await new Promise(process.nextTick);

    const loadMenu = menuSystem.getState().activeMenu!;
    const saveItem = loadMenu.items.find(i => i.label.includes('base1'))!;
    saveItem.action!(); // Open action menu

    const actionMenu = menuSystem.getState().activeMenu!;
    const deleteItem = actionMenu.items.find(i => i.label === 'Delete Save')!;
    deleteItem.action!(); // Open confirm menu

    const confirmMenu = menuSystem.getState().activeMenu!;
    const yesItem = confirmMenu.items.find(i => i.label === 'Yes, Delete')!;

    // We can't easily spy on mockStorage.delete directly unless we spy the instance method
    const deleteSpy = vi.spyOn(mockStorage, 'delete');

    yesItem.action!();
    await new Promise(process.nextTick);

    const expectedId = 'base1_' + timestamp;
    expect(deleteSpy).toHaveBeenCalledWith(expectedId);
  });
});
