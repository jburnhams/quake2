export type InputCode = string;

export interface BindingEntry {
  readonly code: InputCode;
  readonly command: string;
}

export const DEFAULT_BINDINGS: readonly BindingEntry[] = [
  { code: 'KeyW', command: '+forward' },
  { code: 'ArrowUp', command: '+forward' },
  { code: 'KeyS', command: '+back' },
  { code: 'ArrowDown', command: '+back' },
  { code: 'KeyA', command: '+moveleft' },
  { code: 'KeyD', command: '+moveright' },
  { code: 'Space', command: '+jump' },
  { code: 'ControlLeft', command: '+crouch' },
  { code: 'ShiftLeft', command: '+speed' },
  { code: 'Mouse1', command: '+attack' },
  { code: 'Mouse2', command: '+use' },
  { code: 'Mouse3', command: '+zoom' },
  { code: 'ArrowLeft', command: '+left' },
  { code: 'ArrowRight', command: '+right' },
  { code: 'PageUp', command: '+lookup' },
  { code: 'PageDown', command: '+lookdown' },
  { code: 'Gamepad0-Button7', command: '+attack' },
  { code: 'Gamepad0-Button6', command: '+zoom' },
  { code: 'Gamepad0-Button0', command: '+jump' },
  { code: 'Gamepad0-Button1', command: '+crouch' },
  { code: 'Gamepad0-Button2', command: '+use' },
  { code: 'Gamepad0-Button4', command: 'prevweapon' },
  { code: 'Gamepad0-Button5', command: 'nextweapon' },
  { code: 'Digit1', command: 'weapon 1' },
  { code: 'Digit2', command: 'weapon 2' },
  { code: 'Digit3', command: 'weapon 3' },
  { code: 'Digit4', command: 'weapon 4' },
  { code: 'Digit5', command: 'weapon 5' },
  { code: 'Digit6', command: 'weapon 6' },
  { code: 'Digit7', command: 'weapon 7' },
  { code: 'Digit8', command: 'weapon 8' },
  { code: 'Digit9', command: 'weapon 9' },
  { code: 'Digit0', command: 'weapon 10' },
];

export type BindingMap = ReadonlyMap<InputCode, string>;

export class InputBindings {
  private readonly bindings = new Map<InputCode, string>();

  constructor(entries: Iterable<BindingEntry> = DEFAULT_BINDINGS) {
    for (const entry of entries) {
      this.bind(entry.code, entry.command);
    }
  }

  bind(code: InputCode, command: string): void {
    this.bindings.set(code, command);
  }

  unbind(code: InputCode): void {
    this.bindings.delete(code);
  }

  getBinding(code: InputCode): string | undefined {
    return this.bindings.get(code);
  }

  entries(): BindingMap {
    return new Map(this.bindings.entries());
  }
}

export function createDefaultBindings(): InputBindings {
  return new InputBindings();
}

export function normalizeInputCode(code: string): InputCode {
  return code;
}

export function normalizeCommand(command: string): string {
  return command.trim().toLowerCase();
}
