import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InputController, InputAction } from '@quake2ts/client/input/controller.js';
import { InputBindings } from '@quake2ts/client/input/bindings.js';
import { TestInputSource } from '@quake2ts/test-utils';

describe('InputController Integration', () => {
  let controller: InputController;
  let bindings: InputBindings;
  let source: TestInputSource;

  beforeEach(() => {
    bindings = new InputBindings();
    controller = new InputController({}, bindings);
    source = new TestInputSource();
  });

  describe('bindInputSource', () => {
    it('should handle events from bound input source', () => {
      // Mock performance.now to ensure consistent timing
      vi.spyOn(performance, 'now').mockReturnValue(900);

      // Verify structural typing works without explicit cast
      controller.bindInputSource(source);

      // Bind KeyW to +forward
      bindings.bind('KeyW', '+forward');

      const onCommand = vi.fn();
      controller.onInputCommand = onCommand;

      // Simulate keydown
      source.keyDown('KeyW');

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
