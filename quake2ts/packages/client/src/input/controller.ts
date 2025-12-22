import {
  DEFAULT_FORWARD_SPEED,
  DEFAULT_MOUSE_SENSITIVITY,
  DEFAULT_PITCH_SPEED,
  DEFAULT_SIDE_SPEED,
  DEFAULT_UP_SPEED,
  DEFAULT_YAW_SPEED,
  PlayerButton,
  addViewAngles,
  mouseDeltaToViewDelta,
  type MouseDelta,
  type UserCommand,
  type Vec3,
} from '@quake2ts/shared';
import { InputBindings, normalizeCommand, normalizeInputCode, type InputCode } from './bindings.js';

const MSEC_MAX = 250;

export interface GamepadLikeButton {
  readonly pressed: boolean;
  readonly value: number;
}

export interface GamepadLike {
  readonly axes: readonly number[];
  readonly buttons: readonly GamepadLikeButton[];
  readonly index?: number;
  readonly connected?: boolean;
}

interface ButtonState {
  readonly active: boolean;
  readonly wasPressed: boolean;
  readonly fraction: number;
}

export interface TouchInputState {
  readonly move?: { readonly x: number; readonly y: number };
  readonly look?: { readonly x: number; readonly y: number };
  readonly buttons?: Partial<Record<InputAction, boolean>>;
}

export interface InputSource {
  on(event: 'keydown', handler: (code: string) => void): void;
  on(event: 'keyup', handler: (code: string) => void): void;
  on(event: 'mousedown', handler: (button: number) => void): void;
  on(event: 'mouseup', handler: (button: number) => void): void;
  on(event: 'mousemove', handler: (dx: number, dy: number) => void): void;
}

class KeyButton {
  private readonly activeCodes = new Set<InputCode>();
  private downTime = 0;
  private msec = 0;
  private pressed = false;

  press(code: InputCode, now: number): boolean {
    if (this.activeCodes.has(code)) return false;

    this.activeCodes.add(code);
    this.pressed = true;
    if (this.activeCodes.size === 1) {
      this.downTime = now;
      return true;
    }

    return false;
  }

  release(code: InputCode, now: number): boolean {
    if (!this.activeCodes.delete(code)) return false;

    if (this.activeCodes.size === 0) {
      this.msec += now - this.downTime;
      this.downTime = 0;
      return true;
    }

    return false;
  }

  sample(frameMsec: number, now: number): ButtonState {
    if (frameMsec <= 0) {
      return { active: this.activeCodes.size > 0, wasPressed: this.pressed, fraction: 0 };
    }

    let total = this.msec;

    if (this.activeCodes.size > 0) {
      total += now - this.downTime;
      this.downTime = now;
    }

    this.msec = 0;

    const fraction = Math.min(total / frameMsec, 1);
    const wasPressed = this.pressed;
    this.pressed = false;

    return { active: this.activeCodes.size > 0, wasPressed, fraction };
  }
}

export interface InputControllerOptions {
  readonly forwardSpeed?: number;
  readonly sideSpeed?: number;
  readonly upSpeed?: number;
  readonly yawSpeed?: number;
  readonly pitchSpeed?: number;
  readonly sensitivity?: number;
  readonly sensitivityX?: number;
  readonly sensitivityY?: number;
  readonly invertMouseY?: boolean;
  readonly runByDefault?: boolean;
  readonly requirePointerLock?: boolean;
  readonly jumpAddsUpMove?: boolean;
  readonly crouchAddsDownMove?: boolean;
  readonly mouseFilter?: boolean;
  readonly getGamepads?: () => readonly (GamepadLike | null | undefined)[];
  readonly gamepadDeadZone?: number;
  readonly gamepadLookScale?: number;
  readonly invertGamepadY?: boolean;
}

export enum InputAction {
  Forward = '+forward',
  Back = '+back',
  MoveLeft = '+moveleft',
  MoveRight = '+moveright',
  MoveUp = '+moveup',
  MoveDown = '+movedown',
  Jump = '+jump',
  Crouch = '+crouch',
  Attack = '+attack',
  Use = '+use',
  Holster = '+holster',
  TurnLeft = '+left',
  TurnRight = '+right',
  LookUp = '+lookup',
  LookDown = '+lookdown',
  SpeedModifier = '+speed',
  Zoom = '+zoom',
}

