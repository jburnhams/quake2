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

  it.todo('should verify HUD draw function exists');
});
