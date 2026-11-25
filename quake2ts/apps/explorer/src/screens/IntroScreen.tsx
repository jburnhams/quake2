// One question: "What is this, and what can I do with it here?" The site's front page, so it is a
// Read surface rather than an Operate screen: what the project is, where it stands today in plain
// words (no feature grid of promises), the places to go next as LinkCards, and how the demo's data
// reaches the browser, since a visitor downloads 39 MB the first time.
import { FolderTree, Gamepad2 } from 'lucide-react';
import { ButtonLink, ColorSchemeChoice, LinkCard, LinkCardList, TextLink } from 'strata-react';

const REPO = 'https://github.com/jburnhams/quake2';

export function IntroScreen() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-3xl items-center gap-3 px-4 pt-4">
        <p className="type-label">quake2ts</p>
        <div className="ms-auto">
          <ColorSchemeChoice compact />
        </div>
      </header>
      <main className="mx-auto grid max-w-3xl gap-8 px-4 py-8">
        <section className="grid gap-3">
          <h1 className="type-title">Quake 2, in TypeScript, in the browser</h1>
          <p className="type-body">
            quake2ts ports id Software's Quake 2 engine and game from C to TypeScript, one piece at a time, and
            checks each piece against the original. The parts come out as libraries you can use on their own: file
            formats, the map's collision, player movement, the game's entities and monsters, and a renderer with
            WebGL and WebGPU back ends.
          </p>
          <p className="type-body">
            Everything here runs on the free Quake 2 demo's first level, <span className="font-mono">demo1</span>.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <ButtonLink to="/play" variant="default" icon={Gamepad2}>
              Play demo1
            </ButtonLink>
            <ButtonLink to="/explore" icon={FolderTree}>
              Explore the demo's files
            </ButtonLink>
          </div>
        </section>

        <section className="grid gap-3" aria-labelledby="where">
          <h2 id="where" className="type-heading">Where it stands</h2>
          <ul className="type-body grid list-disc gap-2 ps-5">
            <li>
              The game runs <span className="font-mono">map demo1</span> end to end: doors, buttons, lifts, monsters
              that see, chase and fight you, and weapons. A browser test walks it from the start to the exit.
            </li>
            <li>Collision is ported line for line and checked against the original C code's own traces.</li>
            <li>The renderer draws demo1 textured and lit in both WebGL and WebGPU, and the two agree to within a fraction of a percent.</li>
            <li>Not there yet: drawing doors, lifts, monsters, items and your weapon as you play, sound, the status bar, sky, and the levels after the first.</li>
          </ul>
        </section>

        <LinkCardList label="Go to">
          <LinkCard
            as="h2"
            to="/play"
            title="Play"
            description="Walk demo1 with the keyboard and mouse: the real game, drawn by the new renderer."
          />
          <LinkCard
            as="h2"
            to="/explore"
            title="Explorer"
            description="Every file in the demo's PAK: pictures, textures, models, sounds and maps, with their facts."
          />
          <LinkCard
            as="h2"
            to="/labs/movement"
            title="Movement lab"
            description="The game's own player movement on demo1, with its constants on sliders."
          />
          <LinkCard
            as="h2"
            to="/labs/traces"
            title="Traces lab"
            description="Sweep a box through demo1 as the game does for every move and shot, and see the face it stops on."
          />
          <LinkCard
            as="h2"
            to="/labs/lag"
            title="Lag lab"
            description="One player through a client, a server and a network: why your keys answer at once when the server is far away."
          />
          <LinkCard
            as="h2"
            to="/labs/pvs"
            title="Visibility lab"
            description="Click anywhere on demo1 to see what the renderer draws from there, and the doors that cut off the rest."
          />
          <LinkCard as="h2" href={REPO} title="Source" description="The code, the plan, and the tests that hold each piece to the original." />
        </LinkCardList>

        <section className="grid gap-3" aria-labelledby="data">
          <h2 id="data" className="type-heading">Where the game's data comes from</h2>
          <p className="type-body">
            The levels, textures and sounds belong to id Software. Their demo licence lets the demo be shared only as
            the original, unmodified archive, so this site serves that archive (
            <span className="font-mono">q2-314-demo-x86.exe</span>, 39&nbsp;MB) and your browser takes the game data
            out of it. It downloads once; later visits read it from your browser's storage. You can also open PAK files
            of your own in the explorer.
          </p>
          <p className="type-body text-muted-foreground">
            The code is GPL-2.0, as id's release of the Quake 2 source is.{' '}
            <TextLink href={`${REPO}/tree/main/quake2ts`}>Read the source</TextLink>.
          </p>
        </section>
      </main>
    </div>
  );
}
