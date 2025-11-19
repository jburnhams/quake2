export interface WebGLContextInitOptions {
  /**
   * Options passed to `canvas.getContext`. Defaults to antialias enabled to match the rerelease renderer's smoothing.
   */
  readonly contextAttributes?: WebGLContextAttributes;
  /**
   * Extensions that must be present. Missing entries throw during construction so callers can fall back early.
   */
  readonly requiredExtensions?: readonly string[];
  /**
   * Extensions that will be queried if available. Missing optional extensions are ignored.
   */
  readonly optionalExtensions?: readonly string[];
}

export interface WebGLContextState {
  readonly gl: WebGL2RenderingContext;
  readonly extensions: Map<string, unknown>;
  /**
   * Returns true once a `webglcontextlost` event has been observed.
   */
  isLost(): boolean;
  /**
   * Registers a callback that fires on context loss. Returns an unsubscribe function.
   */
  onLost(callback: () => void): () => void;
  /**
   * Registers a callback that fires on context restoration. Returns an unsubscribe function.
   */
  onRestored(callback: () => void): () => void;
  /**
   * Remove event listeners and release references.
   */
  dispose(): void;
}

function configureDefaultGLState(gl: WebGL2RenderingContext): void {
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}

function queryExtensions(
  gl: WebGL2RenderingContext,
  required: readonly string[],
  optional: readonly string[],
  collector: Map<string, unknown>
): void {
  for (const name of required) {
    const ext = gl.getExtension(name);
    if (!ext) {
      throw new Error(`Missing required WebGL extension: ${name}`);
    }
    collector.set(name, ext);
  }

  for (const name of optional) {
    const ext = gl.getExtension(name);
    if (ext) {
      collector.set(name, ext);
    }
  }
}

export function createWebGLContext(
  canvas: HTMLCanvasElement,
  options: WebGLContextInitOptions = {}
): WebGLContextState {
  const { contextAttributes, requiredExtensions = [], optionalExtensions = [] } = options;
  const gl = canvas.getContext('webgl2', contextAttributes ?? { antialias: true });
  if (!gl) {
    throw new Error('WebGL2 not supported or failed to initialize');
  }

  configureDefaultGLState(gl);

  const extensions = new Map<string, unknown>();
  queryExtensions(gl, requiredExtensions, optionalExtensions, extensions);

  let lost = false;
  const lostCallbacks = new Set<() => void>();
  const restoreCallbacks = new Set<() => void>();

  const lostListener = (event: Event): void => {
    lost = true;
    event.preventDefault();
    for (const callback of lostCallbacks) {
      callback();
    }
  };
  const restoreListener = (): void => {
    lost = false;
    for (const callback of restoreCallbacks) {
      callback();
    }
  };

  canvas.addEventListener('webglcontextlost', lostListener);
  canvas.addEventListener('webglcontextrestored', restoreListener);

  return {
    gl,
    extensions,
    isLost: () => lost,
    onLost(callback: () => void) {
      lostCallbacks.add(callback);
      return () => lostCallbacks.delete(callback);
    },
    onRestored(callback: () => void) {
      restoreCallbacks.add(callback);
      return () => restoreCallbacks.delete(callback);
    },
    dispose() {
      canvas.removeEventListener('webglcontextlost', lostListener);
      canvas.removeEventListener('webglcontextrestored', restoreListener);
      lostCallbacks.clear();
      restoreCallbacks.clear();
      extensions.clear();
    },
  };
}
