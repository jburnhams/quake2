import { Renderer } from '@quake2ts/engine';
import { PlayerClient } from '@quake2ts/game';

export interface WheelMenu {
  active: boolean;
  type: 'weapon' | 'item';
  selectedIndex: number;
}

export class WheelMenuSystem {
  private state: WheelMenu = {
    active: false,
    type: 'weapon',
    selectedIndex: -1
  };

  open(type: 'weapon' | 'item') {
    this.state.active = true;
    this.state.type = type;
  }

  close() {
    this.state.active = false;
  }

  isOpen(): boolean {
    return this.state.active;
  }

  handleInput(deltaX: number, deltaY: number) {
    if (!this.state.active) return;
    // Calculate angle from center to select item
    // Stub implementation
  }

  render(renderer: Renderer, width: number, height: number, client: PlayerClient) {
    if (!this.state.active) return;

    // Draw radial menu background
    const centerX = width / 2;
    const centerY = height / 2;
    // Stub: draw a transparent circle/box
    renderer.drawfillRect(centerX - 100, centerY - 100, 200, 200, [0, 0, 0, 0.5]);
    renderer.drawCenterString(centerY, `Select ${this.state.type}`);
  }
}
