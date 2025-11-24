import { Menu, MenuItem } from './types.js';
import { MenuSystem } from './system.js';

export class MapMenuFactory {
  constructor(
    private readonly menuSystem: MenuSystem,
    private readonly loadMap: (mapName: string) => void
  ) {}

  createMapMenu(): Menu {
    // Ideally this would list maps from PAKs.
    // For now, hardcode a few known maps or provide a text input.

    return {
      title: 'Select Map',
      items: [
        {
          label: 'Base1: Outer Base',
          action: () => {
             this.loadMap('base1');
             this.menuSystem.closeAll();
          }
        },
        {
          label: 'Base2: Installation',
          action: () => {
             this.loadMap('base2');
             this.menuSystem.closeAll();
          }
        },
        {
            label: 'Base3: Comm Center',
            action: () => {
                this.loadMap('base3');
                this.menuSystem.closeAll();
            }
        },
        {
            label: 'Demo1',
            action: () => {
                this.loadMap('demo1');
                this.menuSystem.closeAll();
            }
        },
        // TODO: Dynamic list from VFS
        {
          label: 'Back',
          action: () => this.menuSystem.popMenu()
        }
      ]
    };
  }
}
