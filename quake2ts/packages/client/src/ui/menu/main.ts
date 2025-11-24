import { Menu, MenuItem } from './types.js';
import { MenuSystem } from './system.js';
import { SaveLoadMenuFactory } from './saveLoad.js';
import { OptionsMenuFactory } from './options.js';

export interface MainMenuOptions {
  onNewGame: () => void;
  onQuit: () => void;
  optionsFactory: OptionsMenuFactory;
  showSaveOption?: boolean;
}

export class MainMenuFactory {
  constructor(
    private readonly menuSystem: MenuSystem,
    private readonly saveLoadFactory: SaveLoadMenuFactory,
    private readonly options: MainMenuOptions
  ) {}

  createMainMenu(): Menu {
    const items: MenuItem[] = [
      {
        label: 'New Game',
        action: () => {
          this.options.onNewGame();
        },
      },
      {
        label: 'Load Game',
        action: () => {
          void this.saveLoadFactory.createLoadMenu().then((menu) => {
            this.menuSystem.pushMenu(menu);
          });
        },
      },
    ];

    if (this.options.showSaveOption !== false) {
      items.push({
        label: 'Save Game',
        action: () => {
           void this.saveLoadFactory.createSaveMenu().then((menu) => {
             this.menuSystem.pushMenu(menu);
           });
        },
      });
    }

    items.push(
      {
        label: 'Options',
        action: () => {
            this.menuSystem.pushMenu(this.options.optionsFactory.createOptionsMenu());
        }
      },
      {
        label: 'Quit',
        action: () => {
          this.options.onQuit();
        },
      },
    );

    return {
      title: 'Main Menu',
      items,
    };
  }
}
