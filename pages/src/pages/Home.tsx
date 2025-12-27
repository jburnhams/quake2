import React from 'react';
import Layout from '../components/Layout';
import { Link } from 'react-router-dom';

const FeatureCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-black/30 p-4 border border-q2-border">
    <h3 className="text-q2-green mt-0 mb-2 font-bold">{title}</h3>
    <p className="text-[1.1rem] m-0">{children}</p>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-q2-panel p-6 mb-8 border border-q2-border shadow-lg shadow-black/30">
    <h2 className="text-q2-header border-l-[5px] border-q2-green-dim pl-4 mt-0 mb-6 uppercase tracking-wider text-xl font-bold">
      {title}
    </h2>
    {children}
  </div>
);

const Home: React.FC = () => {
  return (
    <Layout>
      <div className="text-center mb-8">
          <Link to="/visual-tests" className="inline-block mt-2 px-4 py-2 bg-transparent border border-q2-green text-q2-green uppercase text-[0.9rem] transition-all hover:bg-q2-green-dim hover:text-black hover:shadow-[0_0_10px_rgba(0,255,0,0.4)]">
            View Visual Tests Gallery
          </Link>
      </div>

      <Section title="Overview">
        <p className="mb-4 text-[1.1rem]">
          <strong>quake2ts</strong> is a modern library designed to run Quake II directly in web browsers.
          It is not just a renderer, but a complete game engine port including authoritative server logic,
          client-side prediction, physics, and asset management.
        </p>
        <p className="text-[1.1rem]">
          Designed for web applications that need a robust FPS engine, it separates the
          core engine logic from the UI, allowing developers to build custom interfaces
          around the classic id Tech 2 gameplay.
        </p>
      </Section>

      <Section title="Capabilities">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-5 mt-5">
          <FeatureCard title="WebGL 2 Rendering">
            Full 3D rendering pipeline supporting BSP maps, MD2/MD3 models, dynamic lighting, and particles.
          </FeatureCard>
          <FeatureCard title="Deterministic Physics">
            40Hz fixed timestep simulation ensuring identical behavior across clients and server.
          </FeatureCard>
          <FeatureCard title="Client Prediction">
            Lag-free movement using shared physics code (pmove) to predict outcomes locally.
          </FeatureCard>
          <FeatureCard title="Asset Agnostic">
            Loads assets dynamically from user-provided PAK files via a Virtual File System.
          </FeatureCard>
          <FeatureCard title="Multiplayer Ready">
            Architecture supports dedicated servers and WebSocket-based networking.
          </FeatureCard>
          <FeatureCard title="Demo System">
            Full record and playback of game sessions with timeline controls.
          </FeatureCard>
        </div>
      </Section>

      <Section title="Status & Progress">
        <p className="mb-4 text-[1.1rem]">The project is currently in active development, structured into 7 phases.</p>

        <h3 className="text-q2-green mt-6 mb-2 font-bold text-lg">Roadmap</h3>
        <ul className="list-disc pl-6 space-y-2 text-[1.1rem]">
          <li><strong>Phase 1: Basic Asset Viewing</strong> - PAK Browser & Map Viewer APIs.</li>
          <li><strong>Phase 2: Interactive Visualization</strong> - Entity inspection and tools.</li>
          <li><strong>Phase 3: Demo Playback</strong> - Analysis and timeline tools.</li>
          <li><strong>Phase 4: Single Player</strong> - Game loops, HUD, and Save/Load.</li>
          <li><strong>Phase 5: Multiplayer</strong> - Client/Server networking.</li>
          <li><strong>Phase 6: Advanced Features</strong> - Modding & Rendering enhancements.</li>
          <li><strong>Phase 7: Polish</strong> - Testing & Documentation.</li>
        </ul>

        <div className="mt-5 italic text-gray-400">
          <p>Current Focus: Building core library infrastructure and asset management.</p>
        </div>
      </Section>

      <Section title="Usage">
        <p className="mb-4 text-[1.1rem]">quake2ts is distributed as a set of NPM packages in a monorepo.</p>

        <h3 className="text-q2-green mt-6 mb-2 font-bold text-lg">Installation</h3>
        <pre className="bg-black text-q2-green p-3 rounded text-sm overflow-x-auto border border-q2-border">
          <code>npm install @quake2ts/engine @quake2ts/game @quake2ts/client</code>
        </pre>

        <h3 className="text-q2-green mt-6 mb-2 font-bold text-lg">Basic Example</h3>
        <pre className="bg-black text-q2-green p-3 rounded text-sm overflow-x-auto border border-q2-border">
          <code>{`import { createGame, createClient } from '@quake2ts/game';

// Initialize the system
const game = createGame(imports, engine, options);
const client = createClient(imports);

// Start the loop
game.init();
client.Init();`}</code>
        </pre>

        <p className="mt-4 text-[1.1rem]">
          See the <a href="https://github.com/jburnhams/quake2" className="text-q2-green hover:underline hover:drop-shadow-[0_0_5px_rgba(0,255,0,1)]">GitHub Repository</a> for full documentation.
        </p>
      </Section>
    </Layout>
  );
};

export default Home;
