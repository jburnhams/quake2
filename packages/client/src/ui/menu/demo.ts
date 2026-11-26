import { Menu, MenuItem } from './types.js';
import { MenuSystem } from './system.js';
import { ClientExports } from '../../index.js';
import { DemoValidator } from '@quake2ts/engine';
import { DemoStorage, StoredDemoMetadata } from '../../demo/storage.js';

export interface DemoMenuOptions {
    onLoadDemoFile?: () => Promise<void>;
}

export class DemoMenuFactory {
  private storage: DemoStorage;

  constructor(
    private readonly menuSystem: MenuSystem,
    private readonly client: ClientExports,
    private readonly options?: DemoMenuOptions
  ) {
    this.storage = new DemoStorage();
  }

  createDemoMenu(): Menu {
    const items: MenuItem[] = [
      {
        label: 'Load Demo File...',
        action: () => {
             if (this.options?.onLoadDemoFile) {
                 this.options.onLoadDemoFile().then(() => {
                      this.menuSystem.closeAll();
                 }).catch(err => {
                      this.client.errorDialog.show("Error Loading Demo", err.message);
                 });
             } else {
                 this.loadDemoFromFilePicker();
             }
        }
      },
      // Stored demos will be appended here via refreshDemos,
      // but Menu structure expects static return.
      // We'll create a dynamic loader for the stored demos sub-section or just inject them.
      // For now, let's load them and update the menu?
      // Or better, return a Menu that has a "Stored Demos" submenu if we want to be clean,
      // but flattening is probably better for UX if few demos.
      // Since createDemoMenu is synchronous, we can't await listDemos().
      // We'll add a "Stored Demos..." item that opens a new menu which loads async.
      {
          label: 'Stored Demos...',
          action: () => this.openStoredDemosMenu()
      },
      {
        label: 'Back',
        action: () => this.menuSystem.popMenu()
      }
    ];

    return {
      title: 'Demos',
      items
    };
  }

  private openStoredDemosMenu() {
      // Show loading placeholder
      // Ideally we would fetch first then show menu, but we need to handle async

      this.storage.listDemos().then(demos => {
          const items: MenuItem[] = [];

          if (demos.length === 0) {
              items.push({ label: '<No stored demos>', action: () => {} });
          } else {
              demos.forEach(demo => {
                  items.push({
                      label: demo.name,
                      action: () => this.playStoredDemo(demo.name)
                  });
              });

              // Add a delete option? Or submenu for each demo?
              // For simplicity: Click to play.
              // Maybe long-press or a separate "Manage Demos" menu for deletion.
              items.push({ label: '---', action: () => {} });
              items.push({
                  label: 'Manage Demos (Delete)...',
                  action: () => this.openManageDemosMenu(demos)
              });
          }

          items.push({
              label: 'Back',
              action: () => this.menuSystem.popMenu()
          });

          this.menuSystem.pushMenu({
              title: 'Stored Demos',
              items
          });

      }).catch(err => {
          console.error("Failed to list demos", err);
          this.client.errorDialog.show("Error", "Failed to list stored demos");
      });
  }

  private openManageDemosMenu(demos: StoredDemoMetadata[]) {
      const items: MenuItem[] = demos.map(demo => ({
          label: `Delete ${demo.name}`,
          action: () => {
              if (confirm(`Delete ${demo.name}?`)) {
                  this.storage.deleteDemo(demo.name).then(() => {
                      this.menuSystem.popMenu(); // Close manage menu
                      this.menuSystem.popMenu(); // Close list menu to refresh
                      this.openStoredDemosMenu(); // Re-open list
                  });
              }
          }
      }));

      items.push({
          label: 'Back',
          action: () => this.menuSystem.popMenu()
      });

      this.menuSystem.pushMenu({
          title: 'Delete Demos',
          items
      });
  }

  private async playStoredDemo(name: string) {
      try {
          const demo = await this.storage.loadDemo(name);
          if (demo) {
              this.client.startDemoPlayback(demo.data, demo.name);
              this.menuSystem.closeAll();
          } else {
              this.client.errorDialog.show("Error", "Demo not found in storage");
          }
      } catch (e) {
          console.error("Failed to load demo from storage", e);
          this.client.errorDialog.show("Error", "Failed to load demo");
      }
  }

  private loadDemoFromFilePicker() {
      // Create a hidden file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.dm2';
      input.style.display = 'none';
      document.body.appendChild(input);

      input.onchange = async () => {
          if (input.files && input.files.length > 0) {
              const file = input.files[0];
              try {
                  const buffer = await file.arrayBuffer();

                  // Validate demo file
                  const result = DemoValidator.validate(buffer, file.name);
                  if (!result.valid) {
                      const msg = result.error || 'Unknown validation error';
                      this.client.errorDialog.show("Invalid Demo File", msg);
                      return;
                  }

                  // Save to storage (fire and forget, or await?)
                  // Better to await so we know it's safe? Or just let it happen.
                  // Task says "Store uploaded demos for quick access".
                  // We'll try to save it.
                  try {
                      await this.storage.saveDemo(file.name, buffer);
                  } catch (storeErr) {
                      console.warn("Failed to save demo to storage", storeErr);
                  }

                  // Start playback
                  this.client.startDemoPlayback(buffer, file.name);
                  this.menuSystem.closeAll();
              } catch (e) {
                  console.error("Failed to load demo:", e);
                  this.client.errorDialog.show("Load Error", "Failed to read demo file.");
              }
          }
          document.body.removeChild(input);
      };

      input.click();
  }
}
