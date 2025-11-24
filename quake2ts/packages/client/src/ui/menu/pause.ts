import { Menu } from './types.js';
import { MenuSystem } from './system.js';
import { OptionsMenuFactory } from './options.js';
import { EngineHost } from '@quake2ts/engine';

export class PauseMenuFactory {
  constructor(
    private readonly menuSystem: MenuSystem,
    private readonly optionsFactory: OptionsMenuFactory,
    private readonly host?: EngineHost
  ) {}

  createPauseMenu(): Menu {
    return {
      title: 'Game Paused',
      items: [
        {
          label: 'Resume Game',
          action: () => {
            this.menuSystem.closeAll();
          }
        },
        {
          label: 'Options',
          action: () => {
            this.menuSystem.pushMenu(this.optionsFactory.createOptionsMenu());
          }
        },
        {
          label: 'Restart Level',
          action: () => {
             this.host?.commands.execute('restart');
             this.menuSystem.closeAll();
          }
        },
        {
            label: 'Quit to Main Menu',
            action: () => {
                this.host?.commands.execute('disconnect');
                this.menuSystem.closeAll();
            }
        }
      ]
    };
  }
}
