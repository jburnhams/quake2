import { Menu, MenuItem } from './types.js';
import { MenuSystem } from './system.js';
import { AssetManager, VirtualFileSystem } from '@quake2ts/engine';

export class MapsMenuFactory {
  constructor(
    private readonly menuSystem: MenuSystem,
    private readonly vfs: VirtualFileSystem,
    private readonly onStartMap: (mapName: string) => void
  ) {}

  createMapsMenu(): Menu {
    const maps = this.vfs.findByExtension('.bsp');

    // Filter maps if needed (e.g. exclude test maps)
    // For now, list all.
    // Quake 2 maps usually are in maps/ folder.
    const mapItems: MenuItem[] = maps.map(file => ({
        label: file.path.replace(/^maps\//, '').replace(/\.bsp$/, ''),
        action: () => {
            this.onStartMap(file.path.replace(/^maps\//, '').replace(/\.bsp$/, ''));
            this.menuSystem.closeAll();
        }
    }));

    if (mapItems.length === 0) {
        mapItems.push({
            label: 'No maps found',
            action: () => {}
        });
    }

    mapItems.push({
        label: 'Back',
        action: () => this.menuSystem.popMenu()
    });

    return {
      title: 'Select Map',
      items: mapItems
    };
  }
}
