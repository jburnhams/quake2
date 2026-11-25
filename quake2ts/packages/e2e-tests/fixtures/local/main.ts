/**
 * Single player in the browser with no network: LocalHost runs `map <name>` and the game,
 * and window.q2test lets a Playwright test drive the player and read where it is.
 * This page is the start of the demo1 walkthrough gate; rendering comes later.
 */
import { PakArchive } from '@quake2ts/engine';
import { LocalHost } from '@quake2ts/server';
import type { UserCommand, Vec3 } from '@quake2ts/shared';

interface PlayerView {
  origin: Vec3;
  velocity: Vec3;
  angles: Vec3;
  mins: Vec3;
  maxs: Vec3;
  index: number;
}

const status = document.getElementById('status')!;
const params = new URLSearchParams(location.search);
const pakUrl = params.get('pak');

const view = (host: LocalHost): PlayerView | null => {
  const p = host.player;
  return p ? { origin: { ...p.origin }, velocity: { ...p.velocity }, angles: { ...p.angles }, mins: { ...p.mins }, maxs: { ...p.maxs }, index: p.index } : null;
};

async function start() {
  if (!pakUrl) throw new Error('No ?pak= given');
  const res = await fetch(pakUrl);
  if (!res.ok) throw new Error(`Fetching ${pakUrl}: ${res.status}`);
  const pak = PakArchive.fromArrayBuffer('pak0.pak', await res.arrayBuffer());
  const warnings: string[] = [];
  const host = new LocalHost({
    readFile: (path) => (pak.getEntry(path) ? pak.readFile(path) : undefined),
    onWarning: (m) => warnings.push(m),
  });

  (window as any).q2test = {
    warnings,
    command: (line: string) => {
      host.command(line);
      const map = host.map;
      return { name: map.name, spawned: map.spawned, entities: map.game.entities.activeCount };
    },
    run: (seconds: number, cmd?: Partial<UserCommand>) => {
      host.run(seconds, cmd);
      return view(host);
    },
    player: () => view(host),
    find: (classname: string) => host.map.game.entities.findByClassname(classname).map((e) => ({ origin: { ...e.origin }, index: e.index })),
  };
  status.textContent = 'ready';
  (window as any).q2ready = true;
}

start().catch((err) => {
  status.textContent = `error: ${err?.stack ?? err}`;
  (window as any).q2error = String(err?.stack ?? err);
});
