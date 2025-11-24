import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InputController, InputAction, InputControllerOptions } from '../src/input/controller.js';
import { InputBindings } from '../src/input/bindings.js';

describe('InputController Zoom', () => {
  let controller: InputController;

  beforeEach(() => {
    const bindings = new InputBindings();
    bindings.bind('Mouse3', '+zoom');
    controller = new InputController({} as InputControllerOptions, bindings);
  });

  it('should detect zoom button press', () => {
    // Press zoom button
    controller.handleMouseButtonDown(1); // Mouse3 is button 1

    const command = controller.buildCommand(16);

    // Check if command has Zoom action in queue or some way to detect it.
    // The InputController collects button bits.
    // We need to check if `+zoom` updates any public state or button bit.
    // Currently, `+zoom` is not mapped to a specific `PlayerButton` bit in `BUTTON_ACTIONS` in `controller.ts`.
    // It might be treated as a generic command or we need to map it.

    // However, InputController's buildCommand returns `buttons` which is a bitmask.
    // If +zoom is not in BUTTON_ACTIONS, it won't set a bit.
    // But it should be in the command queue if we check `consumeConsoleCommands`.

    const commands = controller.consumeConsoleCommands();
    expect(commands).toContain('+zoom');
  });

  it('should detect zoom button release', () => {
    controller.handleMouseButtonDown(1);
    controller.handleMouseButtonUp(1);

    const commands = controller.consumeConsoleCommands();
    expect(commands).toContain('+zoom');
    expect(commands).toContain('-zoom');
  });
});
