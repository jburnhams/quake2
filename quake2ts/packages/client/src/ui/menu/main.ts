import { Menu, MenuItem } from './types.js';
import { MenuSystem } from './system.js';
import { SaveLoadMenuFactory } from './saveLoad.js';
import { OptionsMenuFactory } from './options.js';
<<<<<<< HEAD
<<<<<<< HEAD
=======
import { MapsMenuFactory } from './maps.js';
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
import { MapsMenuFactory } from './maps.js';
>>>>>>> origin/main

export interface MainMenuOptions {
  onNewGame: () => void;
  onQuit: () => void;
  optionsFactory: OptionsMenuFactory;
<<<<<<< HEAD
<<<<<<< HEAD
=======
  mapsFactory: MapsMenuFactory;
  onSetDifficulty?: (skill: number) => void;
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
  mapsFactory: MapsMenuFactory;
  onSetDifficulty?: (skill: number) => void;
>>>>>>> origin/main
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
<<<<<<< HEAD
<<<<<<< HEAD
          this.options.onNewGame();
=======
          this.menuSystem.pushMenu(this.createDifficultyMenu());
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
          this.menuSystem.pushMenu(this.createDifficultyMenu());
>>>>>>> origin/main
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
<<<<<<< HEAD
<<<<<<< HEAD
=======
=======
>>>>>>> origin/main

  private createDifficultyMenu(): Menu {
      return {
          title: 'Select Difficulty',
          items: [
              {
                  label: 'Easy',
                  action: () => this.startNewGame(0)
              },
              {
                  label: 'Medium',
                  action: () => this.startNewGame(1)
              },
              {
                  label: 'Hard',
                  action: () => this.startNewGame(2)
              },
              {
                  label: 'Map Select...',
                  action: () => {
                      this.menuSystem.pushMenu(this.options.mapsFactory.createMapsMenu());
                  }
              },
              {
                  label: 'Back',
                  action: () => this.menuSystem.popMenu()
              }
          ]
      };
  }

  private startNewGame(difficulty: number) {
      if (this.options.onSetDifficulty) {
          this.options.onSetDifficulty(difficulty);
      }
      this.options.onNewGame();
  }
<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main
}