const BUTTON_ACTIONS: Partial<Record<InputAction, PlayerButton>> = {
  [InputAction.Attack]: PlayerButton.Attack,
  [InputAction.Use]: PlayerButton.Use,
  [InputAction.Holster]: PlayerButton.Holster,
  [InputAction.Jump]: PlayerButton.Jump,
  [InputAction.Crouch]: PlayerButton.Crouch,
};

const ACTION_LOOKUP = new Map<string, InputAction>(
  Object.values(InputAction).map((action) => [normalizeCommand(action), action]),
);

function commandToAction(command: string): InputAction | undefined {
  return ACTION_LOOKUP.get(normalizeCommand(command));
}

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

export class InputController {
  private readonly bindings: InputBindings;
  private readonly buttons = new Map<InputAction, KeyButton>();
  private viewAngles: Vec3 = { x: 0, y: 0, z: 0 };
  private pointerLocked = false;
  private mouseDelta: MouseDelta = { deltaX: 0, deltaY: 0 };
  private previousMouseDelta: MouseDelta = { deltaX: 0, deltaY: 0 };
  private anyPressed = false;
  private commandQueue: string[] = [];
  private pendingGamepads: readonly (GamepadLike | null | undefined)[] | undefined;
  private readonly gamepadButtons = new Map<string, boolean>();
  private gamepadMove = { x: 0, y: 0 };
  private gamepadLook = { x: 0, y: 0 };
  private pendingTouchState: TouchInputState | undefined;
  private readonly touchButtons = new Map<InputAction, boolean>();
  private touchMove = { x: 0, y: 0 };
  private touchLook = { x: 0, y: 0 };

  private readonly forwardSpeed: number;
  private readonly sideSpeed: number;
  private readonly upSpeed: number;
  private readonly yawSpeed: number;
  private readonly pitchSpeed: number;
  private readonly sensitivity: number;
  private readonly sensitivityX?: number;
  private readonly sensitivityY?: number;
  private readonly invertMouseY: boolean;
  private readonly runByDefault: boolean;
  private readonly requirePointerLock: boolean;
  private readonly jumpAddsUpMove: boolean;
  private readonly crouchAddsDownMove: boolean;
  private readonly mouseFilter: boolean;
  private readonly getGamepads?: () => readonly (GamepadLike | null | undefined)[];
  private readonly gamepadDeadZone: number;
  private readonly gamepadLookScale: number;
  private readonly invertGamepadY: boolean;

  private sequence = 0;

  public onInputCommand?: (cmd: UserCommand) => void;

  constructor(options: InputControllerOptions = {}, bindings = new InputBindings()) {
    this.bindings = bindings;
    this.forwardSpeed = options.forwardSpeed ?? DEFAULT_FORWARD_SPEED;
    this.sideSpeed = options.sideSpeed ?? DEFAULT_SIDE_SPEED;
    this.upSpeed = options.upSpeed ?? DEFAULT_UP_SPEED;
    this.yawSpeed = options.yawSpeed ?? DEFAULT_YAW_SPEED;
    this.pitchSpeed = options.pitchSpeed ?? DEFAULT_PITCH_SPEED;
    this.sensitivity = options.sensitivity ?? DEFAULT_MOUSE_SENSITIVITY;
    this.sensitivityX = options.sensitivityX;
    this.sensitivityY = options.sensitivityY;
    this.invertMouseY = options.invertMouseY ?? false;
    this.runByDefault = options.runByDefault ?? true;
    this.requirePointerLock = options.requirePointerLock ?? true;
    this.jumpAddsUpMove = options.jumpAddsUpMove ?? true;
    this.crouchAddsDownMove = options.crouchAddsDownMove ?? true;
    this.mouseFilter = options.mouseFilter ?? false;
    this.getGamepads = options.getGamepads;
    this.gamepadDeadZone = options.gamepadDeadZone ?? 0.15;
    this.gamepadLookScale = options.gamepadLookScale ?? 1;
    this.invertGamepadY = options.invertGamepadY ?? this.invertMouseY;
  }

  handleKeyDown(code: string, eventTimeMs: number = nowMs()): void {
    const normalized = normalizeInputCode(code);
    const binding = this.bindings.getBinding(normalized);
    if (!binding) return;

    this.applyCommand(binding, true, normalized, eventTimeMs);
  }

