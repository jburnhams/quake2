import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OptionsMenuFactory } from '../../src/ui/menu/options.js';
import { MenuSystem } from '../../src/ui/menu/system.js';
import { EngineHost } from '@quake2ts/engine';

describe('OptionsMenuFactory', () => {
  let menuSystem: MenuSystem;
  let optionsFactory: OptionsMenuFactory;
  let mockCvars: Map<string, { string: string, setValue: (v: string) => void }>;

  beforeEach(() => {
    menuSystem = new MenuSystem();
    mockCvars = new Map();
    const host: EngineHost = {
        cvars: {
            get: (name: string) => mockCvars.get(name),
            setValue: (name: string, val: string) => {
                const existing = mockCvars.get(name);
                if (existing) {
                    existing.string = val; // Mock update
                } else {
                    mockCvars.set(name, { string: val, setValue: vi.fn() });
                }
            },
            register: vi.fn(),
        } as any,
        commands: {} as any,
        assets: {} as any
    };

    optionsFactory = new OptionsMenuFactory(menuSystem, host);
  });

  it('should create options menu', () => {
    const menu = optionsFactory.createOptionsMenu();
    expect(menu.title).toBe('Options');
    expect(menu.items).toHaveLength(4);
    expect(menu.items[0].label).toBe('Video Options');
    expect(menu.items[1].label).toBe('Audio Options');
    expect(menu.items[2].label).toBe('Controls');
    expect(menu.items[3].label).toBe('Back');
  });

  it('should navigate to video options', () => {
    const menu = optionsFactory.createOptionsMenu();
    // Simulate clicking Video Options
    menu.items[0].action!();

    const active = menuSystem.getState().activeMenu;
    expect(active).toBeDefined();
    expect(active!.title).toBe('Video Options');
  });

  it('should update FOV in video options', () => {
    mockCvars.set('fov', { string: '90', setValue: vi.fn() });
    const menu = optionsFactory.createOptionsMenu();
    // Go to video options
    menu.items[0].action!();

    const videoMenu = menuSystem.getState().activeMenu!;
    const fovItem = videoMenu.items.find(i => i.label === 'Field of View')!;

    expect(fovItem.getValue!()).toBe('90');

    fovItem.onUpdate!('110');
    expect(mockCvars.get('fov')?.string).toBe('110');
  });

  it('should navigate to controls menu', () => {
      const menu = optionsFactory.createOptionsMenu();
      menu.items[2].action!();

      const active = menuSystem.getState().activeMenu;
      expect(active!.title).toBe('Controls');
  });

  it('should toggle Invert Mouse', () => {
      mockCvars.set('m_pitch', { string: '0.022', setValue: vi.fn() });
      const menu = optionsFactory.createOptionsMenu();
      menu.items[2].action!(); // Controls

      const controlsMenu = menuSystem.getState().activeMenu!;
      const invertItem = controlsMenu.items.find(i => i.label === 'Invert Mouse')!;

      expect(invertItem.getValue!()).toBe('No');

      invertItem.onUpdate!();
      expect(mockCvars.get('m_pitch')?.string).toBe('-0.022');
      expect(invertItem.getValue!()).toBe('Yes');

      invertItem.onUpdate!();
      expect(mockCvars.get('m_pitch')?.string).toBe('0.022');
      expect(invertItem.getValue!()).toBe('No');
  });
});
