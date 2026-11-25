/**
 * Loads the MD2 models a level uses (monsters, items, weapons, the view weapon) and decodes
 * their skins, with no GPU or DOM calls, like prepareWorld. The skins go to the renderer with
 * `uploadTextures`, by the names the models give them, which is how both backends find a
 * model's skin at draw time.
 */
import { parseMd2, type Md2Model } from '../assets/md2.js';
import { parsePcx } from '../assets/pcx.js';
import { preparePcxTexture, type PreparedTexture } from '../assets/texture.js';
import type { FileSource } from './prepareWorld.js';

export interface PreparedModels {
  /** Models by the path the game names them with ("models/monsters/soldier/tris.md2"). */
  readonly models: ReadonlyMap<string, Md2Model>;
  /** Skins by the path the model names them with, ready for `uploadTextures`. */
  readonly textures: ReadonlyMap<string, PreparedTexture>;
  /** Models or skins the file source could not provide or decode. */
  readonly missing: readonly string[];
}

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

/** Loads every `.md2` among `names` (other names, such as "*3" or sprites, are skipped) and its skins. */
export async function prepareModels(files: FileSource, names: Iterable<string>): Promise<PreparedModels> {
  const models = new Map<string, Md2Model>();
  const textures = new Map<string, PreparedTexture>();
  const missing: string[] = [];
  const wanted = [...new Set(names)].filter((name) => name.toLowerCase().endsWith('.md2'));

  await Promise.all(
    wanted.map(async (name) => {
      try {
        models.set(name, parseMd2(toArrayBuffer(await files.readFile(name))));
      } catch {
        missing.push(name);
      }
    })
  );

  const skins = new Set<string>();
  for (const model of models.values()) for (const skin of model.skins) skins.add(skin.name);
  await Promise.all(
    [...skins].map(async (name) => {
      try {
        textures.set(name, preparePcxTexture(parsePcx(toArrayBuffer(await files.readFile(name)))));
      } catch {
        missing.push(name);
      }
    })
  );

  missing.sort();
  return { models, textures, missing };
}
