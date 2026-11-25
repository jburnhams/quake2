// One question: "What is in these PAK files?" The finding is the open files and their size; the
// screen is a workspace (a tool the person sizes to the job) with the tree on the left, the chosen
// file in the middle and its facts on the right. The chosen file is in the URL (`?file=`), so a
// file can be linked and survives a reload; the open folders are too (`?open=`).
import * as React from 'react';
import {
  Alert,
  Button,
  ButtonLink,
  ColorSchemeChoice,
  DataView,
  EmptyState,
  FileButton,
  LoadError,
  Pane,
  Split,
  Skeleton,
  Workspace,
  format,
  toast,
  useSearchParam,
  useWorkspaceState,
} from 'strata-react';
import { FolderOpen } from 'lucide-react';
import { useDemoPak, useLibrary } from '../library/context';
import { DemoProgress } from '../library/DemoProgress';
import { FileTree } from '../files/FileTree';
import { FileDetails } from '../files/FileDetails';
import { NoFileChosen, Preview } from '../preview/Preview';

export function ExplorerScreen() {
  const workspace = useWorkspaceState('explorer');
  const demo = useDemoPak();
  const { library, version } = useLibrary();
  const [file, setFile] = useSearchParam<string>('file', { default: '' });
  const path = file && library.vfs.hasFile(file) ? file : null;

  const [refused, setRefused] = React.useState<string[]>([]);
  const openPaks = async (files: File[]) => {
    const failed: string[] = [];
    for (const f of files) {
      try {
        const pak = library.mount(f.name, await f.arrayBuffer());
        toast.show({ title: `Opened ${pak.name}`, description: `${format.count(pak.files, 'file')}, above the PAKs already open.`, tone: 'success' });
      } catch (e) {
        failed.push(`${f.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setRefused(failed);
  };

  const summary = library.mounted.length
    ? `${library.mounted.map((p) => p.name).join(', ')} · ${format.bytes(library.mounted.reduce((n, p) => n + p.bytes, 0))}`
    : 'No PAK open';

  return (
    <div className="h-dvh">
      <Workspace label="Quake 2 explorer" state={workspace} narrowBelow={720}>
        <header className="flex min-h-(--control-h) shrink-0 flex-wrap items-center gap-3 border-b border-border px-3 py-1">
          <h1 className="type-label">Quake 2 explorer</h1>
          <p className="type-body-sm text-muted-foreground" aria-live="polite" data-version={version}>
            {summary}
          </p>
          <div className="ms-auto flex items-center gap-2">
            <ButtonLink to="/" size="sm" variant="ghost">
              About quake2ts
            </ButtonLink>
            <FileButton accept={['.pak']} multiple onFiles={openPaks} icon={FolderOpen} size="sm" variant="default">
              Open PAK files
            </FileButton>
            <ColorSchemeChoice compact />
          </div>
        </header>
        {refused.length ? (
          <Alert
            tone="warning"
            title="Not a PAK file the explorer can read"
            announce
            className="m-2"
            action={<Button size="sm" variant="ghost" onPress={() => setRefused([])}>Dismiss</Button>}
          >
            {refused.join('; ')}
          </Alert>
        ) : null}
        <Split direction="row">
          <Pane id="files" name="Files" size={300} min={200} max={520} collapsible>
            <DataView
              state={demo}
              skeleton={<TreeSkeleton />}
              isEmpty={() => library.mounted.length === 0}
              empty={<EmptyState title="No PAK open">Open a PAK file with Open PAK files.</EmptyState>}
              error={(failure) =>
                library.mounted.length ? (
                  <FileTree selected={path} onSelect={setFile} />
                ) : (
                  <div className="grid gap-2 p-3">
                    <LoadError {...failure} />
                    <p className="type-body-sm text-muted-foreground">Open a PAK file of your own with Open PAK files.</p>
                  </div>
                )
              }
            >
              {() => <FileTree selected={path} onSelect={setFile} />}
            </DataView>
          </Pane>
          <Pane id="preview" name={path ?? 'Preview'} grow>
            {path ? <Preview key={`${version}:${path}`} path={path} /> : <NoFileChosen />}
          </Pane>
          <Pane id="details" name="Details" size={300} min={220} max={480} collapsible>
            <FileDetails path={path} />
          </Pane>
        </Split>
      </Workspace>
    </div>
  );
}

function TreeSkeleton() {
  return (
    <div className="grid gap-2 p-3">
      <DemoProgress />
      <div className="grid gap-2" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-40" />
        ))}
      </div>
    </div>
  );
}
