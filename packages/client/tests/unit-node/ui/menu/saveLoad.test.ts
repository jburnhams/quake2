import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaveLoadMenuFactory } from '@quake2ts/client/ui/menu/saveLoad.js';
import { MenuSystem } from '@quake2ts/client/ui/menu/system.js';
import { SaveStorage } from '@quake2ts/game';

describe('SaveLoadMenuFactory', () => {
  let menuSystem: MenuSystem;
  let storage: SaveStorage;
  let onSave: any;
  let onLoad: any;
  let onDelete: any;
  let factory: SaveLoadMenuFactory;

  beforeEach(() => {
    menuSystem = new MenuSystem();
    storage = {
        list: vi.fn().mockResolvedValue([
            { id: '1', name: 'Save 1', map: 'map1', playtimeSeconds: 60, timestamp: 100 },
            { id: '2', name: 'Save 2', map: 'map2', playtimeSeconds: 120, timestamp: 200 }
        ])
    } as any;
    onSave = vi.fn().mockResolvedValue(undefined);
    onLoad = vi.fn().mockResolvedValue(undefined);
    onDelete = vi.fn().mockResolvedValue(undefined);
    factory = new SaveLoadMenuFactory(menuSystem, storage, onSave, onLoad, onDelete);
  });

  describe('createLoadMenu', () => {
      it('lists saves', async () => {
        const menu = await factory.createLoadMenu();
        expect(menu.title).toBe('Load Game');
        // 2 saves + Back button = 3 items
        expect(menu.items.length).toBe(3);
        expect(menu.items[0].label).toContain('Save 1');
      });

      it('selecting a save opens action submenu', async () => {
        const menu = await factory.createLoadMenu();
        menuSystem.pushMenu(menu);

        // Select first save
        menu.items[0].action!();

        // Should have pushed a new menu
        const active = menuSystem.getState().activeMenu;
        expect(active).not.toBe(menu);
        expect(active?.title).toContain('Slot: Save 1');
        expect(active?.items.length).toBe(3); // Load, Delete, Back
      });

      it('Delete action in submenu opens confirmation', async () => {
        const menu = await factory.createLoadMenu();
        menuSystem.pushMenu(menu);
        menu.items[0].action!(); // Open sub menu

        const submenu = menuSystem.getState().activeMenu!;
        const deleteItem = submenu.items.find(i => i.label === 'Delete Save');
        expect(deleteItem).toBeDefined();

        deleteItem!.action!(); // Click Delete

        const confirmMenu = menuSystem.getState().activeMenu!;
        expect(confirmMenu.title).toContain('Delete Save 1?');
      });

      it('Confirm delete calls onDelete callback', async () => {
        const menu = await factory.createLoadMenu();
        menuSystem.pushMenu(menu);
        menu.items[0].action!(); // Open sub menu

        const submenu = menuSystem.getState().activeMenu!;
        const deleteItem = submenu.items.find(i => i.label === 'Delete Save')!;
        deleteItem.action!(); // Click Delete

        const confirmMenu = menuSystem.getState().activeMenu!;
        const yesItem = confirmMenu.items.find(i => i.label === 'Yes, Delete')!;

        await yesItem.action!();

        expect(onDelete).toHaveBeenCalledWith('1');
      });

      it('Load Game action calls onLoad', async () => {
          const menu = await factory.createLoadMenu();
          menuSystem.pushMenu(menu);
          menu.items[0].action!(); // Open sub menu

          const submenu = menuSystem.getState().activeMenu!;
          const loadItem = submenu.items.find(i => i.label === 'Load Game')!;

          await loadItem.action!();
          expect(onLoad).toHaveBeenCalledWith('1');
      });
  });

  describe('createSaveMenu', () => {
      it('should create a save menu with new save option and existing saves', async () => {
          const menu = await factory.createSaveMenu();

          expect(menu.title).toBe('Save Game');
          // New save, 2 existing saves, Back = 4 items
          expect(menu.items.length).toBe(4);
          expect(menu.items[0].label).toBe('New Save...');
          expect(menu.items[3].label).toBe('Back');
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
          expect(confirmMenu.title).toContain('Overwrite Save 1?');

          // Confirm
          await confirmMenu.items[0].action!();
          // Note: In the implementation, it re-uses the name.
          // Since our mock objects don't exactly match what the implementation might expect for name,
          // let's just check onSave is called.
          expect(onSave).toHaveBeenCalledWith('Save 1');
      });
  });
});
