import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Gallery from './pages/Gallery';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/visual-tests"
          element={<Gallery dataSource="visual-tests.json" snapshotBaseUrl="snapshots" title="WebGPU Visual Tests" />}
        />
        <Route
          path="/webgl-visual-tests"
          element={<Gallery dataSource="webgl-visual-tests.json" snapshotBaseUrl="webgl-snapshots" title="WebGL Visual Tests" />}
        />
      </Routes>
    </Router>
  );
}

export default App;
