import { useEffect, useRef, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { useGameEngine, RendererType } from '../game/useGameEngine';

const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendererType, setRendererType] = useState<RendererType>('webgl');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ fps: 0, position: { x: 0, y: 0, z: 0 } });

  const { start, stop, getStats } = useGameEngine({
    canvasRef,
    rendererType,
    onError: setError,
  });

  const handleStart = useCallback(async () => {
    setError(null);
    try {
      await start();
      setIsRunning(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start game');
    }
  }, [start]);

  const handleStop = useCallback(() => {
    stop();
    setIsRunning(false);
  }, [stop]);

  const handleRendererChange = useCallback((type: RendererType) => {
    if (isRunning) {
      handleStop();
    }
    setRendererType(type);
  }, [isRunning, handleStop]);

  // Update stats display
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      const currentStats = getStats();
      if (currentStats) {
        setStats(currentStats);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, getStats]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl text-q2-green mb-4">Play Quake 2 TS</h2>
          <p className="text-sm text-gray-400 mb-4">
            Use WASD to move, Arrow keys to look around
          </p>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm">Renderer:</label>
            <select
              value={rendererType}
              onChange={(e) => handleRendererChange(e.target.value as RendererType)}
              disabled={isRunning}
              className="bg-black border border-q2-green text-q2-green px-2 py-1 text-sm"
            >
              <option value="webgl">WebGL</option>
              <option value="webgpu">WebGPU</option>
            </select>
          </div>

          {!isRunning ? (
            <button
              onClick={handleStart}
              className="bg-q2-green text-black px-4 py-2 font-bold hover:bg-green-400 transition-colors"
            >
              Start Game
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="bg-red-600 text-white px-4 py-2 font-bold hover:bg-red-500 transition-colors"
            >
              Stop Game
            </button>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 text-center">
            {error}
          </div>
        )}

        {/* Stats display */}
        {isRunning && (
          <div className="text-center text-xs text-gray-400 font-mono">
            FPS: {stats.fps.toFixed(0)} |
            Position: ({stats.position.x.toFixed(0)}, {stats.position.y.toFixed(0)}, {stats.position.z.toFixed(0)})
          </div>
        )}

        {/* Game canvas */}
        <div className="flex justify-center">
          <div className="relative border-2 border-q2-green-dim">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="bg-black block"
              tabIndex={0}
              style={{ outline: 'none' }}
            />
            {!isRunning && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <p className="text-q2-green text-lg">Click "Start Game" to begin</p>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="max-w-md mx-auto text-sm text-gray-400">
          <h3 className="text-q2-green mb-2">Controls:</h3>
          <ul className="list-disc list-inside space-y-1">
            <li><kbd className="bg-gray-800 px-1">W</kbd> / <kbd className="bg-gray-800 px-1">S</kbd> - Move forward/backward</li>
            <li><kbd className="bg-gray-800 px-1">A</kbd> / <kbd className="bg-gray-800 px-1">D</kbd> - Strafe left/right</li>
            <li><kbd className="bg-gray-800 px-1">Arrow Keys</kbd> - Look around</li>
            <li><kbd className="bg-gray-800 px-1">Space</kbd> - Jump</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default Game;
