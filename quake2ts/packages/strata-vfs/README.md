# strata-vfs

A virtual file system that mounts archives in priority order, plus an LRU cache. No dependencies,
no archive format of its own. General tier of the library split (see [`../../LIBRARIES.md`](../../LIBRARIES.md)).

```ts
import { VirtualFileSystem, type Archive } from 'strata-vfs';

const vfs = new VirtualFileSystem();
vfs.mount(basePak, 0);              // anything that implements Archive
vfs.mount(modPak, 10);              // higher priority wins; at equal priority the later mount wins
await vfs.readFile('maps/demo1.bsp');
vfs.list('maps');                   // { files, directories }
vfs.getDirectoryTree();
```

An `Archive` is `{ name, size, listEntries(), readFile(path) }`; `@quake2ts/formats`' `PakArchive`
implements it, and a ZIP or a fetched folder could too. Paths are matched case-insensitively with
`/` or `\` (`normalizePath`).

| Method | Does |
|---|---|
| `mount(archive, priority?)`, `setPriority` | Mount or re-rank an archive |
| `readFile`, `readTextFile`, `streamFile(path, chunkSize)` | Read the winning copy of a file |
| `hasFile`, `stat`, `getFileMetadata` | Look a file up without reading it |
| `list(dir)`, `getDirectoryTree()`, `findByExtension`, `searchFiles(regex)` | Browse |
| `getPaks()`, `getPakInfo()` | The mounts, lowest priority first |
| `LruCache<T>` | A size-bounded cache for decoded assets |

Some names still say "pak" (`mountPak`, `sourcePak`, `getPaks`) because the engine uses them; they
will become archive names once the explorer is the only caller.
