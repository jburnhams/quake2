import * as React from 'react';
import { useLoad, type Load } from 'strata-react';
import { Library } from './library';

const LibraryContext = React.createContext<Library | null>(null);

/** Holds the open PAK files for everything below it. Tests pass their own `library`. */
export function LibraryProvider({ library, children }: { library?: Library; children: React.ReactNode }) {
  const [own] = React.useState(() => library ?? new Library());
  return <LibraryContext.Provider value={own}>{children}</LibraryContext.Provider>;
}

/** The library and its version, which changes (and re-renders the caller) whenever a PAK is mounted. */
export function useLibrary(): { library: Library; version: number } {
  const library = React.useContext(LibraryContext);
  if (!library) throw new Error('useLibrary needs a LibraryProvider above it');
  const version = React.useSyncExternalStore(library.subscribe, () => library.version);
  return { library, version };
}

/** Where the demo PAK is served from: the committed quake2ts/pak.pak, linked into public/. */
export const DEMO_PAK_URL = `${import.meta.env.BASE_URL}pak.pak`;

/**
 * Fetches and mounts the demo PAK once, so the explorer opens on something to look at. A failure
 * leaves the library empty and says why; opening a PAK by hand still works.
 */
export function useDemoPak(): Load<number> {
  const { library } = useLibrary();
  return useLoad({
    queryKey: ['demo-pak', DEMO_PAK_URL],
    staleTime: Infinity,
    queryFn: async () => {
      if (library.mounted.some((p) => p.name === 'pak.pak')) return library.version;
      const response = await fetch(new URL(DEMO_PAK_URL, document.baseURI));
      if (!response.ok) throw new Error(`The demo PAK could not be fetched (${response.status} ${response.statusText}).`);
      library.mount('pak.pak', await response.arrayBuffer());
      return library.version;
    },
    describeError: (e) => (e instanceof Error ? e.message : 'The demo PAK could not be read.'),
  });
}
