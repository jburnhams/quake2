// The frame every lab shares: a Workspace with the lab's name and what is changed across the top,
// its sliders (and any other controls) in a collapsible pane on the left (with Reset, a link to the
// lab's bare route, once anything differs from the defaults), and the stage on the right. The stage waits for the lab
// map (useLabMap) and says how to open one when no PAK has it.
import * as React from 'react';
import {
  ButtonLink,
  ColorSchemeChoice,
  DataView,
  EmptyState,
  Field,
  Pane,
  Skeleton,
  Slider,
  Split,
  TextLink,
  Workspace,
  format,
  useWorkspaceState,
} from 'strata-react';
import { RotateCcw } from 'lucide-react';
import type { BspMap } from '@quake2ts/formats/bsp';
import type { NumberParam, NumberParams } from './params';
import { LAB_MAP, useLabMap, type LabWorld } from './world';

export interface LabScreenProps<K extends string> {
  /** The lab's name: "Movement lab". */
  title: string;
  /** Its route, which Reset links to. */
  path: string;
  /** The stage pane's name: "Run on demo1". */
  stageName: string;
  /** The sliders, their values and their defaults. */
  params: readonly NumberParam<K>[];
  state: NumberParams<K>;
  defaults: Readonly<Record<K, number>>;
  /** How a default is said in a slider's hint: "The game uses". */
  defaultWords: string;
  /** The top line when nothing is changed: "Every constant at the game's value". */
  unchanged: string;
  /** What one slider is called in the changed count: "constant". */
  noun: string;
  /** More controls under the sliders (a choice that is not a number). */
  extraControls?: React.ReactNode;
  /** The names of those controls that differ from their defaults, for the top line and Reset. */
  extraChanged?: readonly string[];
  children: (lab: { map: BspMap; world: LabWorld }) => React.ReactNode;
}

export function LabScreen<K extends string>(props: LabScreenProps<K>) {
  const { title, path, stageName, params, state, defaults, defaultWords, unchanged, noun, extraControls, extraChanged = [], children } = props;
  const changed = [...state.changed.map((c) => c.label.toLowerCase()), ...extraChanged];
  const workspace = useWorkspaceState(path);
  const lab = useLabMap();
  // A degree sign sits on its number; other units are a non-breaking space apart.
  const say = (p: NumberParam<K>, n: number) => `${format.decimal.format(n)}${p.unit ? `${p.unit === '°' ? '' : ' '}${p.unit}` : ''}`;

  return (
    <div className="h-dvh">
      <Workspace label={title} state={workspace} narrowBelow={720}>
        <header className="hud-bar flex min-h-(--control-h) shrink-0 flex-wrap items-center gap-3 border-b border-border px-3 py-1">
          <h1 className="type-label">{title}</h1>
          <p className="type-body-sm text-muted-foreground" aria-live="polite">
            {changed.length ? `${format.count(changed.length, noun)} changed: ${changed.join(', ')}` : unchanged}
          </p>
          <div className="ms-auto flex items-center gap-2">
            <TextLink to="/explore">Explorer</TextLink>
            <ColorSchemeChoice compact />
          </div>
        </header>
        <Split direction="row">
          <Pane
            id="controls"
            name="Controls"
            size={320}
            min={260}
            max={480}
            collapsible
            actions={
              changed.length ? (
                <ButtonLink to={path} size="sm" variant="ghost" icon={RotateCcw}>
                  Reset
                </ButtonLink>
              ) : null
            }
          >
            <div className="grid gap-4 p-3">
              {params.map((p) => (
                <Field key={p.key} label={p.label} hint={`${p.hint} ${defaultWords} ${say(p, defaults[p.key])}.`}>
                  <Slider value={state.values[p.key]} onChange={(v) => state.set(p.key, v)} min={p.min} max={p.max} step={p.step} unit={p.unit} />
                </Field>
              ))}
              {extraControls}
            </div>
          </Pane>
          <Pane id="stage" name={stageName} grow>
            <DataView
              state={lab}
              skeleton={<StageSkeleton />}
              isEmpty={(w) => w === null}
              empty={
                <EmptyState title="demo1 is not open">
                  The lab runs on {LAB_MAP}, from the demo PAK. Open a PAK that has it in the <TextLink to="/explore">explorer</TextLink>.
                </EmptyState>
              }
            >
              {(w) => children(w!)}
            </DataView>
          </Pane>
        </Split>
      </Workspace>
    </div>
  );
}

function StageSkeleton() {
  return (
    <div className="grid gap-4 p-4" aria-hidden>
      <Skeleton className="aspect-video w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
