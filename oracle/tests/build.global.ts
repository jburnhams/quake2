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
  process.env.Q2PMOVE321_BIN ??= join(dir, 'build', 'q2pmove321');
  process.env.Q2MSG_BIN ??= join(dir, 'build', 'q2msg');
  process.env.Q2MODEL_BIN ??= join(dir, 'build', 'q2model');
  // q2rgame is id's rerelease game DLL hosted by a small server (oracle/rerelease); it needs
  // libfmt-dev and libjsoncpp-dev. Without them the rerelease lockstep skips locally; CI installs them.
  if (!process.env.Q2RGAME_BIN) {
    try {
      execFileSync('sh', [join(dir, 'rerelease', 'build.sh')], { stdio: 'pipe' });
      process.env.Q2RGAME_BIN = join(dir, 'build', 'q2rgame');
    } catch (e) {
      if (process.env.CI) throw e;
      console.warn(`q2rgame not built (needs libfmt-dev and libjsoncpp-dev); the rerelease lockstep skips:\n${(e as { stderr?: Buffer }).stderr ?? e}`);
    }
  }
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