  handleKeyUp(code: string, eventTimeMs: number = nowMs()): void {
    const normalized = normalizeInputCode(code);
    const binding = this.bindings.getBinding(normalized);
    if (!binding) return;

    this.applyCommand(binding, false, normalized, eventTimeMs);
  }

  handleMouseButtonDown(button: number, eventTimeMs: number = nowMs()): void {
    const code = this.mouseButtonToCode(button);
    this.applyCommand(this.mouseButtonToCommand(code), true, code, eventTimeMs);
  }

  handleMouseButtonUp(button: number, eventTimeMs: number = nowMs()): void {
    const code = this.mouseButtonToCode(button);
    this.applyCommand(this.mouseButtonToCommand(code), false, code, eventTimeMs);
  }

  handleMouseMove(deltaX: number, deltaY: number): void {
    if (this.requirePointerLock && !this.pointerLocked) return;

    this.mouseDelta = {
      deltaX: this.mouseDelta.deltaX + deltaX,
      deltaY: this.mouseDelta.deltaY + deltaY,
    };
  }

  setPointerLocked(locked: boolean): void {
    this.pointerLocked = locked;
  }

  setGamepadState(gamepads: readonly (GamepadLike | null | undefined)[]): void {
    this.pendingGamepads = gamepads;
  }

  setTouchState(state: TouchInputState): void {
    this.pendingTouchState = state;
  }

  bindInputSource(source: InputSource): void {
    source.on('keydown', (code) => this.handleKeyDown(code));
    source.on('keyup', (code) => this.handleKeyUp(code));
    source.on('mousedown', (button) => this.handleMouseButtonDown(button));
    source.on('mouseup', (button) => this.handleMouseButtonUp(button));
    source.on('mousemove', (dx, dy) => this.handleMouseMove(dx, dy));
  }

  setKeyBinding(action: string, keys: string[]): void {
    const normalizedAction = normalizeCommand(action);
    for (const key of keys) {
      this.bindings.bind(normalizeInputCode(key), normalizedAction);
    }
  }

  getBoundKeys(command: string): InputCode[] {
    return this.bindings.getBoundKeys(command);
  }

  getDefaultBindings(): InputBindings {
    return this.bindings;
  }

