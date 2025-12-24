import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface VisualTestInfo {
  testName: string;
  snapshotName: string;
  file: string;
  line: number;
  description: string;
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
        if (node.expression.text === 'test') {
          // Found a test('name', ...) call
          const testNameArg = node.arguments[0];
          if (ts.isStringLiteral(testNameArg)) {
            const testName = testNameArg.text;
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

            // Look for snapshot calls inside the test body
            const testFn = node.arguments[1];
            if (testFn && (ts.isArrowFunction(testFn) || ts.isFunctionExpression(testFn))) {
               findSnapshotCalls(testFn.body, testName, filePath, line);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    }

    function findSnapshotCalls(node: ts.Node, testName: string, filePath: string, line: number) {
        // We are looking for renderAndExpectSnapshot(..., 'snapshot-name') OR expectSnapshot(..., { name: 'snapshot-name' })

        if (ts.isCallExpression(node)) {
            // Check for renderAndExpectSnapshot
            if (ts.isIdentifier(node.expression) && node.expression.text === 'renderAndExpectSnapshot') {
                 // Arg 1 is usually the name string
                 const nameArg = node.arguments[1];
                 if (nameArg && ts.isStringLiteral(nameArg)) {
                     tests.push({
                         testName,
                         snapshotName: nameArg.text,
                         file: path.relative(rootDir, filePath),
                         line,
                         description: testName
                     });
                 }
            }
             // Check for object property destructuring alias usage, e.g. test('...', async ({ renderAndExpectSnapshot }) => ...
             // The above visitor is generic, but usually the test function is async ({ renderAndExpectSnapshot }) => { await renderAndExpectSnapshot(...) }
             // In the visual-testing.ts helper, renderAndExpectSnapshot is passed as an argument.

             // Also check for expectSnapshot(pixels, { name: 'foo' }) or expectSnapshot(pixels, 'foo') (if overloaded, but our signature is object)
             if (ts.isIdentifier(node.expression) && node.expression.text === 'expectSnapshot') {
                 // Arg 1 is options object usually
                 const optionsArg = node.arguments[1];
                 if (optionsArg && ts.isObjectLiteralExpression(optionsArg)) {
                     const nameProp = optionsArg.properties.find(p =>
                        p.name && ts.isIdentifier(p.name) && p.name.text === 'name'
                     );

                     if (nameProp && ts.isPropertyAssignment(nameProp) && ts.isStringLiteral(nameProp.initializer)) {
                          tests.push({
                             testName,
                             snapshotName: nameProp.initializer.text,
                             file: path.relative(rootDir, filePath),
                             line,
                             description: testName
                         });
                     }
                 }
             }
        }

        ts.forEachChild(node, (child) => findSnapshotCalls(child, testName, filePath, line));
    }

    visit(sourceFile);
  }

  function walkDir(dir: string) {
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

  walkDir(path.join(rootDir, 'packages/engine/tests/webgpu/visual'));
  return tests;
}

const rootDir = path.resolve(__dirname, '../../../'); // quake2ts root
const tests = findVisualTests(rootDir);
console.log(JSON.stringify(tests, null, 2));

const outputPath = path.join(process.cwd(), 'visual-tests.json');
fs.writeFileSync(outputPath, JSON.stringify(tests, null, 2));
