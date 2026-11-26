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
          label: 'Gameplay',
          action: () => {
            this.menuSystem.pushMenu(this.createGameplayMenu());
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
             const f = parseFloat(val);
             if (!isNaN(f)) {
                 cvars?.setValue('fov', val);
             }
          }
        },
        {
            label: 'Fullscreen',
            type: 'toggle',
            getValue: () => (document.fullscreenElement ? 'On' : 'Off'),
            onUpdate: () => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(err => {
                        console.error(`Error attempting to enable fullscreen: ${err.message}`);
                    });
                } else {
                    document.exitFullscreen();
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
    const cvars = this.host.cvars;
    return {
      title: 'Audio Options',
      items: [
        {
          label: 'Master Volume',
          type: 'input',
          getValue: () => cvars?.get('s_volume')?.string ?? '0.7',
          onUpdate: (val) => {
             const f = parseFloat(val);
             if (!isNaN(f)) cvars?.setValue('s_volume', val);
          }
        },
        {
            label: 'Music Volume',
            type: 'input',
            getValue: () => cvars?.get('ogg_volume')?.string ?? '0.7',
            onUpdate: (val) => {
                const f = parseFloat(val);
                if (!isNaN(f)) cvars?.setValue('ogg_volume', val);
            }
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
                  onUpdate: () => {
                      const current = parseFloat(cvars?.get('m_pitch')?.string ?? '0.022');
                      cvars?.setValue('m_pitch', (-current).toString());
                  }
              },
              {
                  label: 'Always Run',
                  type: 'toggle',
                  getValue: () => (cvars?.get('cl_run')?.integer ? 'Yes' : 'No'),
                  onUpdate: () => {
                      const current = cvars?.get('cl_run')?.integer ?? 1;
                      cvars?.setValue('cl_run', current ? '0' : '1');
                  }
              },
              {
                  label: 'Back',
                  action: () => this.menuSystem.popMenu()
              }
          ]
      };
  }

  private createGameplayMenu(): Menu {
      const cvars = this.host.cvars;
      return {
          title: 'Gameplay Options',
          items: [
              {
                  label: 'Crosshair',
                  type: 'toggle',
                  getValue: () => (cvars?.get('crosshair')?.integer ? 'On' : 'Off'),
                  onUpdate: () => {
                      const current = cvars?.get('crosshair')?.integer ?? 1;
                      cvars?.setValue('crosshair', current ? '0' : '1');
                  }
              },
              {
                  label: 'Handedness',
                  type: 'toggle',
                  getValue: () => (cvars?.get('hand')?.integer === 1 ? 'Left' : (cvars?.get('hand')?.integer === 2 ? 'Center' : 'Right')),
                  onUpdate: () => {
                      const current = cvars?.get('hand')?.integer ?? 0;
                      const next = (current + 1) % 3;
                      cvars?.setValue('hand', next.toString());
                  }
              },
              {
                  label: 'Back',
                  action: () => this.menuSystem.popMenu()
              }
          ]
      }
  }
}
