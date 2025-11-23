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
  let saveCallback: any;
  let loadCallback: any;
  let deleteCallback: any;
  let menuSystem: MenuSystem;
  let menuFactory: MainMenuFactory;

  beforeEach(() => {
    const mockEngine = {
      trace: vi.fn().mockReturnValue({ allsolid: false, startsolid: false, fraction: 1.0 }),
      renderer: {},
    } as any;

    const imports: ClientImports = {
      engine: mockEngine
    };

    client = createClient(imports);
    mockStorage = new MockSaveStorage();
    saveCallback = vi.fn().mockResolvedValue(undefined);
    loadCallback = vi.fn().mockResolvedValue(undefined);
    deleteCallback = vi.fn().mockResolvedValue(undefined);

    const result = client.createMainMenu(
        { onNewGame: vi.fn(), onQuit: vi.fn() },
        mockStorage,
        saveCallback,
        loadCallback,
        deleteCallback
    );
    menuSystem = result.menuSystem;
    menuFactory = result.factory;
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

    const mainMenu = menuFactory.createMainMenu();
    menuSystem.pushMenu(mainMenu);

    // Find "Load Game"
    const loadItem = mainMenu.items.find(i => i.label === 'Load Game');
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
    // The label format in SaveLoadMenuFactory is `${save.name} - ${save.map} (${formatTime(save.playtimeSeconds)})`
    // MockSaveStorage uses 'Save ' + timestamp as name
    const expectedLabel = 'Save 123456789 - base1 (0:01:00)';
    const saveItem = activeMenu?.items.find(i => i.label === expectedLabel);
    expect(saveItem).toBeDefined();
  });

  it('triggers load callback when a save is selected', async () => {
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

    const mainMenu = menuFactory.createMainMenu();
    menuSystem.pushMenu(mainMenu);
    mainMenu.items.find(i => i.label === 'Load Game')!.action!();
    await new Promise(process.nextTick);

    const loadMenu = menuSystem.getState().activeMenu!;
    const saveItem = loadMenu.items.find(i => i.label.includes('base1'))!;

    // Click save item -> Should open action menu (Load / Delete)
    saveItem.action!();

    const actionMenu = menuSystem.getState().activeMenu!;
    expect(actionMenu.title).toContain('Slot:');

    // Find "Load Game" in action menu
    const doLoadItem = actionMenu.items.find(i => i.label === 'Load Game')!;
    doLoadItem.action!();

    await new Promise(process.nextTick);

    // Verify load callback called with correct ID
    const expectedId = 'base1_' + timestamp;
    expect(loadCallback).toHaveBeenCalledWith(expectedId);
  });

  it('creates new save via Save Menu', async () => {
    const mainMenu = menuFactory.createMainMenu();
    menuSystem.pushMenu(mainMenu);

    // Find "Save Game"
    const saveItem = mainMenu.items.find(i => i.label === 'Save Game')!;
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
    // In a real UI, onUpdate is called by the input field. We simulate it here.
    if (inputItem.onUpdate) inputItem.onUpdate('MySave');

    // Click "Save"
    const confirmSaveItem = inputMenu.items.find(i => i.label === 'Save')!;
    confirmSaveItem.action!();
    await new Promise(process.nextTick);

    expect(saveCallback).toHaveBeenCalledWith('MySave');
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

    const mainMenu = menuFactory.createMainMenu();
    menuSystem.pushMenu(mainMenu);
    mainMenu.items.find(i => i.label === 'Load Game')!.action!();
    await new Promise(process.nextTick);

    const loadMenu = menuSystem.getState().activeMenu!;
    const saveItem = loadMenu.items.find(i => i.label.includes('base1'))!;
    saveItem.action!(); // Open action menu

    const actionMenu = menuSystem.getState().activeMenu!;
    const deleteItem = actionMenu.items.find(i => i.label === 'Delete Save')!;
    deleteItem.action!(); // Open confirm menu

    const confirmMenu = menuSystem.getState().activeMenu!;
    expect(confirmMenu.title).toContain('Delete');

    const yesItem = confirmMenu.items.find(i => i.label === 'Yes, Delete')!;
    yesItem.action!();
    await new Promise(process.nextTick);

    const expectedId = 'base1_' + timestamp;
    expect(deleteCallback).toHaveBeenCalledWith(expectedId);
  });
});
