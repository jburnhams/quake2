import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FORWARD_SPEED,
  DEFAULT_MOUSE_SENSITIVITY,
  DEFAULT_PITCH_SPEED,
  DEFAULT_SIDE_SPEED,
  DEFAULT_YAW_SPEED,
  PlayerButton,
  angleMod,
} from '@quake2ts/shared';
import {
  InputBindings,
  InputCommandBuffer,
  InputController,
  InputAction,
  createDefaultBindings,
  type GamepadLike,
  type InputSource,
} from '../../src/index.js';
import { TestInputSource } from '@quake2ts/test-utils';

function createController(): InputController {
  const controller = new InputController({}, createDefaultBindings());
  const source = new TestInputSource();
  // Bind test source to verify input wiring (even if tests manually trigger handlers)
  controller.bindInputSource(source as unknown as InputSource);
  return controller;
}

describe('InputBindings', () => {
  it('provides default commands and allows rebinding', () => {
    const bindings = new InputBindings();
    expect(bindings.getBinding('KeyW')).toBe('+forward');
    expect(bindings.getBinding('Mouse1')).toBe('+attack');

    bindings.bind('KeyW', '+back');
    expect(bindings.getBinding('KeyW')).toBe('+back');

    bindings.unbind('Mouse1');
    expect(bindings.getBinding('Mouse1')).toBeUndefined();
  });

  it('supports reverse lookup of bound keys for a command', () => {
    const bindings = new InputBindings();
    const keys = bindings.getBoundKeys('+forward');
    expect(keys).toContain('KeyW');
    expect(keys).toContain('ArrowUp');

    bindings.bind('KeyX', '+test');
    expect(bindings.getBoundKeys('+test')).toEqual(['KeyX']);
    expect(bindings.getBoundKeys('+TEST')).toEqual(['KeyX']); // Case insensitive
  });
});