  buildCommand(frameMsec: number, now: number = nowMs(), serverFrame?: number): UserCommand {
    this.pollGamepads(now);
    this.applyTouchState(now);

    const yawStep = (this.yawSpeed * frameMsec) / 1000;
    const pitchStep = (this.pitchSpeed * frameMsec) / 1000;

    const turnLeft = this.sample(InputAction.TurnLeft, frameMsec, now);
    const turnRight = this.sample(InputAction.TurnRight, frameMsec, now);
    const lookUp = this.sample(InputAction.LookUp, frameMsec, now);
    const lookDown = this.sample(InputAction.LookDown, frameMsec, now);

    let viewDelta: Vec3 = {
      x: (lookDown.fraction - lookUp.fraction) * pitchStep,
      y: (turnRight.fraction - turnLeft.fraction) * yawStep,
      z: 0,
    };

    if (this.gamepadLook.x !== 0 || this.gamepadLook.y !== 0) {
      const pitch = this.gamepadLook.y * (this.invertGamepadY ? -1 : 1);
      viewDelta = {
        x: viewDelta.x + pitch * pitchStep * this.gamepadLookScale,
        y: viewDelta.y + this.gamepadLook.x * yawStep * this.gamepadLookScale,
        z: 0,
      };
    }

    if (this.touchLook.x !== 0 || this.touchLook.y !== 0) {
      const pitch = this.touchLook.y * (this.invertMouseY ? -1 : 1);
      viewDelta = {
        x: viewDelta.x + pitch * pitchStep,
        y: viewDelta.y + this.touchLook.x * yawStep,
        z: 0,
      };
    }

    if (this.pointerLocked || !this.requirePointerLock) {
      const sampledDelta = this.sampleMouseDelta();
      const mouseDelta = mouseDeltaToViewDelta(sampledDelta, {
        sensitivity: this.sensitivity,
        sensitivityX: this.sensitivityX,
        sensitivityY: this.sensitivityY,
        invertY: this.invertMouseY,
      });
      viewDelta = {
        x: viewDelta.x + mouseDelta.x,
        y: viewDelta.y + mouseDelta.y,
        z: 0,
      };
    }

    const angles = addViewAngles(this.viewAngles, viewDelta);
    this.viewAngles = angles;

    const forward = this.sample(InputAction.Forward, frameMsec, now);
    const back = this.sample(InputAction.Back, frameMsec, now);
    const moveLeft = this.sample(InputAction.MoveLeft, frameMsec, now);
    const moveRight = this.sample(InputAction.MoveRight, frameMsec, now);
    const moveUp = this.sample(InputAction.MoveUp, frameMsec, now);
    const moveDown = this.sample(InputAction.MoveDown, frameMsec, now);
    const speed = this.sample(InputAction.SpeedModifier, frameMsec, now);
    const jump = this.sample(InputAction.Jump, frameMsec, now);
    const crouch = this.sample(InputAction.Crouch, frameMsec, now);

    const speedScale = this.runByDefault
      ? speed.active
        ? 0.5
        : 1
      : speed.active
        ? 1
        : 0.5;

    let forwardmove = this.forwardSpeed * (forward.fraction - back.fraction) * speedScale;
    let sidemove = this.sideSpeed * (moveRight.fraction - moveLeft.fraction) * speedScale;
    let upmove = this.upSpeed * (moveUp.fraction - moveDown.fraction);

    if (this.gamepadMove.x !== 0 || this.gamepadMove.y !== 0) {
      forwardmove += this.forwardSpeed * this.gamepadMove.y * speedScale;
      sidemove += this.sideSpeed * this.gamepadMove.x * speedScale;
    }

    if (this.touchMove.x !== 0 || this.touchMove.y !== 0) {
      forwardmove += this.forwardSpeed * this.touchMove.y * speedScale;
      sidemove += this.sideSpeed * this.touchMove.x * speedScale;
    }

    if (this.jumpAddsUpMove && jump.fraction > 0) {
      upmove += this.upSpeed * jump.fraction;
    }

    if (this.crouchAddsDownMove && crouch.fraction > 0) {
      upmove -= this.upSpeed * crouch.fraction;
    }

    forwardmove = this.clampMove(forwardmove, this.forwardSpeed);
    sidemove = this.clampMove(sidemove, this.sideSpeed);
    upmove = this.clampMove(upmove, this.upSpeed);

    let buttons = this.collectButtonBits(frameMsec, now);

    const msec = Math.min(Math.max(Math.round(frameMsec), 1), MSEC_MAX);

    if (this.anyPressed || buttons !== PlayerButton.None) {
      buttons |= PlayerButton.Any;
    }

    this.anyPressed = false;

    // Command sequence number (client-side generated)
    this.sequence++;

    const command = {
      msec,
      buttons,
      angles: { ...this.viewAngles },
      forwardmove,
      sidemove,
      upmove,
      serverFrame,
      sequence: this.sequence,
      lightlevel: 0,
      impulse: 0
    } satisfies UserCommand;

    if (this.onInputCommand) {
        this.onInputCommand(command);
    }

    return command;
  }

  consumeConsoleCommands(): readonly string[] {
    const commands = this.commandQueue;
    this.commandQueue = [];
    return commands;
  }

  private pollGamepads(now: number): void {
    const gamepads = this.getGamepads?.() ?? this.pendingGamepads ?? [];
    this.pendingGamepads = undefined;

    this.gamepadMove = { x: 0, y: 0 };
    this.gamepadLook = { x: 0, y: 0 };

    const pressedThisFrame = new Set<InputCode>();

    for (const pad of gamepads) {
      if (!pad || pad.connected === false) continue;

      const index = pad.index ?? 0;
      const axes = pad.axes ?? [];

      this.gamepadMove = {
        x: this.mergeAnalog(this.gamepadMove.x, this.applyDeadZone(axes[0] ?? 0)),
        y: this.mergeAnalog(this.gamepadMove.y, -this.applyDeadZone(axes[1] ?? 0)),
      };

      this.gamepadLook = {
        x: this.mergeAnalog(this.gamepadLook.x, this.applyDeadZone(axes[2] ?? 0)),
        y: this.mergeAnalog(this.gamepadLook.y, this.applyDeadZone(axes[3] ?? 0)),
      };

      const buttons = pad.buttons ?? [];
      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        if (!button) continue;

        const pressed = button.pressed || button.value > this.gamepadDeadZone;
        const code = this.gamepadButtonCode(index, i);
        if (pressed) pressedThisFrame.add(code);

        const wasPressed = this.gamepadButtons.get(code) ?? false;
        if (pressed !== wasPressed) {
          this.applyCommand(this.bindings.getBinding(code), pressed, code, now);
          this.gamepadButtons.set(code, pressed);
        }
      }
    }

