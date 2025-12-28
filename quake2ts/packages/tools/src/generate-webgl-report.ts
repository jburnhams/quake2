import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface VisualTestStats {
    passed: boolean;
    percentDifferent: number;
    pixelsDifferent: number;
    totalPixels: number;
    threshold: number;
    maxDifferencePercent: number;
    frameCount?: number;
}

interface VisualTestInfo {
  testName: string;
  snapshotName: string;
  file: string;
  line: number;
  description: string;
  stats?: VisualTestStats;
}

function findVisualTests(rootDir: string): VisualTestInfo[] {
  const tests: VisualTestInfo[] = [];

  function processFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        if (node.expression.text === 'test' || node.expression.text === 'it') {
          const testNameArg = node.arguments[0];
          if (ts.isStringLiteral(testNameArg)) {
            const testName = testNameArg.text;
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

            let testFn = node.arguments[1];
            // Handle 3-argument version: test(name, options, fn)
            if (node.arguments.length >= 3 && ts.isObjectLiteralExpression(node.arguments[1])) {
              testFn = node.arguments[2];
            }

            if (testFn && (ts.isArrowFunction(testFn) || ts.isFunctionExpression(testFn))) {
               findSnapshotCalls(testFn.body, testName, filePath, line);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    }

    function findSnapshotCalls(node: ts.Node, testName: string, filePath: string, line: number) {
        if (ts.isCallExpression(node)) {
            // Check for snapshot('name') call
            if (ts.isIdentifier(node.expression) && node.expression.text === 'snapshot') {
                 const nameArg = node.arguments[0];
                 if (nameArg && ts.isStringLiteral(nameArg)) {
                     const snapshotName = nameArg.text;
                     tests.push({
                        testName,
                        snapshotName,
                        file: path.relative(rootDir, filePath),
                        line,
                        description: testName,
                        stats: loadStats(filePath, snapshotName)
                     });
                 }
            }

            // Check for testWebGLRenderer helper
            if (ts.isIdentifier(node.expression) && (node.expression.text === 'testWebGLRenderer' || node.expression.text === 'testWebGLAnimation')) {
                 const optionsArg = node.arguments[1];
                 if (optionsArg && ts.isObjectLiteralExpression(optionsArg)) {
                     const nameProp = optionsArg.properties.find(p =>
                        p.name && ts.isIdentifier(p.name) && p.name.text === 'name'
                     );
                     let snapshotName = '';
                     let description = testName;

                     if (nameProp && ts.isPropertyAssignment(nameProp) && ts.isStringLiteral(nameProp.initializer)) {
                          snapshotName = nameProp.initializer.text;
                     }

                     const descProp = optionsArg.properties.find(p => p.name && ts.isIdentifier(p.name) && p.name.text === 'description');
                     if (descProp && ts.isPropertyAssignment(descProp) && ts.isStringLiteral(descProp.initializer)) {
                          description = descProp.initializer.text;
                     }

                     if (snapshotName) {
                          tests.push({
                             testName,
                             snapshotName,
                             file: path.relative(rootDir, filePath),
                             line,
                             description,
                             stats: loadStats(filePath, snapshotName)
                         });
                     }
                 }
            }

            // Keep support for expectSnapshot helpers if used
             if (ts.isIdentifier(node.expression) && (node.expression.text === 'expectSnapshot' || node.expression.text === 'expectAnimationSnapshot')) {
                 const optionsArg = node.arguments[1];
                 if (optionsArg && ts.isObjectLiteralExpression(optionsArg)) {
                     const nameProp = optionsArg.properties.find(p =>
                        p.name && ts.isIdentifier(p.name) && p.name.text === 'name'
                     );
                     let snapshotName = '';
                     let description = testName;

                     if (nameProp && ts.isPropertyAssignment(nameProp) && ts.isStringLiteral(nameProp.initializer)) {
                          snapshotName = nameProp.initializer.text;
                     }

                     const descProp = optionsArg.properties.find(p => p.name && ts.isIdentifier(p.name) && p.name.text === 'description');
                     if (descProp && ts.isPropertyAssignment(descProp) && ts.isStringLiteral(descProp.initializer)) {
                          description = descProp.initializer.text;
                     }

                     if (snapshotName) {
                          tests.push({
                             testName,
                             snapshotName,
                             file: path.relative(rootDir, filePath),
                             line,
                             description,
                             stats: loadStats(filePath, snapshotName)
                         });
                     }
                 } else if (optionsArg && ts.isStringLiteral(optionsArg)) {
                     const snapshotName = optionsArg.text;
                     tests.push({
                        testName,
                        snapshotName,
                        file: path.relative(rootDir, filePath),
                        line,
                        description: testName,
                        stats: loadStats(filePath, snapshotName)
                    });
                 }
             }
        }
        ts.forEachChild(node, (child) => findSnapshotCalls(child, testName, filePath, line));
    }

    function loadStats(testFilePath: string, snapshotName: string): VisualTestStats | undefined {
      // Tests are configured to save to packages/engine/tests/webgl/__snapshots__
      // But checking relative to test file as well just in case
      let statsPath = path.join(rootDir, 'packages/engine/tests/webgl/__snapshots__', 'stats', `${snapshotName}.json`);
      if (!fs.existsSync(statsPath)) {
          const testDir = path.dirname(testFilePath);
          statsPath = path.join(testDir, '__snapshots__', 'stats', `${snapshotName}.json`);
      }

      if (fs.existsSync(statsPath)) {
          try {
              const data = fs.readFileSync(statsPath, 'utf-8');
              return JSON.parse(data) as VisualTestStats;
          } catch (e) {
              console.warn(`Failed to read stats for ${snapshotName}:`, e);
          }
      }
      return undefined;
  }

  function walkDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (file.endsWith('.test.ts')) {
        processFile(fullPath);
      }
    }
  }

  walkDir(path.join(rootDir, 'packages/engine/tests/webgl/visual'));
  return tests;
}

const rootDir = path.resolve(__dirname, '../../../');
const tests = findVisualTests(rootDir);
console.log(JSON.stringify(tests, null, 2));

const outputPath = path.join(process.cwd(), 'webgl-visual-tests.json');
fs.writeFileSync(outputPath, JSON.stringify(tests, null, 2));
