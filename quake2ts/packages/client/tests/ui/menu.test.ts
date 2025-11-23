import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MenuSystem } from '../../src/ui/menu/system.js';
import { Menu } from '../../src/ui/menu/types.js';
import { Draw_Menu } from '../../src/ui/menu/render.js';
import { Renderer } from '@quake2ts/engine';

describe('MenuSystem', () => {
  let menuSystem: MenuSystem;
  let testMenu: Menu;

  beforeEach(() => {
    menuSystem = new MenuSystem();
    testMenu = {
      title: 'Test Menu',
      items: [
        { label: 'Item 1', action: vi.fn() },
        { label: 'Item 2', action: vi.fn() },
      ],
    };
  });

  it('should start with no active menu', () => {
    expect(menuSystem.isActive()).toBe(false);
  });

  it('should activate a menu', () => {
    menuSystem.pushMenu(testMenu);
    expect(menuSystem.isActive()).toBe(true);
    const state = menuSystem.getState();
    expect(state.activeMenu).toBe(testMenu);
    expect(state.selectedIndex).toBe(0);
  });

  it('should navigate down', () => {
    menuSystem.pushMenu(testMenu);
    menuSystem.handleInput('down');
    expect(menuSystem.getState().selectedIndex).toBe(1);
    // Wrap around
    menuSystem.handleInput('down');
    expect(menuSystem.getState().selectedIndex).toBe(0);
  });

  it('should navigate up', () => {
    menuSystem.pushMenu(testMenu);
    menuSystem.handleInput('up');
    // Wrap around
    expect(menuSystem.getState().selectedIndex).toBe(1);
    menuSystem.handleInput('up');
    expect(menuSystem.getState().selectedIndex).toBe(0);
  });

  it('should select an item', () => {
    menuSystem.pushMenu(testMenu);
    menuSystem.handleInput('select');
    expect(testMenu.items[0].action).toHaveBeenCalled();
  });

  it('should handle submenus and back navigation', () => {
    const subMenu: Menu = { title: 'Sub', items: [{ label: 'Back' }] };
    menuSystem.pushMenu(testMenu);
    menuSystem.pushMenu(subMenu);

    expect(menuSystem.getState().activeMenu).toBe(subMenu);

    menuSystem.handleInput('back');
    expect(menuSystem.getState().activeMenu).toBe(testMenu);

    menuSystem.handleInput('back');
    expect(menuSystem.isActive()).toBe(false);
  });

  it('should handle input items', () => {
      const state = { value: 'Test' };
      const inputItem = {
          label: 'Input',
          type: 'input' as const,
          getValue: () => state.value,
          onUpdate: vi.fn((val) => state.value = val)
      };
      const inputMenu: Menu = {
          title: 'Input Menu',
          items: [inputItem]
      };
      menuSystem.pushMenu(inputMenu);

      menuSystem.handleInput('char', 'A');
      expect(inputItem.onUpdate).toHaveBeenCalledWith('TestA');
      expect(state.value).toBe('TestA');

      menuSystem.handleInput('left');
      expect(inputItem.onUpdate).toHaveBeenCalledWith('Test');
      expect(state.value).toBe('Test');
  });
});

describe('Draw_Menu', () => {
    it('should draw the menu', () => {
        const renderer = {
            drawfillRect: vi.fn(),
            drawCenterString: vi.fn(),
            drawString: vi.fn(),
        } as unknown as Renderer;

        const menu: Menu = {
            title: 'Test Menu',
            items: [
                { label: 'Item 1' },
                { label: 'Item 2' }
            ]
        };
        const state = { activeMenu: menu, selectedIndex: 0 };

        Draw_Menu(renderer, state, 800, 600);

        expect(renderer.drawfillRect).toHaveBeenCalled();
        expect(renderer.drawCenterString).toHaveBeenCalledWith(expect.any(Number), 'Test Menu');
        expect(renderer.drawCenterString).toHaveBeenCalledWith(expect.any(Number), '> Item 1 <');
        expect(renderer.drawCenterString).toHaveBeenCalledWith(expect.any(Number), 'Item 2');
    });

    it('should draw input items', () => {
        const renderer = {
            drawfillRect: vi.fn(),
            drawCenterString: vi.fn(),
            drawString: vi.fn(),
        } as unknown as Renderer;

        const menu: Menu = {
            title: 'Test Menu',
            items: [
                { label: 'Item 1', type: 'input', getValue: () => 'Value' },
            ]
        };
        const state = { activeMenu: menu, selectedIndex: 0 };

        Draw_Menu(renderer, state, 800, 600);

        expect(renderer.drawCenterString).toHaveBeenCalledWith(expect.any(Number), '> Item 1: Value_ <');
    });
});