    for (const [code, wasPressed] of this.gamepadButtons.entries()) {
      if (wasPressed && !pressedThisFrame.has(code)) {
        this.applyCommand(this.bindings.getBinding(code), false, code, now);
        this.gamepadButtons.set(code, false);
      }
    }
  }

  private applyTouchState(now: number): void {
    const state = this.pendingTouchState;
    if (!state) return;

    this.pendingTouchState = undefined;

    if (state.move) {
      this.touchMove = {
        x: this.clampAnalog(state.move.x),
        y: this.clampAnalog(state.move.y),
      };
    }

    if (state.look) {
      this.touchLook = {
        x: this.clampAnalog(state.look.x),
        y: this.clampAnalog(state.look.y),
      };
    }

    if (state.buttons) {
      for (const [action, pressed] of Object.entries(state.buttons) as Array<
        [InputAction, boolean | undefined]
      >) {
        if (pressed === undefined) continue;

        const wasPressed = this.touchButtons.get(action) ?? false;
        if (pressed !== wasPressed) {
          this.applyCommand(action, pressed, this.touchButtonCode(action), now);
          this.touchButtons.set(action, pressed);
        }
      }
    }
  }

  private applyCommand(
    command: string | undefined,
    isDown: boolean,
    code: InputCode,
    eventTimeMs: number,
  ): void {
    if (!command) return;

    const action = commandToAction(command);
    if (action) {
      const button = this.lookupButton(action);
      if (isDown) {
        if (button.press(code, eventTimeMs)) {
          this.commandQueue.push(action);
        }
        this.anyPressed = true;
      } else if (button.release(code, eventTimeMs)) {
        this.commandQueue.push(action.replace('+', '-'));
      }
    } else if (isDown) {
      this.commandQueue.push(command);
    }
  }

  private sampleMouseDelta(): MouseDelta {
    const delta = this.mouseDelta;
    this.mouseDelta = { deltaX: 0, deltaY: 0 };

    if (!this.mouseFilter) {
      this.previousMouseDelta = delta;
      return delta;
    }

    const filtered = {
      deltaX: (delta.deltaX + this.previousMouseDelta.deltaX) * 0.5,
      deltaY: (delta.deltaY + this.previousMouseDelta.deltaY) * 0.5,
    } satisfies MouseDelta;

    this.previousMouseDelta = delta;
    return filtered;
  }

  private collectButtonBits(frameMsec: number, now: number): PlayerButton {
    let buttons = PlayerButton.None;

    for (const [action, bit] of Object.entries(BUTTON_ACTIONS) as Array<
      [InputAction, PlayerButton]
    >) {
      const sample = this.sample(action, frameMsec, now);
      if (sample.fraction > 0 || sample.active || sample.wasPressed) {
        buttons |= bit;
      }
    }

    return buttons;
  }

  private lookupButton(action: InputAction): KeyButton {
    let button = this.buttons.get(action);
    if (!button) {
      button = new KeyButton();
      this.buttons.set(action, button);
    }
    return button;
  }

  private mouseButtonToCode(button: number): InputCode {
    if (button === 0) return 'Mouse1';
    if (button === 1) return 'Mouse3';
    if (button === 2) return 'Mouse2';
    return `Mouse${button + 1}`;
  }

  private mouseButtonToCommand(code: InputCode): string | undefined {
    return this.bindings.getBinding(code);
  }

  private sample(action: InputAction, frameMsec: number, now: number): ButtonState {
    const button = this.lookupButton(action);
    return button.sample(frameMsec, now);
  }

  private gamepadButtonCode(index: number, button: number): InputCode {
    return `Gamepad${index}-Button${button}`;
  }

  private touchButtonCode(action: InputAction): InputCode {
    return `Touch-${action}`;
  }

  private clampAnalog(value: number): number {
    return Math.max(-1, Math.min(1, value));
  }

  private applyDeadZone(value: number): number {
    return Math.abs(value) < this.gamepadDeadZone ? 0 : value;
  }

  private mergeAnalog(current: number, incoming: number): number {
    return Math.abs(incoming) > Math.abs(current) ? incoming : current;
  }

  private clampMove(value: number, max: number): number {
    return Math.max(-max, Math.min(max, value));
  }
}
