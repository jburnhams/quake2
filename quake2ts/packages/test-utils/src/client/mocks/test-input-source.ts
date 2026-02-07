
// Note: Implicitly implements InputSource from @quake2ts/client/input/controller.js
// We avoid importing it directly to prevent circular dependencies between client and test-utils.

/**
 * A test implementation of InputSource that doesn't rely on DOM events.
 * Useful for testing input logic in Node.js environment.
 */
export class TestInputSource {
  private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();

  on(event: string, handler: (...args: any[]) => void): void {
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
