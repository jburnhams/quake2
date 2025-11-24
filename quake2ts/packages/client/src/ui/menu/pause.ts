import { Menu, MenuItem } from './types.js';
import { MenuSystem } from './system.js';
import { OptionsMenuFactory } from './options.js';
import { SaveLoadMenuFactory } from './saveLoad.js';

export interface PauseMenuOptions {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  optionsFactory: OptionsMenuFactory;
  saveLoadFactory?: SaveLoadMenuFactory;
}

export class PauseMenuFactory {
  constructor(
    private readonly menuSystem: MenuSystem,
    private readonly options: PauseMenuOptions
  ) {}

  createPauseMenu(): Menu {
    const items: MenuItem[] = [
      {
        label: 'Resume Game',
        action: () => {
          this.options.onResume();
        },
      },
    ];

    if (this.options.saveLoadFactory) {
        items.push(
            {
                label: 'Save Game',
                action: () => {
                    void this.options.saveLoadFactory!.createSaveMenu().then(menu => {
                         this.menuSystem.pushMenu(menu);
                    });
                }
            },
            {
                label: 'Load Game',
                action: () => {
                     void this.options.saveLoadFactory!.createLoadMenu().then(menu => {
                         this.menuSystem.pushMenu(menu);
                    });
                }
            }
        );
    }

    items.push(
      {
        label: 'Options',
        action: () => {
           this.menuSystem.pushMenu(this.options.optionsFactory.createOptionsMenu());
        },
      },
      {
        label: 'Restart Level',
        action: () => {
            // Confirmation could be added here
            this.options.onRestart();
        }
      },
      {
        label: 'Quit to Main Menu',
        action: () => {
          // Confirmation could be added here
          this.options.onQuit();
        },
      },
    );

    return {
      title: 'Game Paused',
      items,
    };
  }
}
