import { Menu, MenuItem } from './types.js';
import { MenuSystem } from './system.js';
import { ClientExports } from '../../index.js';

export interface DemoMenuOptions {
    onLoadDemoFile?: () => Promise<void>;
}

export class DemoMenuFactory {
  constructor(
    private readonly menuSystem: MenuSystem,
    private readonly client: ClientExports,
    private readonly options?: DemoMenuOptions
  ) {}

  createDemoMenu(): Menu {
    // In the future, this list will be populated from IndexedDB or VFS
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
      // Placeholder for demo list
      /*
      {
          label: 'demo1.dm2',
          action: () => this.playDemo('demo1.dm2')
      },
      */
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
