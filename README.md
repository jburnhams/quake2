# quake2

A TypeScript port of Quake II for the browser, the libraries it is split into, and an explorer
that shows how the game and engine work. A pnpm workspace (Node 26, pnpm 12):

- `packages/`: the engine, game, client, server and shared code, and the libraries
  (`strata-*`, `@quake2ts/*`) cut out of them ([`LIBRARIES.md`](LIBRARIES.md)).
- `apps/explorer/`: the explorer and its labs, published on GitHub Pages.
- `oracle/`: differential tests that run the port against id's unmodified C.
- `scripts/`: fetching the demo pak and id's source.
- `docs/`: notes on the port (protocol, demo parsing, plans); [`docs/packages.md`](docs/packages.md)
  is the older overview of the packages and their APIs.

```sh
pnpm install
pnpm run build
pnpm test
```

Until 2026-11-26 all of this sat in a `quake2ts/` folder.

## id Software's source

The original source is not kept in this repository. `scripts/fetch-id-source.sh`
fetches it into `.id-source/` (gitignored), laid out as it used to sit here:

| Folder | What | From |
|---|---|---|
| `full/` | the 1997 GPL source release | [id-Software/Quake-2](https://github.com/id-Software/Quake-2) |
| `rerelease/` | the 2023 rerelease game code (C++) | [id-Software/quake2-rerelease-dll](https://github.com/id-Software/quake2-rerelease-dll) |
| `original/` | the original game code shipped with the rerelease (baseq2, ctf, rogue, xatrix) | the same |
| `fgd/` | the rerelease's FGD and TrenchBroom game config | the same |
| `q2tools/` | the q2tools-220 map compiler, which `bsp-tools` cites | [qbism/q2tools-220](https://github.com/qbism/q2tools-220) |

Each folder is pinned to a commit and checked against its git tree hash in
[`scripts/id-source.pins`](scripts/id-source.pins), so the files are byte for
byte the pinned ones. The oracles' `build.sh` and the explorer's `vite.config.ts` run the script
themselves, and CI caches the result (`.github/actions/id-source`). To read the source locally:

```sh
scripts/fetch-id-source.sh            # all of it
scripts/fetch-id-source.sh full       # just the 1997 release
```

The rerelease's long README on its game API (the old `README.md` here) is upstream, in
[quake2-rerelease-dll](https://github.com/id-Software/quake2-rerelease-dll/blob/8dc1fc9794c01ece06881e703851b768fb3994de/README.md).

Until 2026-11-26 these folders sat at the repository root; commit `3dada0f` is the last that has
them, and the script falls back to it if an upstream repository goes away.

## Licence

GPL-2.0, as id's source is ([`LICENSE.txt`](LICENSE.txt)). The full Quake II demo data the tests
and the site use is fetched from id's original archive (`scripts/fetch-paks.sh`).
