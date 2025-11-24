import { Menu, MenuItem } from './types.js';
import { MenuSystem } from './system.js';
import { EngineHost } from '@quake2ts/engine';

export class OptionsMenuFactory {
  constructor(
    private readonly menuSystem: MenuSystem,
    private readonly host: EngineHost
  ) {}

  createOptionsMenu(): Menu {
    return {
      title: 'Options',
      items: [
        {
          label: 'Video Options',
          action: () => {
            this.menuSystem.pushMenu(this.createVideoMenu());
          }
        },
        {
          label: 'Audio Options',
          action: () => {
            this.menuSystem.pushMenu(this.createAudioMenu());
          }
        },
        {
          label: 'Controls',
          action: () => {
            this.menuSystem.pushMenu(this.createControlsMenu());
          }
        },
        {
          label: 'Back',
          action: () => this.menuSystem.popMenu()
        }
      ]
    };
  }

  private createVideoMenu(): Menu {
    const cvars = this.host.cvars;
    return {
      title: 'Video Options',
      items: [
        {
          label: 'Field of View',
          type: 'input',
          getValue: () => cvars?.get('fov')?.string ?? '90',
          onUpdate: (val) => {
             // Basic validation
             const f = parseFloat(val);
             if (!isNaN(f)) {
                 cvars?.setValue('fov', val);
             }
          }
        },
        {
          label: 'Back',
          action: () => this.menuSystem.popMenu()
        }
      ]
    };
  }

  private createAudioMenu(): Menu {
    // Placeholder until audio cvars are confirmed
    return {
      title: 'Audio Options',
      items: [
        {
          label: 'Volume',
          type: 'slider', // Slider not fully implemented in system.ts yet, but structural support
          getValue: () => '0.7', // Mock
          onUpdate: (val) => console.log('Set volume', val)
        },
        {
          label: 'Back',
          action: () => this.menuSystem.popMenu()
        }
      ]
    };
  }

  private createControlsMenu(): Menu {
      const cvars = this.host.cvars;
      return {
          title: 'Controls',
          items: [
              {
                  label: 'Sensitivity',
                  type: 'input',
                  getValue: () => cvars?.get('sensitivity')?.string ?? '3',
                  onUpdate: (val) => {
                      const f = parseFloat(val);
                      if (!isNaN(f)) cvars?.setValue('sensitivity', val);
                  }
              },
              {
                  label: 'Invert Mouse',
                  type: 'toggle',
                  getValue: () => (cvars?.get('m_pitch')?.string.startsWith('-') ? 'Yes' : 'No'),
                  onUpdate: (val) => {
                      // Simple toggle logic: if currently negative, make positive, etc.
                      // Typically m_pitch is 0.022. Invert is -0.022.
                      // But for a generic toggle, we might just swap signs or use a boolean cvar if one existed.
                      // Assuming standard Quake 2 m_pitch behavior.
                      const current = parseFloat(cvars?.get('m_pitch')?.string ?? '0.022');
                      cvars?.setValue('m_pitch', (-current).toString());
                  }
              },
              {
                  label: 'Back',
                  action: () => this.menuSystem.popMenu()
              }
          ]
      };
  }
}
