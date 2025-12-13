import { Menu, MenuItem, MenuState } from './types.js';

type MenuListener = (state: MenuState) => void;

export class MenuSystem {
  private activeMenu: Menu | null = null;
  private selectedIndex = 0;
  private menuStack: Menu[] = [];
  private listeners: MenuListener[] = [];

  constructor() {}

  addListener(listener: MenuListener): void {
      this.listeners.push(listener);
  }

  private notifyListeners(): void {
      const state = this.getState();
      for (const listener of this.listeners) {
          listener(state);
      }
  }

  pushMenu(menu: Menu): void {
    if (this.activeMenu) {
      this.menuStack.push(this.activeMenu);
      // Link parent for back navigation if not already linked
      if (!menu.parent) {
          (menu as any).parent = this.activeMenu;
      }
    }
    this.activeMenu = menu;
    this.selectedIndex = 0;
    this.notifyListeners();
  }

  popMenu(): void {
    if (this.menuStack.length > 0) {
      this.activeMenu = this.menuStack.pop()!;
      this.selectedIndex = 0;
    } else {
      this.activeMenu = null;
    }
    this.notifyListeners();
  }

  closeAll(): void {
    this.activeMenu = null;
    this.menuStack = [];
    this.selectedIndex = 0;
    this.notifyListeners();
  }

  handleInput(action: 'up' | 'down' | 'left' | 'right' | 'select' | 'back' | 'char', char?: string): boolean {
    if (!this.activeMenu) {
      return false;
    }

    const currentItem = this.activeMenu.items[this.selectedIndex];

    if (action === 'up') {
      this.selectedIndex = (this.selectedIndex - 1 + this.activeMenu.items.length) % this.activeMenu.items.length;
      this.notifyListeners();
      return true;
    }

    if (action === 'down') {
      this.selectedIndex = (this.selectedIndex + 1) % this.activeMenu.items.length;
      this.notifyListeners();
      return true;
    }

    if (action === 'select') {
      if (currentItem.action) {
        currentItem.action();
      }
      return true;
    }

    if (action === 'back') {
      this.popMenu();
      return true;
    }

    // Pass other inputs to item if it supports input
    if (currentItem.type === 'input' && currentItem.onUpdate && currentItem.getValue) {
        const currentValue = currentItem.getValue();
        if (action === 'char' && char) {
             const newValue = (currentValue || '') + char;
             currentItem.onUpdate(newValue);
        } else if (action === 'left') {
            // Backspace simulation for simplicity
            const str = String(currentValue || '');
            if (str.length > 0) {
                currentItem.onUpdate(str.slice(0, -1));
            }
        }
    }

    return true;
  }

  isActive(): boolean {
    return this.activeMenu !== null;
  }

  getState(): MenuState {
    return {
      activeMenu: this.activeMenu,
      selectedIndex: this.selectedIndex,
    };
  }
}
