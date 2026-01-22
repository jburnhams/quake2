/**
 * Keyboard input handler for game controls.
 * Designed to be testable by allowing programmatic input injection.
 */

export interface InputState {
  forward: boolean;
  backward: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
  jump: boolean;
  lookUp: boolean;
  lookDown: boolean;
  lookLeft: boolean;
  lookRight: boolean;
  attack: boolean;
}

export function createEmptyInputState(): InputState {
  return {
    forward: false,
    backward: false,
    strafeLeft: false,
    strafeRight: false,
    jump: false,
    lookUp: false,
    lookDown: false,
    lookLeft: false,
    lookRight: false,
    attack: false,
  };
}

export interface KeyBindings {
  forward: string[];
  backward: string[];
  strafeLeft: string[];
  strafeRight: string[];
  jump: string[];
  lookUp: string[];
  lookDown: string[];
  lookLeft: string[];
  lookRight: string[];
  attack: string[];
}

// Movement and look bindings for WASD + Arrow keys scheme
const WASD_ARROWS_BINDINGS: KeyBindings = {
  forward: ['KeyW'],
  backward: ['KeyS'],
  strafeLeft: ['KeyA'],
  strafeRight: ['KeyD'],
  jump: ['Space'],
  lookUp: ['ArrowUp'],
  lookDown: ['ArrowDown'],
  lookLeft: ['ArrowLeft'],
  lookRight: ['ArrowRight'],
  attack: ['Mouse0', 'Enter'],
};

export class KeyboardInputHandler {
  private element: HTMLElement | null;
  private state: InputState = createEmptyInputState();
  private bindings: KeyBindings;
  private pressedKeys = new Set<string>();
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundBlur: () => void;

  constructor(element?: HTMLElement, bindings: KeyBindings = WASD_ARROWS_BINDINGS) {
    this.element = element || null;
    this.bindings = bindings;

    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.boundBlur = this.handleBlur.bind(this);
  }

  bind(): void {
    const target = this.element || window;
    target.addEventListener('keydown', this.boundKeyDown as EventListener);
    target.addEventListener('keyup', this.boundKeyUp as EventListener);
    window.addEventListener('blur', this.boundBlur);
  }

  unbind(): void {
    const target = this.element || window;
    target.removeEventListener('keydown', this.boundKeyDown as EventListener);
    target.removeEventListener('keyup', this.boundKeyUp as EventListener);
    window.removeEventListener('blur', this.boundBlur);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Prevent default for game keys to avoid scrolling etc.
    const isGameKey = this.isGameKey(e.code);
    if (isGameKey) {
      e.preventDefault();
    }

    if (!this.pressedKeys.has(e.code)) {
      this.pressedKeys.add(e.code);
      this.updateState();
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.pressedKeys.delete(e.code);
    this.updateState();
  }

  private handleBlur(): void {
    // Release all keys when window loses focus
    this.pressedKeys.clear();
    this.state = createEmptyInputState();
  }

  private isGameKey(code: string): boolean {
    for (const keys of Object.values(this.bindings)) {
      if (keys.includes(code)) {
        return true;
      }
    }
    return false;
  }

  private updateState(): void {
    const isPressed = (keys: string[]) => keys.some((k) => this.pressedKeys.has(k));

    this.state = {
      forward: isPressed(this.bindings.forward),
      backward: isPressed(this.bindings.backward),
      strafeLeft: isPressed(this.bindings.strafeLeft),
      strafeRight: isPressed(this.bindings.strafeRight),
      jump: isPressed(this.bindings.jump),
      lookUp: isPressed(this.bindings.lookUp),
      lookDown: isPressed(this.bindings.lookDown),
      lookLeft: isPressed(this.bindings.lookLeft),
      lookRight: isPressed(this.bindings.lookRight),
      attack: isPressed(this.bindings.attack),
    };
  }

  getState(): InputState {
    return { ...this.state };
  }

  /**
   * Programmatically set input state for testing.
   */
  setTestState(state: Partial<InputState>): void {
    this.state = { ...this.state, ...state };
  }

  /**
   * Clear all input state.
   */
  clear(): void {
    this.pressedKeys.clear();
    this.state = createEmptyInputState();
  }
}

/**
 * Create a mock input handler for testing that allows programmatic control.
 */
export class MockInputHandler extends KeyboardInputHandler {
  private mockState: InputState = createEmptyInputState();

  constructor() {
    super();
  }

  bind(): void {
    // No-op for mock
  }

  unbind(): void {
    // No-op for mock
  }

  getState(): InputState {
    return { ...this.mockState };
  }

  setTestState(state: Partial<InputState>): void {
    this.mockState = { ...this.mockState, ...state };
  }

  clear(): void {
    this.mockState = createEmptyInputState();
  }
}
