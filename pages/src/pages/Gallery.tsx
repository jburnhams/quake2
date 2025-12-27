import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Copy, ExternalLink, CheckCircle, XCircle } from 'lucide-react';

interface VisualTestStats {
  passed: boolean;
  percentDifferent: number;
  pixelsDifferent: number;
  totalPixels: number;
  threshold: number;
  maxDifferencePercent: number;
}

interface VisualTestInfo {
  testName: string;
  snapshotName: string;
  file: string;
  line: number;
  description: string;
  stats?: VisualTestStats;
}

const Gallery: React.FC = () => {
  const [data, setData] = useState<VisualTestInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  useEffect(() => {
    // With HashRouter, we are always at the root path physically, so relative fetch works.
    fetch('visual-tests.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load visual tests data');
        return res.json();
      })
      .then(setData)
      .catch(err => {
        console.error(err);
        setError('Could not load visual test results. They may not have been generated yet.');
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedFiles(new Set());
    } else {
      const allFiles = new Set(data.map(d => d.file));
      setExpandedFiles(allFiles);
    }
    setAllExpanded(!allExpanded);
  };

  const toggleFile = (file: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(file)) {
      newExpanded.delete(file);
    } else {
      newExpanded.add(file);
    }
    setExpandedFiles(newExpanded);
  };

  if (loading) return <Layout><div className="text-center py-10">Loading visual tests...</div></Layout>;
  if (error) return <Layout><div className="text-center py-10 text-red-500">{error}</div></Layout>;

  // Group by file
  const groupedData: Record<string, VisualTestInfo[]> = {};
  data.forEach(item => {
    if (!groupedData[item.file]) groupedData[item.file] = [];
    groupedData[item.file].push(item);
  });

  const sortedFiles = Object.keys(groupedData).sort();

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white uppercase tracking-wider">Visual Tests Gallery</h2>
        <button
          onClick={toggleAll}
          className="bg-q2-panel hover:bg-zinc-700 text-white px-4 py-2 rounded border border-q2-border transition-colors"
        >
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      <div className="space-y-6">
        {sortedFiles.map(file => {
          const tests = groupedData[file];
          const passedCount = tests.filter(t => t.stats?.passed).length;
          const failedCount = tests.length - passedCount;
          const isExpanded = expandedFiles.has(file);
          const fileName = file.split('/').pop();

          return (
            <div key={file} className="border border-q2-border rounded overflow-hidden">
              <div
                onClick={() => toggleFile(file)}
                className="bg-q2-panel p-4 cursor-pointer flex justify-between items-center hover:bg-zinc-800 transition-colors select-none"
              >
                <div className="flex items-center gap-3 text-lg font-bold">
                  {failedCount > 0 ? (
                    <XCircle className="text-red-500 w-5 h-5" />
                  ) : (
                    <CheckCircle className="text-q2-green w-5 h-5" />
                  )}
                  <span>{fileName}</span>
                </div>
                <div className="text-sm text-gray-400">
                  <span className="text-q2-green">{passedCount} passed</span>,{' '}
                  <span className="text-red-500">{failedCount} failed</span>
                </div>
              </div>

              {isExpanded && (
                <div className="bg-zinc-900 p-6 border-t border-q2-border space-y-8">
                  {tests.map((test, idx) => (
                    <TestCase key={idx} test={test} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-10 text-center">
        <button
            onClick={toggleAll}
            className="bg-q2-panel hover:bg-zinc-700 text-white px-4 py-2 rounded border border-q2-border transition-colors"
          >
            {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
      </div>
    </Layout>
  );
};

const TestCase: React.FC<{ test: VisualTestInfo }> = ({ test }) => {
  const isPass = test.stats?.passed;
  const percentMatch = test.stats ? (100 - test.stats.percentDifferent).toFixed(2) : '0';

  const copyText = `${test.file.split('/').pop()} - ${test.testName}${test.description && test.description !== test.testName ? ' - ' + test.description : ''}`;

  const ghLink = `https://github.com/jburnhams/quake2/blob/main/quake2ts/${test.file}#L${test.line}`;

  return (
    <div className="bg-q2-panel rounded-lg p-5 border border-q2-border">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-2">
        <div>
          <div className="flex items-center gap-2 text-lg font-bold">
            <span className={isPass ? "text-q2-green" : "text-red-500"}>
               {isPass ? '✓' : '✗'}
            </span>
            <span className="text-white">{test.testName}</span>
            {test.stats && (
              <span
                className="bg-zinc-700 text-white text-xs px-2 py-1 rounded ml-2 cursor-help"
                title={`Pixels Different: ${test.stats.pixelsDifferent} / ${test.stats.totalPixels}\nError: ${test.stats.percentDifferent.toFixed(4)}%\nMax Allowed: ${test.stats.maxDifferencePercent}%\nThreshold: ${test.stats.threshold}`}
              >
                Match: {percentMatch}%
              </span>
            )}
          </div>
          {test.description && test.description !== test.testName && (
             <div className="text-gray-400 text-sm mt-1">{test.description}</div>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm">
           <button
             onClick={() => navigator.clipboard.writeText(copyText)}
             className="flex items-center gap-1 bg-transparent border border-q2-border hover:bg-zinc-700 hover:text-white text-gray-400 px-2 py-1 rounded transition-colors"
             title="Copy to clipboard"
           >
             <Copy size={14} /> Copy Name
           </button>
           <a
             href={ghLink}
             target="_blank"
             rel="noopener noreferrer"
             className="flex items-center gap-1 text-gray-400 hover:text-white hover:underline"
           >
             View Code <ExternalLink size={14} />
           </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        <ImageColumn label="Reference" src={`snapshots/baselines/${test.snapshotName}.png`} />
        <ImageColumn label="Actual" src={`snapshots/actual/${test.snapshotName}.png`} />
        <ImageColumn label="Difference" src={`snapshots/diff/${test.snapshotName}.png`} />
      </div>
    </div>
  );
};

const ImageColumn: React.FC<{ label: string; src: string }> = ({ label, src }) => (
  <div className="bg-black p-3 rounded border border-zinc-800">
    <div className="text-xs uppercase text-gray-500 mb-2 font-bold">{label}</div>
    <img
      src={src}
      alt={label}
      className="max-w-full h-auto mx-auto block pixelated"
      style={{ imageRendering: 'pixelated' }}
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
        const parent = target.parentElement;
        if (parent) {
            const div = document.createElement('div');
            div.textContent = 'Missing';
            div.style.padding = '20px';
            div.style.color = '#666';
            parent.appendChild(div);
        }
      }}
    />
  </div>
);

export default Gallery;
