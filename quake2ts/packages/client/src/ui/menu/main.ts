import { Menu, MenuItem } from './types.js';
import { MenuSystem } from './system.js';
import { SaveLoadMenuFactory } from './saveLoad.js';

export interface MainMenuOptions {
  onNewGame: () => void;
  onQuit: () => void;
  // TODO: Add options handler
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
      {
        label: 'Save Game',
        action: () => {
           // Should this be available in Main Menu? Typically only when paused.
           // Quake 2 Main Menu usually only has Load, unless you are "in game" and brought up the menu.
           // For now, I'll include it but maybe it should be conditional.
           // Since this factory creates "The Main Menu", the caller can decide to use a different factory or method for "Pause Menu".
           // But often they are the same.
           // I'll add it for now.
           void this.saveLoadFactory.createSaveMenu().then((menu) => {
             this.menuSystem.pushMenu(menu);
           });
        },
      },
      {
        label: 'Options',
        action: () => {
            // TODO: Implement options
            console.log('Options clicked');
        }
      },
      {
        label: 'Quit',
        action: () => {
          this.options.onQuit();
        },
      },
    ];

    return {
      title: 'Main Menu',
      items,
    };
  }
}
