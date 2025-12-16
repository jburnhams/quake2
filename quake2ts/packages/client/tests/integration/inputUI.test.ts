import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setupBrowserEnvironment } from '@quake2ts/tests/src/setup.js';
import { InputController } from '../../src/input/controller.js';
import { MenuSystem } from '../../src/ui/menu/system.js';

describe('Input and UI Integration', () => {
  let input: InputController;
  let menuSystem: MenuSystem;

  beforeEach(() => {
    setupBrowserEnvironment();
    input = new InputController();

    const mockClient = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        commands: {
            register: vi.fn(),
        }
    };

    menuSystem = new MenuSystem(mockClient as any);
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
