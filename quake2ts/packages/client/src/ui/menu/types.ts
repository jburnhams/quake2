export interface MenuItem {
  readonly label: string;
  readonly action?: () => void;
  readonly type?: 'button' | 'toggle' | 'slider' | 'input';
  // Value is now a getter to allow dynamic updates from a state container
  readonly getValue?: () => string | number | boolean;
  // Callback when value changes (e.g. from input)
  readonly onUpdate?: (value: any) => void;
}

export interface Menu {
  readonly title: string;
  readonly items: MenuItem[];
  readonly parent?: Menu;
}

export interface MenuState {
  readonly activeMenu: Menu | null;
  readonly selectedIndex: number;
}
