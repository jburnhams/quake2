import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapMenuFactory } from '../../../src/ui/menu/maps.js';
import { MenuSystem } from '../../../src/ui/menu/system.js';

describe('MapMenuFactory', () => {
  let menuSystem: MenuSystem;
  let loadMap: any;
  let factory: MapMenuFactory;

  beforeEach(() => {
    menuSystem = new MenuSystem();
    loadMap = vi.fn();
    factory = new MapMenuFactory(menuSystem, loadMap);
  });

  it('creates a menu with map options', () => {
    const menu = factory.createMapMenu();
    expect(menu.title).toBe('Select Map');

    const labels = menu.items.map(i => i.label);
    expect(labels).toContain('Base1: Outer Base');
    expect(labels).toContain('Demo1');
    expect(labels).toContain('Back');
  });

  it('Map selection calls loadMap and closes menu', () => {
    const closeSpy = vi.spyOn(menuSystem, 'closeAll');
    const menu = factory.createMapMenu();

    const item = menu.items.find(i => i.label.includes('Base1'));
    item?.action?.();

    expect(loadMap).toHaveBeenCalledWith('base1');
    expect(closeSpy).toHaveBeenCalled();
  });

  it('Back action pops menu', () => {
    const popSpy = vi.spyOn(menuSystem, 'popMenu');
    const menu = factory.createMapMenu();

    const item = menu.items.find(i => i.label === 'Back');
    item?.action?.();

    expect(popSpy).toHaveBeenCalled();
  });
});
