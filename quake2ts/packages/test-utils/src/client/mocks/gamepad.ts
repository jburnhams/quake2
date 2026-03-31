export interface MockGamepadButton {
  pressed: boolean;
  value: number;
}

export interface MockGamepad {
  readonly axes: readonly number[];
  readonly buttons: readonly MockGamepadButton[];
  readonly index: number;
  readonly connected: boolean;
}

export function createMockGamepadButton(pressed = false, value = 0): MockGamepadButton {
  return { pressed, value: pressed ? (value || 1) : value };
}

export function createMockGamepad(options: Partial<MockGamepad> = {}): MockGamepad {
  return {
    axes: options.axes ?? [0, 0, 0, 0],
    buttons: options.buttons ?? [],
    index: options.index ?? 0,
    connected: options.connected ?? true,
  };
}
