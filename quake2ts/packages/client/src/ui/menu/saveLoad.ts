import { Menu, MenuItem } from './types.js';
import { MenuSystem } from './system.js';
import { SaveStorage, SaveSlotMetadata, GameSaveFile } from '@quake2ts/game';

export class SaveLoadMenuFactory {
  constructor(
    private readonly menuSystem: MenuSystem,
    private readonly storage: SaveStorage,
    private readonly onSave: (name: string) => Promise<void>,
    private readonly onLoad: (slotId: string) => Promise<void>
  ) {}

  async createSaveMenu(): Promise<Menu> {
    const saves = await this.storage.list();
    const items: MenuItem[] = [];

    // New Save Item
    items.push({
      label: 'New Save...',
      action: () => {
        this.menuSystem.pushMenu(this.createNewSaveInputMenu());
      },
    });

    // Overwrite existing saves
    saves.forEach((save) => {
      items.push({
        label: `${save.name} - ${save.map} (${formatTime(save.playtimeSeconds)})`,
        action: () => {
             // Confirm overwrite?
             this.menuSystem.pushMenu(this.createConfirmOverwriteMenu(save));
        },
      });
    });

    items.push({
        label: 'Back',
        action: () => this.menuSystem.popMenu()
    });

    return {
      title: 'Save Game',
      items,
    };
  }

  async createLoadMenu(): Promise<Menu> {
    const saves = await this.storage.list();
    const items: MenuItem[] = [];

    saves.forEach((save) => {
      items.push({
        label: `${save.name} - ${save.map} (${formatTime(save.playtimeSeconds)})`,
        action: () => {
             void this.onLoad(save.id).then(() => {
                 this.menuSystem.closeAll();
             });
        },
      });
    });

    if (saves.length === 0) {
        items.push({
            label: 'No saves found',
            action: () => {}
        });
    }

    items.push({
        label: 'Back',
        action: () => this.menuSystem.popMenu()
    });

    return {
      title: 'Load Game',
      items,
    };
  }

  private createNewSaveInputMenu(): Menu {
      // Use a local state object to hold the value
      const state = {
          name: `Save ${new Date().toLocaleString()}`
      };

      return {
          title: 'Enter Save Name',
          items: [
              {
                  label: 'Name',
                  type: 'input',
                  getValue: () => state.name,
                  onUpdate: (val) => { state.name = val; }
              },
              {
                  label: 'Save',
                  action: () => {
                      void this.onSave(state.name).then(() => {
                          this.menuSystem.closeAll();
                      });
                  }
              },
              {
                  label: 'Cancel',
                  action: () => this.menuSystem.popMenu()
              }
          ]
      }
  }

  private createConfirmOverwriteMenu(save: SaveSlotMetadata): Menu {
      return {
          title: `Overwrite ${save.name}?`,
          items: [
              {
                  label: 'Yes, Overwrite',
                  action: () => {
                       void this.onSave(save.name).then(() => { // Reuse name logic, or pass ID if update is supported
                           this.menuSystem.closeAll();
                       });
                  }
              },
              {
                  label: 'No, Cancel',
                  action: () => this.menuSystem.popMenu()
              }
          ]
      }
  }
}

function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
