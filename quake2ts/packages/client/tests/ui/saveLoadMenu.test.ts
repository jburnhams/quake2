import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaveLoadMenuFactory } from '../../src/ui/menu/saveLoad.js';
import { MenuSystem } from '../../src/ui/menu/system.js';
import { SaveStorage, SaveSlotMetadata } from '@quake2ts/game';

describe('SaveLoadMenuFactory', () => {
    let menuSystem: MenuSystem;
    let storage: SaveStorage;
    let onSave: ReturnType<typeof vi.fn>;
    let onLoad: ReturnType<typeof vi.fn>;
    let factory: SaveLoadMenuFactory;

    const mockSaves: SaveSlotMetadata[] = [
        {
            id: 'save1',
            name: 'My Save',
            map: 'base1',
            difficulty: 1,
            playtimeSeconds: 3661, // 1h 1m 1s
            timestamp: 1000,
            version: 1,
            bytes: 100
        },
        {
             id: 'save2',
             name: 'Another Save',
             map: 'base2',
             difficulty: 2,
             playtimeSeconds: 65,
             timestamp: 2000,
             version: 1,
             bytes: 200
        }
    ];

    beforeEach(() => {
        menuSystem = new MenuSystem();
        storage = {
            list: vi.fn().mockResolvedValue(mockSaves)
        } as unknown as SaveStorage;
        onSave = vi.fn().mockResolvedValue(undefined);
        onLoad = vi.fn().mockResolvedValue(undefined);
        factory = new SaveLoadMenuFactory(menuSystem, storage, onSave, onLoad);
    });

    describe('createSaveMenu', () => {
        it('should create a save menu with new save option and existing saves', async () => {
            const menu = await factory.createSaveMenu();

            expect(menu.title).toBe('Save Game');
            // New save, 2 existing saves, Back = 4 items
            expect(menu.items.length).toBe(4);
            expect(menu.items[0].label).toBe('New Save...');
            expect(menu.items[3].label).toBe('Back');

            // Check formatted time
            expect(menu.items[1].label).toContain('1:01:01');
        });

        it('should open input menu for new save', async () => {
            const menu = await factory.createSaveMenu();
            const spy = vi.spyOn(menuSystem, 'pushMenu');

            // Trigger "New Save..."
            menu.items[0].action!();

            expect(spy).toHaveBeenCalled();
            const inputMenu = spy.mock.calls[0][0];
            expect(inputMenu.title).toBe('Enter Save Name');

            // Verify input item
            const inputItem = inputMenu.items[0];
            expect(inputItem.type).toBe('input');
            expect(inputItem.getValue!()).toContain('Save');

            // Verify save action
            const saveItem = inputMenu.items[1];
            expect(saveItem.label).toBe('Save');
            await saveItem.action!();
            expect(onSave).toHaveBeenCalled();
        });

        it('should open confirm overwrite menu for existing save', async () => {
            const menu = await factory.createSaveMenu();
            const spy = vi.spyOn(menuSystem, 'pushMenu');

            // Trigger existing save overwrite
            menu.items[1].action!();

            expect(spy).toHaveBeenCalled();
            const confirmMenu = spy.mock.calls[0][0];
            expect(confirmMenu.title).toBe('Overwrite My Save?');

            // Confirm
            await confirmMenu.items[0].action!();
            expect(onSave).toHaveBeenCalledWith('My Save');
        });
    });

    describe('createLoadMenu', () => {
        it('should create a load menu with existing saves', async () => {
             const menu = await factory.createLoadMenu();

             expect(menu.title).toBe('Load Game');
             expect(menu.items.length).toBe(3); // 2 saves + back

             // Trigger load
             await menu.items[0].action!();
             expect(onLoad).toHaveBeenCalledWith('save1');
        });

        it('should handle empty saves list', async () => {
            (storage.list as any).mockResolvedValue([]);
            const menu = await factory.createLoadMenu();

            expect(menu.items.length).toBe(2); // "No saves found" + Back
            expect(menu.items[0].label).toBe('No saves found');
        });
    });
});
