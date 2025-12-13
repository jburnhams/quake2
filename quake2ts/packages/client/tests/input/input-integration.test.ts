import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InputController, InputAction } from '../../src/input/controller.js';
import { InputBindings } from '../../src/input/bindings.js';
import { InputSource } from '../../src/input/controller.js';

describe('InputController Integration', () => {
  let controller: InputController;
  let bindings: InputBindings;

  beforeEach(() => {
    bindings = new InputBindings();
    controller = new InputController({}, bindings);
  });

  describe('bindInputSource', () => {
    it('should handle events from bound input source', () => {
      const source: InputSource = {
        on: vi.fn()
      };

      const listeners: Record<string, Function> = {};
      (source.on as any).mockImplementation((event: string, handler: Function) => {
        listeners[event] = handler;
      });

      controller.bindInputSource(source);

      // Verify listeners are registered
      expect(source.on).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(source.on).toHaveBeenCalledWith('keyup', expect.any(Function));
      expect(source.on).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(source.on).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(source.on).toHaveBeenCalledWith('mousemove', expect.any(Function));

      // Test keydown triggering a command
      // Bind KeyW to +forward first
      bindings.bind('KeyW', '+forward');

      const onCommand = vi.fn();
      controller.onInputCommand = onCommand;

      // Simulate keydown
      listeners['keydown']('KeyW');

      // Verify command generated in buildCommand
      const cmd = controller.buildCommand(16, 1000);
      expect(cmd.forwardmove).toBeGreaterThan(0);
      expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
          forwardmove: expect.any(Number)
      }));
    });
  });

  describe('setKeyBinding', () => {
    it('should bind multiple keys to an action', () => {
      controller.setKeyBinding(InputAction.Jump, ['Space', 'KeyJ']);

      expect(bindings.getBinding('Space')).toBe('+jump');
      expect(bindings.getBinding('KeyJ')).toBe('+jump');
    });

    it('should normalize input codes and actions', () => {
        controller.setKeyBinding(' +attack ', [' Mouse1 ']);
        expect(bindings.getBinding('Mouse1')).toBe('+attack');
    });
  });

  describe('getDefaultBindings', () => {
    it('should return the current bindings instance', () => {
      const result = controller.getDefaultBindings();
      expect(result).toBe(bindings);
    });
  });

  describe('onInputCommand', () => {
    it('should trigger callback when command is built', () => {
      const callback = vi.fn();
      controller.onInputCommand = callback;

      const cmd = controller.buildCommand(16, 1000);
      expect(callback).toHaveBeenCalledWith(cmd);
    });
  });
});
