// The open PAKs as one folder tree, the way the game sees them: a file in a later PAK hides the same
// path in an earlier one, and the tree shows only the winner. Strata's Tree, fed from strata-vfs's
// listing, which is synchronous, so every branch is ready as soon as it opens. Folder keys end in a
// slash so they never collide with a file's path; the open folders live in the URL (`open=`).
import * as React from 'react';
import { Tree, format, useExpanded, type Load } from 'strata-react';
import { useLibrary } from '../library/context';

export type FileNode = { key: string; path: string; name: string; branch: boolean; size?: number };

function listing(dir: string, list: (dir: string) => { files: { path: string; size: number }[]; directories: string[] }): FileNode[] {
  const { files, directories } = list(dir);
  const prefix = dir ? `${dir}/` : '';
  return [
    ...directories.map((name) => ({ key: `${prefix}${name}/`, path: `${prefix}${name}`, name, branch: true })),
    ...files.map((f) => ({ key: f.path, path: f.path, name: f.path.slice(prefix.length), branch: false, size: f.size })),
  ];
}

const ready = <T,>(data: T): Load<T> => ({ status: 'ready', data });

/** The folders above a file, as tree keys ("maps/", "maps/sub/"), so a linked file opens on view. */
export function ancestorKeys(path: string): string[] {
  const parts = path.split('/').slice(0, -1);
  return parts.map((_, i) => `${parts.slice(0, i + 1).join('/')}/`);
}

export function FileTree({ selected, onSelect }: { selected: string | null; onSelect: (path: string) => void }) {
  const { library, version } = useLibrary();
  const expanded = useExpanded({ param: 'open' });
  const list = React.useCallback((dir: string) => library.vfs.list(dir), [library, version]);
  const roots = React.useMemo(() => ready(listing('', list)), [list]);
  const reveal = React.useMemo(() => (selected ? [...ancestorKeys(selected), selected] : undefined), [selected]);

  return (
    <Tree<FileNode>
      label="Files"
      roots={roots}
      useChildren={(node) => React.useMemo(() => ready(listing(node.path, list)), [node.path, list])}
      nodeKey={(n) => n.key}
      nodeLabel={(n) => n.name}
      isBranch={(n) => n.branch}
      expanded={expanded}
      reveal={reveal}
      emptyRow="No files"
      selected={selected}
      onSelect={(_, node) => {
        if (!node.branch) onSelect(node.path);
        else expanded.setOpen(node.key, !expanded.isOpen(node.key));
      }}
      count={(n) => (n.branch ? null : format.bytes(n.size ?? 0))}
      coverNoun={['file', 'files']}
      height="100%"
    />
  );
}
