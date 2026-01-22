import { useRef, useCallback, useEffect } from 'react';
import { RefObject } from 'react';

export type RendererType = 'webgl' | 'webgpu';

export interface GameEngineOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  rendererType: RendererType;
  onError: (error: string) => void;
}

export interface GameStats {
  fps: number;
  position: { x: number; y: number; z: number };
}

export interface GameEngineResult {
  start: () => Promise<void>;
  stop: () => void;
  isInitialized: boolean;
  getStats: () => GameStats | null;
}

// Dynamic imports to avoid SSR issues and allow tree-shaking
let engineModule: typeof import('./engine') | null = null;

async function loadEngine() {
  if (!engineModule) {
    engineModule = await import('./engine');
  }
  return engineModule;
}

export function useGameEngine(options: GameEngineOptions): GameEngineResult {
  const { canvasRef, rendererType, onError } = options;
  const engineRef = useRef<Awaited<ReturnType<typeof loadEngine>>['GameEngine'] | null>(null);
  const instanceRef = useRef<InstanceType<NonNullable<typeof engineRef.current>> | null>(null);
  const isInitializedRef = useRef(false);

  const start = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      onError('Canvas not found');
      return;
    }

    try {
      const engine = await loadEngine();
      engineRef.current = engine.GameEngine;

      instanceRef.current = new engine.GameEngine(canvas, rendererType);
      await instanceRef.current.init();
      instanceRef.current.start();
      isInitializedRef.current = true;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      onError(message);
      throw e;
    }
  }, [canvasRef, rendererType, onError]);

  const stop = useCallback(() => {
    if (instanceRef.current) {
      instanceRef.current.stop();
      instanceRef.current.dispose();
      instanceRef.current = null;
    }
    isInitializedRef.current = false;
  }, []);

  const getStats = useCallback((): GameStats | null => {
    if (!instanceRef.current) return null;
    return instanceRef.current.getStats();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (instanceRef.current) {
        instanceRef.current.stop();
        instanceRef.current.dispose();
      }
    };
  }, []);

  return {
    start,
    stop,
    isInitialized: isInitializedRef.current,
    getStats,
  };
}
