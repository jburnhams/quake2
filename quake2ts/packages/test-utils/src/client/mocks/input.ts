
/**
 * Client Input System Mocks
 *
 * Provides utilities for simulating user input (keyboard, mouse, pointer lock)
 * in a test environment (JSDOM/Browser).
 */

export interface KeyModifiers {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

/**
 * Factory for creating a mock KeyboardEvent.
 */
export function createMockKeyboardEvent(key: string, type: 'keydown' | 'keyup' = 'keydown', modifiers: KeyModifiers = {}): KeyboardEvent {
  return new KeyboardEvent(type, {
    key,
    code: key, // Default code to key if not specified (caller can override property if needed)
    ctrlKey: modifiers.ctrl,
    altKey: modifiers.alt,
    shiftKey: modifiers.shift,
    metaKey: modifiers.meta,
    bubbles: true,
    cancelable: true,
    view: window
  });
}

/**
 * Factory for creating a mock MouseEvent with support for movementX/Y.
 */
export function createMockMouseEvent(type: string, options: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    ...options
  });

  // Patch movementX/Y if needed as JSDOM MouseEvent might not initialize them from options
  if (options.movementX !== undefined) {
    Object.defineProperty(event, 'movementX', { value: options.movementX });
  }
  if (options.movementY !== undefined) {
    Object.defineProperty(event, 'movementY', { value: options.movementY });
  }

  return event;
}

/**
 * Factory for creating a mock WheelEvent.
 */
export function createMockWheelEvent(deltaX: number = 0, deltaY: number = 0): WheelEvent {
  return new WheelEvent('wheel', {
    deltaX,
    deltaY,
    bubbles: true,
    cancelable: true,
    view: window
  });
}

/**
 * Class implementing a mock for the Pointer Lock API.
 * Handles patching the document and element prototypes to simulate pointer lock.
 */
export class MockPointerLock {
  private _doc: Document;

  constructor(doc: Document = document) {
    this._doc = doc;
    this.setup();
  }

  private setup() {
    // Check if already patched to avoid conflicts
    if ((this._doc as any).__mockPointerLockInstalled) return;

    let _pointerLockElement: Element | null = null;
    const doc = this._doc;

    // Patch document.pointerLockElement
    Object.defineProperty(doc, 'pointerLockElement', {
      get: () => _pointerLockElement,
      configurable: true
    });

    // Patch document.exitPointerLock
    doc.exitPointerLock = () => {
      if (_pointerLockElement) {
        _pointerLockElement = null;
        doc.dispatchEvent(new Event('pointerlockchange'));
      }
    };

    // Patch HTMLElement.prototype.requestPointerLock
    // Save original if needed, but in JSDOM it might not exist or do nothing
    if (!(global.HTMLElement.prototype as any).__originalRequestPointerLock) {
        (global.HTMLElement.prototype as any).__originalRequestPointerLock = (global.HTMLElement.prototype as any).requestPointerLock;
    }

    (global.HTMLElement.prototype as any).requestPointerLock = function() {
        _pointerLockElement = this;
        doc.dispatchEvent(new Event('pointerlockchange'));
    };

    (doc as any).__mockPointerLockInstalled = true;
  }

  get element(): Element | null {
    return this._doc.pointerLockElement;
  }

  get locked(): boolean {
    return !!this.element;
  }

  request(element: HTMLElement) {
    element.requestPointerLock();
  }

  exit() {
    this._doc.exitPointerLock();
  }

  isLocked(): boolean {
    return this.locked;
  }
}

/**
 * Class for simulating input events.
 */
export class InputInjector {
  constructor(private doc: Document = document, private win: Window = window) {}

  keyDown(key: string, code?: string, modifiers?: KeyModifiers) {
    const event = createMockKeyboardEvent(key, 'keydown', modifiers);
    if (code) {
      Object.defineProperty(event, 'code', { value: code });
    }
    this.doc.dispatchEvent(event);
  }

  keyUp(key: string, code?: string, modifiers?: KeyModifiers) {
    const event = createMockKeyboardEvent(key, 'keyup', modifiers);
    if (code) {
      Object.defineProperty(event, 'code', { value: code });
    }
    this.doc.dispatchEvent(event);
  }

  mouseMove(movementX: number, movementY: number, clientX = 0, clientY = 0) {
    const event = createMockMouseEvent('mousemove', {
      clientX,
      clientY,
      movementX,
      movementY
    });
    this.dispatchToTarget(event);
  }

  mouseButton(button: number, state: 'down' | 'up' = 'down') {
    if (state === 'down') {
      this.mouseDown(button);
    } else {
      this.mouseUp(button);
    }
  }

  mouseDown(button: number = 0) {
    const event = createMockMouseEvent('mousedown', { button });
    this.dispatchToTarget(event);
  }

  mouseUp(button: number = 0) {
    const event = createMockMouseEvent('mouseup', { button });
    this.dispatchToTarget(event);
  }

  mouseWheel(deltaY: number) {
      const event = createMockWheelEvent(0, deltaY);
      this.dispatchToTarget(event);
  }

  // Alias for backward compatibility/ease of use
  wheel(deltaY: number) {
      this.mouseWheel(deltaY);
  }

  private dispatchToTarget(event: Event) {
    const target = this.doc.pointerLockElement || this.doc;
    target.dispatchEvent(event);
  }
}

/**
 * Factory for creating a MockPointerLock instance.
 */
export function createMockPointerLock(element?: HTMLElement): MockPointerLock {
  const mock = new MockPointerLock();
  if (element) {
    mock.request(element);
  }
  return mock;
}

/**
 * Factory for creating an InputInjector.
 */
export function createInputInjector(target?: EventTarget): InputInjector {
  // If target is provided and is a Document, use it.
  // Otherwise default to global document.
  const doc = (target instanceof Document) ? target : document;
  const win = (doc.defaultView) ? doc.defaultView : window;
  return new InputInjector(doc, win);
}
