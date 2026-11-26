# @quake2ts/formats

Readers (and a PAK writer) for Quake 2's file formats. Quake 2 tier of the library split (see
[`../../LIBRARIES.md`](../../LIBRARIES.md)); it builds on `strata-vfs` and `strata-math` only. It also holds
Quake 2's table of 162 normals (`ANORMS`), which MD2 vertices and the network protocol index into;
`@quake2ts/shared` re-exports it.

| Format | Entry | Gives |
|---|---|---|
| PAK | `PakArchive.fromArrayBuffer`, `StreamingPakArchive`, `PakWriter`, `PakValidator` | Directory and file bytes; mounts in `strata-vfs` |
| BSP (v38) | `parseBsp`, `BspLoader` | Every lump, the entity list, PVS, `findLeaf`, `pickEntity` |
| Entity lump | `parseEntLump`, `serializeEntLump` | Key/value entities, back to text |
| MD2, MD3 | `parseMd2`, `parseMd3`, loaders | Frames, skins, triangles; frame blending in `animation` |
| SP2 | `parseSprite` | Frame names and origins |
| PCX, WAL, TGA | `parsePcx` + `pcxToRgba`, `parseWal`, `parseTga` | Indexed or RGBA pixels, mips, surface flags |
| WAV | `parseWav` | Float samples |
| Any | `detectFileType` | The type from the name and magic bytes |

The loaders (`BspLoader`, `Md2Loader`, …) read through a `FileSource` (`readFile(path)`), which a
`VirtualFileSystem` satisfies. `tests/demo-pak.test.ts` runs every parser over the committed
`pak.pak`.

The engine's old paths (`engine/src/assets/pak.ts` and the rest) re-export these, so existing imports
keep working.
