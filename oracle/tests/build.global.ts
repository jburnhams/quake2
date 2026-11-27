/**
 * Builds the C oracles once before the test files start. The files run in parallel, and each
 * calling build.sh on its own rebuilt the binaries under the others' feet.
 */
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

export default function setup() {
  const dir = resolve(__dirname, '..');
  if (!process.env.Q2ORACLE_BIN) {
    execFileSync('sh', [join(dir, 'build.sh')], { stdio: 'pipe' });
    process.env.Q2ORACLE_BIN = join(dir, 'build', 'q2oracle');
  }
  process.env.Q2PMOVE_BIN ??= join(dir, 'build', 'q2pmove');
  process.env.Q2MSG_BIN ??= join(dir, 'build', 'q2msg');
  process.env.Q2MODEL_BIN ??= join(dir, 'build', 'q2model');
  // q2demo is id's whole client and ref_gl, which needs OSMesa. Without it the demo lockstep
  // test skips locally; CI installs libosmesa6-dev, so there a failed build fails the run.
  if (!process.env.Q2DEMO_BIN && !process.env.Q2DEMO_OUT) {
    try {
      execFileSync('sh', [join(dir, 'demo', 'build.sh')], { stdio: 'pipe' });
      process.env.Q2DEMO_BIN = join(dir, 'build', 'q2demo');
    } catch (e) {
      if (process.env.CI) throw e;
      console.warn(`q2demo not built (needs libosmesa6-dev); the demo lockstep test skips:\n${(e as { stderr?: Buffer }).stderr ?? e}`);
    }
  }
}
