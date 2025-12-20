
export class MockPointerLock {
  private _doc: Document;
  private _targetElement: HTMLElement | undefined;

  constructor(doc: Document, element?: HTMLElement) {
    this._doc = doc;
    this._targetElement = element;
    this.setup();
  }

  private setup() {
    // We use a property on the document to store the lock state so that
    // multiple instances or patches share the same truth source if they access 'pointerLockElement'.
    // However, since we are redefining the getter, we need a closure variable.
    // To handle multiple initializations, we should try to reuse the existing mechanism if possible,
    // but simplifying to "last write wins" is acceptable for mocks.

    let currentLock: Element | null = null;

    // Define pointerLockElement on document
    Object.defineProperty(this._doc, 'pointerLockElement', {
      get: () => currentLock,
      configurable: true
    });

    // Mock exitPointerLock
    this._doc.exitPointerLock = () => {
      if (currentLock) {
        currentLock = null;
        this._doc.dispatchEvent(new Event('pointerlockchange'));
      }
    };

    // Mock requestPointerLock on Element prototype
    const win = this._doc.defaultView;
    if (win && win.HTMLElement) {
        (win.HTMLElement.prototype as any).requestPointerLock = function() {
            currentLock = this;
            const doc = this.ownerDocument;
            doc.dispatchEvent(new Event('pointerlockchange'));
        };
    } else if (typeof HTMLElement !== 'undefined') {
        // Fallback for global HTMLElement (Node.js/JSDOM global)
        (HTMLElement.prototype as any).requestPointerLock = function() {
            currentLock = this;
            const doc = this.ownerDocument;
             // @ts-ignore
            if (doc) doc.dispatchEvent(new Event('pointerlockchange'));
        };
    }
  }

  get element(): Element | null {
    return this._doc.pointerLockElement;
  }

  get locked(): boolean {
    return !!this.element;
  }

  isLocked(): boolean {
    return this.locked;
  }

  request() {
    if (this._targetElement) {
      this._targetElement.requestPointerLock();
    }
  }

  exit() {
    this._doc.exitPointerLock();
  }
}

export class InputInjector {
  constructor(private doc: Document, private win: Window) {}

  keyDown(key: string, code?: string) {
    const KeyboardEvent = (this.win as any).KeyboardEvent || global.KeyboardEvent;
    const event = new KeyboardEvent('keydown', {
      key,
      code: code || key,
      bubbles: true,
      cancelable: true,
      view: this.win
    });
    this.doc.dispatchEvent(event);
  }

  keyUp(key: string, code?: string) {
    const KeyboardEvent = (this.win as any).KeyboardEvent || global.KeyboardEvent;
    const event = new KeyboardEvent('keyup', {
      key,
      code: code || key,
      bubbles: true,
      cancelable: true,
      view: this.win
    });
    this.doc.dispatchEvent(event);
  }

  mouseMove(movementX: number, movementY: number, clientX = 0, clientY = 0) {
    const MouseEvent = (this.win as any).MouseEvent || global.MouseEvent;
    const event = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      view: this.win,
      clientX,
      clientY,
      // @ts-ignore: movementX is not standard in init
      movementX,
      // @ts-ignore: movementY is not standard in init
      movementY
    });

    // Force movement properties
    Object.defineProperty(event, 'movementX', { value: movementX });
    Object.defineProperty(event, 'movementY', { value: movementY });

    const target = this.doc.pointerLockElement || this.doc;
    target.dispatchEvent(event);
  }

  mouseDown(button: number = 0) {
    const MouseEvent = (this.win as any).MouseEvent || global.MouseEvent;
    const event = new MouseEvent('mousedown', {
      button,
      bubbles: true,
      cancelable: true,
      view: this.win
    });
    const target = this.doc.pointerLockElement || this.doc;
    target.dispatchEvent(event);
  }

  mouseUp(button: number = 0) {
    const MouseEvent = (this.win as any).MouseEvent || global.MouseEvent;
    const event = new MouseEvent('mouseup', {
      button,
      bubbles: true,
      cancelable: true,
      view: this.win
    });
    const target = this.doc.pointerLockElement || this.doc;
    target.dispatchEvent(event);
  }

  wheel(deltaY: number) {
    const WheelEvent = (this.win as any).WheelEvent || global.WheelEvent;
    const event = new WheelEvent('wheel', {
      deltaY,
      bubbles: true,
      cancelable: true,
      view: this.win
    });
    const target = this.doc.pointerLockElement || this.doc;
    target.dispatchEvent(event);
  }
}

// Factories

export function createMockPointerLock(element?: HTMLElement): MockPointerLock {
  const doc = element?.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!doc) throw new Error('No document available for MockPointerLock');
  return new MockPointerLock(doc, element);
}

export function createInputInjector(target?: EventTarget): InputInjector {
  let doc: Document | null = typeof document !== 'undefined' ? document : null;
  let win: Window | null = typeof window !== 'undefined' ? window : null;

  if (target) {
     if ('ownerDocument' in target && target.ownerDocument) {
         doc = (target as Node).ownerDocument;
     } else if ('document' in target) {
         // Window
         win = target as Window;
         doc = win.document;
     } else if ('defaultView' in target) {
         // Document
         doc = target as Document;
     }
  }

  if (doc && !win) win = doc.defaultView;
  if (!doc || !win) throw new Error('Could not resolve document/window for InputInjector');

  return new InputInjector(doc, win);
}

export function createMockKeyboardEvent(key: string, type: 'keydown' | 'keyup' = 'keydown', modifiers: { shift?: boolean, ctrl?: boolean, alt?: boolean, meta?: boolean } = {}): KeyboardEvent {
  const win = typeof window !== 'undefined' ? window : null;
  if (!win) throw new Error('No window available');

  return new win.KeyboardEvent(type, {
    key,
    code: key,
    shiftKey: modifiers.shift,
    ctrlKey: modifiers.ctrl,
    altKey: modifiers.alt,
    metaKey: modifiers.meta,
    bubbles: true,
    cancelable: true,
    view: win
  });
}

export function createMockMouseEvent(type: string, options: MouseEventInit = {}): MouseEvent {
  const win = typeof window !== 'undefined' ? window : null;
  if (!win) throw new Error('No window available');

  return new win.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: win,
    ...options
  });
}

export function createMockWheelEvent(deltaX: number = 0, deltaY: number = 0): WheelEvent {
  const win = typeof window !== 'undefined' ? window : null;
  if (!win) throw new Error('No window available');

  return new win.WheelEvent('wheel', {
    deltaX,
    deltaY,
    bubbles: true,
    cancelable: true,
    view: win
  });
}
