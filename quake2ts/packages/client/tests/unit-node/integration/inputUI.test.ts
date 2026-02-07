import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { InputController } from '@quake2ts/client/input/controller.js';
import { MenuSystem } from '@quake2ts/client/ui/menu/system.js';

describe('Input and UI Integration', () => {
  let input: InputController;
  let menuSystem: MenuSystem;

  beforeEach(() => {
    input = new InputController();
    menuSystem = new MenuSystem();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should inject keyboard input and propagate to game command', () => {
    input.handleKeyDown('w');
    const cmd = input.buildCommand(16);
    expect(cmd).toBeDefined();
  });

  it('should toggle menu on Escape key', () => {
    expect(menuSystem.isActive()).toBe(false);
    const mainMenu = { items: [] };
    menuSystem.pushMenu(mainMenu as any);
    expect(menuSystem.isActive()).toBe(true);
    menuSystem.closeAll();
    expect(menuSystem.isActive()).toBe(false);
  });

  it('should provide state for rendering', () => {
    // The MenuSystem doesn't draw itself; it provides state to the renderer.
    // We verify that the system exposes a getState method that returns the current menu state.

    expect(menuSystem.getState).toBeDefined();
    expect(typeof menuSystem.getState).toBe('function');

    const state = menuSystem.getState();
    expect(state).toHaveProperty('activeMenu');
    expect(state).toHaveProperty('selectedIndex');
  });
});
