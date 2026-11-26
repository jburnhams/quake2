import * as React from 'react';
import { useLoad, type Load } from 'strata-react';
import { Library } from './library';
import { demoSource, fetchDemoPak, type DemoSource, type Progress } from './demo';

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

/** Download progress of the demo, for the skeleton to show while the archive arrives. */
const progress = { value: null as Progress | null, listeners: new Set<() => void>() };
const setProgress = (p: Progress | null) => {
  progress.value = p;
  progress.listeners.forEach((l) => l());
};

/** How much of the demo has arrived, or null when nothing is downloading. */
export function useDemoProgress(): Progress | null {
  return React.useSyncExternalStore(
    (l) => {
      progress.listeners.add(l);
      return () => progress.listeners.delete(l);
    },
    () => progress.value,
  );
}

/**
 * Fetches and mounts the demo PAK once, so the explorer opens on something to look at: the
 * committed pak.pak, or on the site baseq2/pak0.pak from the original demo archive (see demo.ts).
 * A failure leaves the library empty and says why; opening a PAK by hand still works.
 */
export function useDemoPak(source: DemoSource = demoSource()): Load<number> {
  const { library } = useLibrary();
  return useLoad({
    queryKey: ['demo-pak', source.url],
    staleTime: Infinity,
    queryFn: async () => {
      if (library.mounted.some((p) => p.name === source.name)) return library.version;
      try {
        library.mount(source.name, await fetchDemoPak(source, setProgress));
      } finally {
        setProgress(null);
      }
      return library.version;
    },
    describeError: (e) => (e instanceof Error ? e.message : 'The demo PAK could not be read.'),
  });
}
