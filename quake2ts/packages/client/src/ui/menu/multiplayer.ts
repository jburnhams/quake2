import { Menu, MenuItem } from './types.js';
import { MenuSystem } from './system.js';
import { MultiplayerConnection } from '../../net/connection.js';

export class MultiplayerMenuFactory {
  constructor(
    private readonly menuSystem: MenuSystem,
    private readonly connection: MultiplayerConnection
  ) {}

  createMultiplayerMenu(initialAddress: string = 'localhost:27910', status: string = ''): Menu {
    // We cannot mutate MenuItems because they are readonly.
    // So we capture state in closure and recreate the menu structure when needed.

    let address = initialAddress;

    const items: MenuItem[] = [];

    // Status item
    if (status) {
        items.push({
            label: status,
            action: () => {} // No-op
        });
    }

    items.push(
        {
          label: 'Address: ' + address,
          action: () => {
             if (typeof window !== 'undefined') {
                 const newAddr = window.prompt('Enter Server Address', address);
                 if (newAddr) {
                     address = newAddr;
                     this.refreshMenu(address);
                 }
             }
          }
        },
        {
          label: 'Connect',
          action: () => {
            this.refreshMenu(address, 'Connecting...');
            this.connection.connect('ws://' + address)
                .then(() => {
                    this.menuSystem.closeAll();
                })
                .catch(err => {
                    console.error(err);
                    const failStatus = 'Failed: ' + (err.message || 'Unknown error');
                    this.refreshMenu(address, failStatus);
                });
          }
        },
        {
            label: 'Disconnect',
            action: () => {
                this.connection.disconnect();
                this.refreshMenu(address, 'Disconnected');
            }
        },
        {
          label: 'Back',
          action: () => {
            this.menuSystem.popMenu();
          }
        }
    );

    return {
      title: 'Multiplayer',
      items
    };
  }

  private refreshMenu(address: string, status: string = '') {
      this.menuSystem.popMenu();
      this.menuSystem.pushMenu(this.createMultiplayerMenu(address, status));
  }
}
