
export interface InputSource {
  on(event: 'keydown', handler: (code: string) => void): void;
  on(event: 'keyup', handler: (code: string) => void): void;
  on(event: 'mousedown', handler: (button: number) => void): void;
  on(event: 'mouseup', handler: (button: number) => void): void;
  on(event: 'mousemove', handler: (dx: number, dy: number) => void): void;
}

/**
 * A test implementation of InputSource that doesn't rely on DOM events.
 * Useful for testing input logic in Node.js environment.
 */
export class TestInputSource implements InputSource {
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, handler: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  // Helper methods to trigger events
  keyDown(code: string): void {
    this.emit('keydown', code);
  }

  keyUp(code: string): void {
    this.emit('keyup', code);
  }

  mouseDown(button: number): void {
    this.emit('mousedown', button);
  }

  mouseUp(button: number): void {
    this.emit('mouseup', button);
  }

  mouseMove(dx: number, dy: number): void {
    this.emit('mousemove', dx, dy);
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }

  // Clear all listeners (useful for cleanup)
  clear(): void {
    this.listeners.clear();
  }
}
