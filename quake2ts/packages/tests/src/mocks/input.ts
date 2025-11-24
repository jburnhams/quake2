
export class MockPointerLock {
  static setup(doc: Document) {
    // Mock pointerLockElement property
    let _pointerLockElement: Element | null = null;

    Object.defineProperty(doc, 'pointerLockElement', {
      get: () => _pointerLockElement,
      configurable: true
    });

    // Mock exitPointerLock
    doc.exitPointerLock = () => {
      if (_pointerLockElement) {
        _pointerLockElement = null;
        doc.dispatchEvent(new Event('pointerlockchange'));
      }
    };

    // Mock requestPointerLock on Element prototype
    // We need to extend the Element interface to make TS happy if we were strict,
    // but here we are modifying the prototype directly.
    (global.HTMLElement.prototype as any).requestPointerLock = function() {
      // In a real browser this is async and requires user gesture,
      // but for tests we make it immediate.
      _pointerLockElement = this;
      doc.dispatchEvent(new Event('pointerlockchange'));
    };
  }
}

export class InputInjector {
  constructor(private doc: Document, private win: Window) {}

  keyDown(key: string, code?: string) {
    const event = new this.win.KeyboardEvent('keydown', {
      key,
      code: code || key,
      bubbles: true,
      cancelable: true,
      view: this.win
    });
    this.doc.dispatchEvent(event);
  }

  keyUp(key: string, code?: string) {
    const event = new this.win.KeyboardEvent('keyup', {
      key,
      code: code || key,
      bubbles: true,
      cancelable: true,
      view: this.win
    });
    this.doc.dispatchEvent(event);
  }

  mouseMove(movementX: number, movementY: number, clientX = 0, clientY = 0) {
    const event = new this.win.MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      view: this.win,
      clientX,
      clientY,
      movementX, // Note: JSDOM might not support this standard property fully on event init
      movementY
    } as any);

    // Force movement properties if JSDOM doesn't handle them
    Object.defineProperty(event, 'movementX', { value: movementX });
    Object.defineProperty(event, 'movementY', { value: movementY });

    // Dispatch to pointer lock element if active, otherwise document
    const target = this.doc.pointerLockElement || this.doc;
    target.dispatchEvent(event);
  }

  mouseDown(button: number = 0) {
     const event = new this.win.MouseEvent('mousedown', {
      button,
      bubbles: true,
      cancelable: true,
      view: this.win
    });
    const target = this.doc.pointerLockElement || this.doc;
    target.dispatchEvent(event);
  }

  mouseUp(button: number = 0) {
    const event = new this.win.MouseEvent('mouseup', {
      button,
      bubbles: true,
      cancelable: true,
      view: this.win
    });
    const target = this.doc.pointerLockElement || this.doc;
    target.dispatchEvent(event);
  }

  wheel(deltaY: number) {
      const event = new this.win.WheelEvent('wheel', {
          deltaY,
          bubbles: true,
          cancelable: true,
          view: this.win
      });
      const target = this.doc.pointerLockElement || this.doc;
      target.dispatchEvent(event);
  }
}
