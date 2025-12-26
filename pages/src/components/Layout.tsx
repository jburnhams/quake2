import React from 'react';
import { Link } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="max-w-[900px] mx-auto p-5">
      <header className="text-center py-10 border-b-2 border-q2-green-dim mb-10">
        <h1 className="text-q2-green text-[2.5rem] mb-2.5 uppercase drop-shadow-[0_0_10px_rgba(0,255,0,0.4)]">
          quake2ts<span className="terminal-cursor"></span>
        </h1>
        <p className="text-[1.1rem]">A complete Quake II engine port to TypeScript & WebGL</p>

        <nav className="mt-4 flex justify-center gap-4">
           <Link to="/" className="text-q2-green hover:underline decoration-q2-green hover:drop-shadow-[0_0_5px_rgba(0,255,0,1)]">Home</Link>
           <Link to="/visual-tests" className="text-q2-green hover:underline decoration-q2-green hover:drop-shadow-[0_0_5px_rgba(0,255,0,1)]">Visual Tests</Link>
        </nav>
      </header>

      <main>
        {children}
      </main>

      <footer className="text-center py-10 border-t border-q2-border mt-16 text-[0.9rem] text-[#666]">
        <p>&copy; 2024 quake2ts Project. Quake II is a registered trademark of id Software, LLC.</p>
        <p className="mt-2">
          <a href="https://github.com/jburnhams/quake2" className="text-q2-green hover:underline decoration-q2-green hover:drop-shadow-[0_0_5px_rgba(0,255,0,1)]">
            View on GitHub
          </a>
        </p>
      </footer>
    </div>
  );
};

export default Layout;
