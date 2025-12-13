import { describe, it, expect, vi } from 'vitest';
import { GameSession } from '../src/session.js';
import { EngineImports, Renderer } from '@quake2ts/engine';
import { InputSource } from '../src/input/controller.js';

// Mock InputSource
class MockInputSource implements InputSource {
    handlers: Record<string, Function> = {};
    on(event: 'keydown' | 'keyup' | 'mousedown' | 'mouseup' | 'mousemove', handler: any) {
        this.handlers[event] = handler;
    }
    trigger(event: string, ...args: any[]) {
        if (this.handlers[event]) {
            this.handlers[event](...args);
        }
    }
}

describe('GameSession Input Integration', () => {
    const mockEngine = {
        trace: vi.fn(),
        renderer: {} as Renderer,
        cmd: { executeText: vi.fn() }
    } as unknown as EngineImports & { renderer: Renderer; cmd: { executeText: (text: string) => void } };

    it('should delegate input methods to internal controller', () => {
        const session = new GameSession({ engine: mockEngine });
        const controller = (session as any).inputController;
        const spyBind = vi.spyOn(controller, 'bindInputSource');
        const spySet = vi.spyOn(controller, 'setKeyBinding');

        const inputSource = new MockInputSource();
        session.bindInputSource(inputSource);
        expect(spyBind).toHaveBeenCalledWith(inputSource);

        session.setKeyBinding('action', ['k']);
        expect(spySet).toHaveBeenCalledWith('action', ['k']);

        const defaults = session.getDefaultBindings();
        expect(defaults).toBeDefined();
        expect(defaults).toBe(controller.getDefaultBindings());
    });

    it('should allow setting onInputCommand handler', () => {
        const session = new GameSession({ engine: mockEngine });
        const handler = vi.fn();

        session.onInputCommand = handler;
        expect(session.onInputCommand).toBe(handler);

        // Also verify it sets private property
        expect((session as any)._onInputCommand).toBe(handler);
    });

    it('should allow setting onHudUpdate handler', () => {
        const session = new GameSession({ engine: mockEngine });
        const handler = vi.fn();

        session.onHudUpdate = handler;
        expect(session.onHudUpdate).toBe(handler);
        expect((session as any)._onHudUpdate).toBe(handler);
    });

    it('should provide HUD data methods that default to null or default', () => {
        const session = new GameSession({ engine: mockEngine });
        expect(session.getHudData()).toBeNull();
        expect(session.getStatusBar()).toBeNull();
        expect(session.getCrosshairInfo()).toBeNull();
    });
});