describe('InputController', () => {
  it('translates held movement keys into Quake II style forward/sidemove values', () => {
    const controller = createController();
    controller.handleKeyDown('KeyW', 0);
    controller.handleKeyDown('KeyD', 0);

    const cmd = controller.buildCommand(50, 50);

    expect(cmd.forwardmove).toBeCloseTo(DEFAULT_FORWARD_SPEED);
    expect(cmd.sidemove).toBeCloseTo(DEFAULT_FORWARD_SPEED);
    expect(cmd.upmove).toBe(0);
    expect(cmd.msec).toBe(50);
    expect(cmd.buttons & PlayerButton.Any).toBe(PlayerButton.Any);
  });

  it('keeps movement active while any bound key remains held and drops when all release', () => {
    const controller = createController();
    controller.handleKeyDown('KeyW', 0);
    controller.handleKeyDown('ArrowUp', 10);

    let cmd = controller.buildCommand(30, 30);
    expect(cmd.forwardmove).toBeCloseTo(DEFAULT_FORWARD_SPEED);

    controller.handleKeyUp('KeyW', 40);
    cmd = controller.buildCommand(20, 60);
    expect(cmd.forwardmove).toBeCloseTo(DEFAULT_FORWARD_SPEED);

    controller.handleKeyUp('ArrowUp', 80);
    cmd = controller.buildCommand(20, 100);
    expect(cmd.forwardmove).toBeCloseTo(DEFAULT_FORWARD_SPEED);

    cmd = controller.buildCommand(20, 120);
    expect(cmd.forwardmove).toBe(0);
  });

  it('applies run modifier mirroring cl_run/+speed semantics', () => {
    const controller = createController();
    controller.handleKeyDown('KeyW', 0);
    controller.handleKeyDown('ShiftLeft', 0);

    const cmd = controller.buildCommand(100, 100);
    expect(cmd.forwardmove).toBeCloseTo(DEFAULT_FORWARD_SPEED * 0.5);
  });

  it('sets attack, jump, and crouch button bits with matching upmove adjustments', () => {
    const controller = createController();
    controller.handleMouseButtonDown(0, 0);
    controller.handleKeyDown('Space', 0);
    controller.handleKeyDown('ControlLeft', 0);

    const cmd = controller.buildCommand(16, 16);
    expect(cmd.buttons & PlayerButton.Attack).toBe(PlayerButton.Attack);
    expect(cmd.buttons & PlayerButton.Jump).toBe(PlayerButton.Jump);
    expect(cmd.buttons & PlayerButton.Crouch).toBe(PlayerButton.Crouch);
    expect(cmd.upmove).toBeCloseTo(0);

    controller.handleMouseButtonUp(0, 32);
    const cmdAfterRelease = controller.buildCommand(16, 48);
    expect(cmdAfterRelease.buttons & PlayerButton.Attack).toBe(PlayerButton.Attack);

    const cmdCleared = controller.buildCommand(16, 64);
    expect(cmdCleared.buttons & PlayerButton.Attack).toBe(PlayerButton.None);
  });

  it('maps DOM mouse buttons to default Quake bindings', () => {
    const controller = createController();

    controller.handleMouseButtonDown(2, 0);
    controller.handleMouseButtonDown(1, 0);

    expect(controller.consumeConsoleCommands()).toEqual(['+use', '+zoom']);

    controller.handleMouseButtonUp(2, 16);
    controller.handleMouseButtonUp(1, 16);

    expect(controller.consumeConsoleCommands()).toEqual(['-use', '-zoom']);
  });

  it('converts mouse deltas into view angle changes with Quake pitch clamping', () => {
    const controller = createController();
    controller.setPointerLocked(true);
    controller.handleMouseMove(10, -5);

    const cmd = controller.buildCommand(16, 16);
    expect(cmd.angles.y).toBeCloseTo(angleMod(10 * DEFAULT_MOUSE_SENSITIVITY));
    expect(cmd.angles.x).toBeCloseTo(angleMod(-5 * DEFAULT_MOUSE_SENSITIVITY));

    const cmdNoMove = controller.buildCommand(16, 32);
    expect(cmdNoMove.angles.y).toBeCloseTo(cmd.angles.y);
    expect(cmdNoMove.angles.x).toBeCloseTo(cmd.angles.x);
  });

  it('uses keyboard look keys at the rerelease pitch/yaw speeds', () => {
    const controller = createController();
    controller.handleKeyDown('ArrowRight', 0);
    controller.handleKeyDown('PageDown', 0);

    const frameMsec = 50;
    const cmd = controller.buildCommand(frameMsec, frameMsec);

    const expectedYaw = (DEFAULT_YAW_SPEED * frameMsec) / 1000;
    const expectedPitch = (DEFAULT_PITCH_SPEED * frameMsec) / 1000;
    expect(cmd.angles.y).toBeCloseTo(expectedYaw);
    expect(cmd.angles.x).toBeCloseTo(expectedPitch);
  });

  it('queues non-action bindings as console commands', () => {
    const bindings = new InputBindings();
    const controller = new InputController({}, bindings);
    controller.handleKeyDown('Digit2', 0);

    const pending = controller.consumeConsoleCommands();
    expect(pending).toEqual(['weapon 2']);
    expect(controller.consumeConsoleCommands()).toEqual([]);
  });

  it('handles impulse commands via bindings', () => {
    const bindings = new InputBindings();
    bindings.bind('KeyI', 'impulse 10');
    const controller = new InputController({}, bindings);

    // Press key bound to impulse 10
    controller.handleKeyDown('KeyI', 0);

    // Console commands should be empty (impulse is consumed)
    expect(controller.consumeConsoleCommands()).toEqual([]);

    // Build command
    const cmd = controller.buildCommand(16, 16);
    expect(cmd.impulse).toBe(10);

    // Next frame should reset impulse
    const cmd2 = controller.buildCommand(16, 32);
    expect(cmd2.impulse).toBe(0);
  });

  it('clamps impulse commands to byte range', () => {
    const bindings = new InputBindings();
    bindings.bind('KeyA', 'impulse -5');
    bindings.bind('KeyB', 'impulse 300');
    const controller = new InputController({}, bindings);

    controller.handleKeyDown('KeyA', 0);
    let cmd = controller.buildCommand(16, 16);
    expect(cmd.impulse).toBe(0);

    controller.handleKeyDown('KeyB', 32);
    cmd = controller.buildCommand(16, 48);
    expect(cmd.impulse).toBe(255);
  });

  it('emits +action/-action command strings only on transitions', () => {
    const controller = createController();

    controller.handleKeyDown('KeyW', 0);
    controller.handleKeyDown('ArrowUp', 0);
    expect(controller.consumeConsoleCommands()).toEqual(['+forward']);

    controller.handleKeyUp('KeyW', 10);
    expect(controller.consumeConsoleCommands()).toEqual([]);

    controller.handleKeyUp('ArrowUp', 20);
    expect(controller.consumeConsoleCommands()).toEqual(['-forward']);
  });

  it('supports per-axis sensitivity and mouse filtering', () => {
    const controller = new InputController({
      sensitivityX: 2,
      sensitivityY: 4,
      mouseFilter: true,
      requirePointerLock: false,
    });

    controller.handleMouseMove(4, 2);
    let cmd = controller.buildCommand(16, 16);
    expect(cmd.angles.y).toBeCloseTo(4); // (4 + 0) / 2 * 2
    expect(cmd.angles.x).toBeCloseTo(4); // (2 + 0) / 2 * 4

    controller.handleMouseMove(4, 2);
    cmd = controller.buildCommand(16, 32);
    expect(cmd.angles.y).toBeCloseTo(12); // previous yaw 4 + (4 + 4) / 2 * 2
    expect(cmd.angles.x).toBeCloseTo(12);
  });

  it('buffers usercmd frames and console commands together', () => {
    const bindings = new InputBindings();
    const buffer = new InputCommandBuffer({}, new InputController({}, bindings));
    const controller = buffer.getController();

    controller.handleKeyDown('KeyW', 0);
    controller.handleKeyDown('Digit1', 0);

    const first = buffer.captureFrame(20, 20, 1);
    expect(first.command.forwardmove).toBeGreaterThan(0);
    expect(first.console).toEqual(['+forward', 'weapon 1']);

    controller.handleKeyUp('KeyW', 40);
    const second = buffer.captureFrame(20, 40, 2);
    expect(second.console).toEqual(['-forward']);

    const queued = buffer.consumeQueued();
    expect(queued).toHaveLength(2);
    expect(buffer.consumeQueued()).toEqual([]);
  });

  it('captures gamepad button transitions and default bindings', () => {
    const controller = createController();

    const gamepadPress: GamepadLike = {
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 8 }, (_, i) => ({ pressed: i === 7, value: i === 7 ? 1 : 0 })),
      index: 0,
      connected: true,
    };

    controller.setGamepadState([gamepadPress]);
    controller.buildCommand(16, 16);
    expect(controller.consumeConsoleCommands()).toEqual(['+attack']);

    const gamepadRelease: GamepadLike = {
      ...gamepadPress,
      buttons: gamepadPress.buttons.map(() => ({ pressed: false, value: 0 })),
    };

    controller.setGamepadState([gamepadRelease]);
    controller.buildCommand(16, 32);
    expect(controller.consumeConsoleCommands()).toEqual(['-attack']);
  });

  it('translates analog stick axes into movement with deadzone clamping', () => {
    const controller = createController();
    const pad: GamepadLike = {
      axes: [0.5, -1, 0, 0],
      buttons: [],
      index: 0,
      connected: true,
    };

    controller.setGamepadState([pad]);
    const cmd = controller.buildCommand(40, 40);

    expect(cmd.forwardmove).toBeCloseTo(DEFAULT_FORWARD_SPEED);
    expect(cmd.sidemove).toBeCloseTo(DEFAULT_FORWARD_SPEED * 0.5);

    controller.setGamepadState([{ ...pad, axes: [0.05, 0.05, 0, 0] }]);
    const noMove = controller.buildCommand(40, 80);
    expect(noMove.forwardmove).toBe(0);
    expect(noMove.sidemove).toBe(0);
  });

  it('applies analog look input scaled by yaw/pitch speed and inversion setting', () => {
    const controller = new InputController({ invertGamepadY: true }, createDefaultBindings());
    const pad: GamepadLike = {
      axes: [0, 0, 0.25, -0.5],
      buttons: [],
      index: 0,
      connected: true,
    };

    const frameMsec = 50;
    controller.setGamepadState([pad]);
    const cmd = controller.buildCommand(frameMsec, frameMsec);

    const yawStep = (DEFAULT_YAW_SPEED * frameMsec) / 1000;
    const pitchStep = (DEFAULT_PITCH_SPEED * frameMsec) / 1000;

    expect(cmd.angles.y).toBeCloseTo(0.25 * yawStep);
    expect(cmd.angles.x).toBeCloseTo(0.5 * pitchStep);
  });

  it('accepts touch virtual sticks for movement and look without pointer lock', () => {
    const controller = new InputController({ requirePointerLock: false }, createDefaultBindings());
    const frameMsec = 20;

    controller.setTouchState({
      move: { x: 1, y: 0.5 },
      look: { x: -0.25, y: 0.5 },
    });

    const cmd = controller.buildCommand(frameMsec, frameMsec);

    const yawStep = (DEFAULT_YAW_SPEED * frameMsec) / 1000;
    const pitchStep = (DEFAULT_PITCH_SPEED * frameMsec) / 1000;

    expect(cmd.forwardmove).toBeCloseTo(DEFAULT_FORWARD_SPEED * 0.5);
    expect(cmd.sidemove).toBeCloseTo(DEFAULT_SIDE_SPEED);
    expect(cmd.angles.y).toBeCloseTo(angleMod(-0.25 * yawStep));
    expect(cmd.angles.x).toBeCloseTo(0.5 * pitchStep);
  });

  it('queues touch button transitions and preserves held state across frames', () => {
    const controller = createController();

    controller.setTouchState({
      buttons: { [InputAction.Attack]: true, [InputAction.Jump]: true },
    });
    controller.buildCommand(16, 16);

    expect(controller.consumeConsoleCommands()).toEqual(['+attack', '+jump']);

    const held = controller.buildCommand(16, 32);
    expect(held.buttons & PlayerButton.Attack).toBe(PlayerButton.Attack);
    expect(held.buttons & PlayerButton.Jump).toBe(PlayerButton.Jump);

    controller.setTouchState({ buttons: { [InputAction.Attack]: false, [InputAction.Jump]: false } });
    controller.buildCommand(16, 48);

    expect(controller.consumeConsoleCommands()).toEqual(['-attack', '-jump']);
  });

  it('exposes bound keys for UI display', () => {
    const controller = createController();
    const forwardKeys = controller.getBoundKeys('+forward');
    expect(forwardKeys).toContain('KeyW');
    expect(forwardKeys).toContain('ArrowUp');

    controller.setKeyBinding('+testcmd', ['KeyP']);
    expect(controller.getBoundKeys('+testcmd')).toEqual(['KeyP']);
  });
});
