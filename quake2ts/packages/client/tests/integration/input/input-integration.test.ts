// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InputController, InputAction } from '../../src/input/controller.js';
import { InputBindings } from '../../src/input/bindings.js';
import { BrowserInputSource, createInputInjector, InputInjector } from '@quake2ts/test-utils';

describe('InputController Integration', () => {
  let controller: InputController;
  let bindings: InputBindings;
  let injector: InputInjector;
  let source: BrowserInputSource;

  beforeEach(() => {
    bindings = new InputBindings();
    controller = new InputController({}, bindings);
    injector = createInputInjector();
    // Use the actual DOM input source wrapper from test-utils
    source = new BrowserInputSource(document);
  });

  describe('bindInputSource', () => {
    it('should handle events from bound input source', () => {
      // Mock performance.now to ensure consistent timing
      vi.spyOn(performance, 'now').mockReturnValue(900);

      controller.bindInputSource(source as any);

      // Bind KeyW to +forward
      bindings.bind('KeyW', '+forward');

      const onCommand = vi.fn();
      controller.onInputCommand = onCommand;

      // Simulate keydown via injector (which dispatches to document)
      injector.keyDown('KeyW', 'KeyW');

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
