// The packets around one moment: the client's lane on top, the server's below, time across. Each
// client packet is a line down to the server at the time it arrives, labelled with its sequence
// number; each snapshot is a line up to the client, labelled with the sequence it acknowledges. A
// lost packet stops halfway with a cross; one thrown away for coming after a later one ends in a
// ring. Drawn in SVG with the theme's roles, so it follows light and dark.
import * as React from 'react';
import { format } from 'strata-react';
import type { Packet } from './simulate';

const W = 720;
const H = 184;
const TOP = 34;
const BOTTOM = H - 50;
const LEFT = 64;
const RIGHT = W - 12;

export function PacketTimeline({ packets, from, to, moment }: { packets: readonly Packet[]; from: number; to: number; moment: number }) {
  const id = React.useId();
  const x = (t: number) => LEFT + ((t - from) / (to - from)) * (RIGHT - LEFT);
  const shown = packets.filter((p) => (p.arrivesAt ?? p.sentAt + 1) >= from && p.sentAt <= to);
  const ticks: number[] = [];
  for (let t = Math.ceil(from / 100) * 100; t <= to; t += 100) ticks.push(t);
  const lost = shown.filter((p) => p.arrivesAt === null).length;
  return (
    <figure className="grid gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-surface border border-border bg-card" role="img" aria-labelledby={`${id}-cap`}>
        <defs>
          <clipPath id={`${id}-clip`}>
            <rect x={LEFT} y={0} width={RIGHT - LEFT} height={H} />
          </clipPath>
        </defs>
        <text x={8} y={TOP + 4} className="text-foreground type-caption" fill="currentColor">
          Client
        </text>
        <text x={8} y={BOTTOM + 4} className="text-foreground type-caption" fill="currentColor">
          Server
        </text>
        <line x1={LEFT} x2={RIGHT} y1={TOP} y2={TOP} className="text-border" stroke="currentColor" />
        <line x1={LEFT} x2={RIGHT} y1={BOTTOM} y2={BOTTOM} className="text-border" stroke="currentColor" />
        {ticks.map((t) => (
          <g key={t} className="text-muted-foreground">
            <line x1={x(t)} x2={x(t)} y1={BOTTOM} y2={BOTTOM + 4} stroke="currentColor" />
            <text x={x(t)} y={H - 8} className="type-caption" fill="currentColor" textAnchor="middle">
              {format.integer.format(t)} ms
            </text>
          </g>
        ))}
        <g clipPath={`url(#${id}-clip)`}>
          {shown.map((p) => {
            const up = p.from === 'client';
            const y0 = up ? TOP : BOTTOM;
            const y1 = up ? BOTTOM : TOP;
            const tone = up ? 'text-primary' : 'text-info';
            const end = p.arrivesAt ?? p.sentAt + (to - from) / 12;
            const yEnd = p.arrivesAt === null ? (y0 + y1) / 2 : y1;
            return (
              <g key={`${p.from}-${p.sequence}`} className={tone}>
                <line x1={x(p.sentAt)} y1={y0} x2={x(end)} y2={yEnd} stroke="currentColor" strokeWidth={1.5} opacity={p.discarded ? 0.45 : 1} />
                {p.arrivesAt === null ? <Cross cx={x(end)} cy={yEnd} /> : null}
                {p.discarded ? <circle cx={x(end)} cy={yEnd} r={4} fill="none" stroke="currentColor" strokeWidth={1.5} /> : null}
                <text x={x(p.sentAt) + 2} y={up ? y0 - 6 : y0 + 14} className="type-caption" fill="currentColor" fontSize={10}>
                  {up ? p.sequence : `ack ${p.ack}`}
                </text>
              </g>
            );
          })}
          <line x1={x(moment)} x2={x(moment)} y1={8} y2={BOTTOM + 4} className="text-foreground" stroke="currentColor" strokeDasharray="3 3" />
        </g>
      </svg>
      <figcaption id={`${id}-cap`} className="type-caption text-muted-foreground">
        Packets from {format.integer.format(from)} to {format.integer.format(to)} ms. Amber: the client's, each with its sequence number and the
        commands in it. Blue: the server's snapshots, each with the client sequence it acknowledges. A cross is a lost packet
        {lost ? ` (${lost} here)` : ''}; a ring is one the receiver threw away because a later one had already come. The dashed line is
        the moment the 3D view shows.
      </figcaption>
    </figure>
  );
}

function Cross({ cx, cy }: { cx: number; cy: number }) {
  const r = 4;
  return (
    <g stroke="currentColor" strokeWidth={2}>
      <line x1={cx - r} y1={cy - r} x2={cx + r} y2={cy + r} />
      <line x1={cx - r} y1={cy + r} x2={cx + r} y2={cy - r} />
    </g>
  );
}
