/**
 * Where the loaders read files from. strata-vfs's VirtualFileSystem satisfies it, and so does
 * anything else that can return a file's bytes by path (a fetch wrapper, a test map).
 */
export interface FileSource {
  readFile(path: string): Promise<Uint8Array>;
}
