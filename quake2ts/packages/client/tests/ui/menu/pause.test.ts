import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PauseMenuFactory } from '../../../src/ui/menu/pause.js';
import { MenuSystem } from '../../../src/ui/menu/system.js';
import { OptionsMenuFactory } from '../../../src/ui/menu/options.js';
import { EngineHost } from '@quake2ts/engine';

describe('PauseMenuFactory', () => {
  let menuSystem: MenuSystem;
  let optionsFactory: OptionsMenuFactory;
  let host: EngineHost;
  let factory: PauseMenuFactory;

  beforeEach(() => {
    menuSystem = new MenuSystem();
    optionsFactory = {
      createOptionsMenu: vi.fn().mockReturnValue({ title: 'Options', items: [] })
    } as any;
    host = {
      commands: {
        execute: vi.fn()
      }
    } as any;
    factory = new PauseMenuFactory(menuSystem, optionsFactory, host);
  });

  it('createPauseMenu has correct structure', () => {
    const menu = factory.createPauseMenu();
    expect(menu.title).toBe('Game Paused');
    const labels = menu.items.map(i => i.label);
    expect(labels).toContain('Resume Game');
    expect(labels).toContain('Options');
    expect(labels).toContain('Restart Level');
    expect(labels).toContain('Quit to Main Menu');
  });

  it('Resume Game closes menu', () => {
    const menu = factory.createPauseMenu();
    menuSystem.pushMenu(menu);
    expect(menuSystem.isActive()).toBe(true);

    const item = menu.items.find(i => i.label === 'Resume Game')!;
    item.action!();

    expect(menuSystem.isActive()).toBe(false);
  });

  it('Options opens options menu', () => {
    const menu = factory.createPauseMenu();
    menuSystem.pushMenu(menu);

    const item = menu.items.find(i => i.label === 'Options')!;
    item.action!();

    expect(optionsFactory.createOptionsMenu).toHaveBeenCalled();
    const active = menuSystem.getState().activeMenu;
    expect(active?.title).toBe('Options');
  });

  it('Restart Level executes restart command', () => {
    const menu = factory.createPauseMenu();
    const item = menu.items.find(i => i.label === 'Restart Level')!;
    item.action!();

    expect(host.commands.execute).toHaveBeenCalledWith('restart');
    expect(menuSystem.isActive()).toBe(false);
  });

  it('Quit executes disconnect command', () => {
    const menu = factory.createPauseMenu();
    const item = menu.items.find(i => i.label === 'Quit to Main Menu')!;
    item.action!();

    expect(host.commands.execute).toHaveBeenCalledWith('disconnect');
    expect(menuSystem.isActive()).toBe(false);
  });
});
