// One question: "Why does my player move the instant I press a key, when the server is 100 ms away?"
// The finding is how far the client is ahead of the server, and what it costs: the client runs its
// own commands through the same movement code at once (prediction) and corrects itself when a
// snapshot disagrees. The lab runs one player on demo1 through a client, a server and a network
// with latency, jitter and loss (simulate.ts, on the port's NetChan and runPmove, arranged as id's
// client and server arrange them). The stage shows a moment in 3D (where the server has the player,
// where the client draws them, and where it would without prediction), the packets around that
// moment, the figures and a chart over the whole run; then id's code beside the port's, and where
// the port's own client and server differ from id's.
import * as React from 'react';
import { ChoiceGroup, Field, LineChart, Metric, MetricStrip, Slider, format, useSearchParam } from 'strata-react';
import type { BspMap } from '@quake2ts/formats/bsp';
import clPred from '../../../../../../full/client/cl_pred.c?raw';
import clEnts from '../../../../../../full/client/cl_ents.c?raw';
import svUser from '../../../../../../full/server/sv_user.c?raw';
import netChanC from '../../../../../../full/qcommon/net_chan.c?raw';
import cgamePrediction from '../../../../../packages/cgame/src/prediction/index.ts?raw';
import serverTs from '../../../../../packages/server/src/dedicated.ts?raw';
import netChanTs from '../../../../../packages/shared/src/net/netchan.ts?raw';
import { AMBER, BLUE, GREY, LabScene, type LineColour, type Lines } from '../LabScene';
import { LabScreen } from '../LabScreen';
import { framePoints, type Vec } from '../orbit';
import { useNumberParams, type NumberParam } from '../params';
import { excerpt } from '../source/excerpt';
import { FurtherReading, ORIGINAL, PORT, SourceCode, SourcePair } from '../source/SourceCode';
import type { LabWorld } from '../world';
import { DEFAULT_NET, NET_RUN_MS, simulateNet, type NetRun, type NetSetup } from './simulate';
import { PacketTimeline } from './PacketTimeline';

export const LAG_PATH = '/labs/lag';

type NetKey = 'latency' | 'jitter' | 'loss' | 'serverMsec' | 'clientMsec' | 'seed';
export const NET_PARAMS: readonly NumberParam<NetKey>[] = [
  { key: 'latency', param: 'latency', label: 'Latency', hint: 'How long a packet takes each way. The round trip is twice this.', min: 0, max: 300, step: 5, unit: 'ms' },
  { key: 'jitter', param: 'jitter', label: 'Jitter', hint: 'Up to this much more delay, at random, per packet. Enough of it and packets arrive out of order.', min: 0, max: 200, step: 5, unit: 'ms' },
  { key: 'loss', param: 'loss', label: 'Packet loss', hint: 'The share of packets lost, each way.', min: 0, max: 50, step: 1, unit: '%' },
  { key: 'serverMsec', param: 'tick', label: 'Server frame', hint: 'How often the server sends a snapshot: every 100 ms (10 Hz) in the 1997 release.', min: 25, max: 200, step: 25, unit: 'ms' },
  { key: 'clientMsec', param: 'cmd', label: 'Client frame', hint: 'How often the client makes a command and sends a packet: its frame time.', min: 10, max: 100, step: 5, unit: 'ms' },
  { key: 'seed', param: 'seed', label: 'Random seed', hint: 'Picks which packets are lost or late; the same seed always gives the same run.', min: 1, max: 99, step: 1 },
];
const NET_DEFAULTS: Record<NetKey, number> = { latency: DEFAULT_NET.latency, jitter: DEFAULT_NET.jitter, loss: 0, serverMsec: DEFAULT_NET.serverMsec, clientMsec: DEFAULT_NET.clientMsec, seed: DEFAULT_NET.seed };

const PUSH_AT = 1000;
const ON_OFF = ['on', 'off'];
const PUSHES = ['none', 'rocket'];
const pick = (allowed: readonly string[]) => (raw: string) => (allowed.includes(raw) ? raw : undefined);

const C_PREDICT = excerpt(clPred, 'void CL_PredictMovement (void)');
const C_CHECK = excerpt(clPred, 'void CL_CheckPredictionError (void)');
const C_VIEW = excerpt(clEnts, 'if ((cl_predict->value) && !(cl.frame.playerstate.pmove.pm_flags & PMF_NO_PREDICTION))', {
  comment: false,
  upTo: '- (ops->pmove.origin[i]*0.125 + ops->viewoffset[i]) );',
});
const C_MOVE = excerpt(svUser, 'case clc_move:', { comment: false, upTo: 'cl->lastcmd = newcmd;' });
const C_TRANSMIT = excerpt(netChanC, 'void Netchan_Transmit (netchan_t *chan, int length, byte *data)');
const TS_PREDICT = excerpt(cgamePrediction, 'export function predictMove(');
const TS_AUTHORITATIVE = excerpt(cgamePrediction, '  setAuthoritative(frame: GameFrameResult<PredictionState>');
const TS_MOVE = excerpt(serverTs, '    private handleMove(client: Client, commands: MoveCommands');
const TS_TRANSMIT = excerpt(netChanTs, '  transmit(unreliableData?: Uint8Array): Uint8Array {');

export function NetLab() {
  const net = useNumberParams(NET_PARAMS, NET_DEFAULTS);
  const [predict, setPredict] = useSearchParam<string>('predict', { default: 'on', parse: pick(ON_OFF) });
  const [push, setPush] = useSearchParam<string>('push', { default: 'none', parse: pick(PUSHES) });
  const v = net.values;
  const setup: NetSetup = { latency: v.latency, jitter: v.jitter, loss: v.loss / 100, serverMsec: v.serverMsec, clientMsec: v.clientMsec, seed: v.seed, pushAt: push === 'rocket' ? PUSH_AT : null };
  return (
    <LabScreen
      title="Lag lab"
      path={LAG_PATH}
      stageName="demo1 over a network"
      params={NET_PARAMS}
      state={net}
      defaults={NET_DEFAULTS}
      defaultWords="The lab starts at"
      unchanged="A 100 ms round trip, nothing lost, prediction on"
      noun="setting"
      extraChanged={[...(predict === 'off' ? ['prediction'] : []), ...(push === 'rocket' ? ['a push'] : [])]}
      extraControls={
        <>
          <ChoiceGroup
            legend="Prediction"
            name="predict"
            value={predict}
            onChange={setPredict}
            choices={[
              { value: 'on', label: 'On', detail: 'cl_predict 1: the client runs its own commands at once.' },
              { value: 'off', label: 'Off', detail: 'cl_predict 0: the client draws what the server last said.' },
            ]}
          />
          <ChoiceGroup
            legend="On the server"
            name="push"
            value={push}
            onChange={setPush}
            choices={[
              { value: 'none', label: 'Nothing happens', detail: 'The server runs only the commands it is sent.' },
              { value: 'rocket', label: 'A rocket pushes the player', detail: 'At 1 s the server knocks the player sideways and up. The client cannot know until a snapshot says so.' },
            ]}
          />
        </>
      }
    >
      {({ map, world }) => <NetView map={map} world={world} setup={setup} predict={predict === 'on'} />}
    </LabScreen>
  );
}

const ms = (n: number) => `${format.integer.format(Math.round(n))} ms`;
const units = (n: number) => `${format.integer.format(Math.round(n))} u`;
const flat = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

function NetView({ map, world, setup, predict }: { map: BspMap; world: LabWorld; setup: NetSetup; predict: boolean }) {
  const key = JSON.stringify(setup);
  const run = React.useMemo(() => simulateNet(world, setup, predict), [world, key, predict]);
  const other = React.useMemo(() => simulateNet(world, setup, !predict), [world, key, predict]);
  const [moment, setMoment] = useSearchParam<string>('at', { default: '1000', parse: (raw) => (Number.isFinite(Number(raw)) && Number(raw) >= 0 && Number(raw) < NET_RUN_MS ? raw : undefined) });
  const at = Number(moment);
  const frame = run.frames.reduce((best, f) => (Math.abs(f.t - at) < Math.abs(best.t - at) ? f : best), run.frames[0]!);

  const home = React.useMemo(() => framePoints(run.frames.map((f) => f.server)), [world]);
  const draw = React.useCallback(
    (lines: Lines) => {
      path(lines, run.frames.map((f) => f.server), GREY);
      path(lines, run.frames.map((f) => f.predicted), AMBER);
      box(lines, frame.server, GREY);
      box(lines, frame.predicted, AMBER);
      if (predict) box(lines, frame.interpolated, BLUE);
    },
    [run, frame, predict],
  );

  const start = world.start.origin;
  const firstMove = (r: NetRun) => r.frames.find((f) => flat(f.predicted, start) > 1)?.t ?? null;
  const mine = firstMove(run);
  const theirs = firstMove(other);
  const lostUp = run.packets.filter((p) => p.from === 'client' && p.arrivesAt === null).length;
  const lostDown = run.packets.filter((p) => p.from === 'server' && p.arrivesAt === null).length;
  const late = run.packets.filter((p) => p.discarded).length;
  const series = (r: NetRun, k: 'predicted' | 'server') => r.frames.map((f) => ({ x: f.t / 1000, y: flat(f[k], start) }));

  return (
    <div className="grid gap-6 p-4">
      <p className="type-body max-w-prose">
        The client sends a command every {ms(setup.clientMsec)}; the server runs each one when it arrives and sends back a snapshot
        every {ms(setup.serverMsec)}. {predict ? 'With prediction the client also runs its commands itself, at once, and draws that.' : 'Without prediction the client draws the player between the last two snapshots, so every key waits for a round trip and a server frame.'}
      </p>

      <Field label="Moment" hint="The time the 3D view and the packet strip show. Click the chart below to move it.">
        <Slider value={at} onChange={(n) => setMoment(String(n))} min={0} max={NET_RUN_MS - setup.clientMsec} step={setup.clientMsec} unit="ms" />
      </Field>

      <LabScene
        label="The player in 3D at this moment"
        shows={`demo1 at ${ms(at)}: where the server has the player in grey, where the client draws them in amber${predict ? ', and where it would without prediction in blue' : ''}.`}
        legend={`Grey: the server's player and path. Amber: what the client draws${predict ? ', predicted' : ', between snapshots'}.${predict ? ' Blue: what it would draw without prediction.' : ''}`}
        map={map}
        model={world.model}
        home={home}
        draw={draw}
      />

      <MetricStrip label="This run">
        <Metric label="A key shows after" value={mine === null ? format.missing : ms(mine)} note={`${predict ? 'Without' : 'With'} prediction: ${theirs === null ? format.missing : ms(theirs)}.`} />
        <Metric label="Ahead of the server" value={units(flat(frame.predicted, frame.server))} note={`At ${ms(at)}. ${frame.unacknowledged} commands not yet acknowledged.`} />
        <Metric label="Largest correction" value={units(run.worstMiss)} note={run.worstMiss > 0.5 ? 'A snapshot disagreed with the guess; the miss slides out over one server frame.' : 'Every snapshot agreed with what the client had predicted.'} />
        <Metric label="Packets lost" value={format.integer.format(lostUp + lostDown)} note={`${lostUp} to the server, ${lostDown} back${late ? `; ${late} thrown away for arriving late` : ''}. Commands the server never ran: ${run.neverRun}.`} />
      </MetricStrip>

      <PacketTimeline packets={run.packets} from={Math.max(0, at - 300)} to={Math.max(0, at - 300) + 600} moment={at} />

      <LineChart
        label="Distance from the start over time: where the client draws the player, and where the server has them"
        series={series(run, 'predicted')}
        seriesLabel={predict ? 'The client, predicting' : 'The client, between snapshots'}
        planned={series(run, 'server')}
        plannedLabel="The server"
        current={at / 1000}
        onPick={(x) => setMoment(String(Math.round((x * 1000) / setup.clientMsec) * setup.clientMsec))}
        formatX={(t) => `${format.decimal.format(t)} s`}
        xLabel="Time"
        formatY={units}
        xTicks={[0, 0.5, 1, 1.5, 2, 2.5]}
        end="none"
        readout
        height={220}
      />

      <SourcePair
        heading="Predicting: CL_PredictMovement"
        note="Every client frame, id's client copies the last snapshot's player into pmove and runs every command the server has not acknowledged through the same Pmove the server runs. The lab does the same with the port's runPmove, and so does the port's own client (cgame), with the server's constants. Until this lab found it, cgame replayed through a simpler move that missed on jumps, steps and slopes."
      >
        <SourceCode title="id's C" file={ORIGINAL('client/cl_pred.c')} excerpt={C_PREDICT} />
        <SourceCode title="The port (cgame)" file={PORT('packages/cgame/src/prediction/index.ts')} excerpt={TS_PREDICT} />
      </SourcePair>
      <SourcePair
        heading="Checking the guess: CL_CheckPredictionError"
        note="When a snapshot arrives, id's client compares it with what it predicted for the command that snapshot acknowledges. A miss under 80 units is kept as prediction_error and slid out (below); a bigger one is a teleport and is taken at once. The port snaps any miss over 10 units and otherwise decays it at its own rate."
      >
        <SourceCode title="id's C" file={ORIGINAL('client/cl_pred.c')} excerpt={C_CHECK} />
        <SourceCode title="The port (cgame)" file={PORT('packages/cgame/src/prediction/index.ts')} excerpt={TS_AUTHORITATIVE} />
      </SourcePair>
      <SourcePair heading="Sliding the miss out: CL_CalcViewValues" note="backlerp runs from 1 to 0 across a server frame, so the error is gone by the next snapshot. Without prediction the view is the last two snapshots blended by the same fraction.">
        <SourceCode title="id's C" file={ORIGINAL('client/cl_ents.c')} excerpt={C_VIEW} />
      </SourcePair>
      <SourcePair
        heading="Running the commands: SV_ExecuteClientMessage"
        note="Each packet carries the newest command and the two before it. When packets were lost (net_drop), id's server runs the older ones first, and repeats the last good command for anything further back, so the player keeps moving through short losses. The port's server does the same; until this lab found it, it kept only the newest command and ran it once per server frame."
      >
        <SourceCode title="id's C" file={ORIGINAL('server/sv_user.c')} excerpt={C_MOVE} />
        <SourceCode title="The port (server)" file={PORT('packages/server/src/dedicated.ts')} excerpt={TS_MOVE} />
      </SourcePair>
      <SourcePair
        heading="The packet header: Netchan_Transmit"
        note="Each packet starts with its sequence number and the last sequence received from the other side: the ack the client predicts from. The lab runs the port's NetChan at both ends. Both send a reliable message once and again only when an ack shows it was lost (until this lab found it, the port's put it in every packet until it was acknowledged). The port adds two things to id's header: a bit for the reliable message's sequence, and fragments for messages too long for one packet."
      >
        <SourceCode title="id's C" file={ORIGINAL('qcommon/net_chan.c')} excerpt={C_TRANSMIT} />
        <SourceCode title="The port" file={PORT('packages/shared/src/net/netchan.ts')} excerpt={TS_TRANSMIT} />
      </SourcePair>

      <FurtherReading
        items={[
          { title: 'Quake engine code review: prediction', href: 'https://mail.fabiensanglard.net/quakeSource/quakeSourcePrediction.php', by: 'Fabien Sanglard', adds: "the same scheme in QuakeWorld, which Quake II's comes from." },
          { title: 'Fast-Paced Multiplayer', href: 'https://www.gabrielgambetta.com/client-server-game-architecture.html', by: 'Gabriel Gambetta', adds: 'prediction, reconciliation and interpolation explained with a live demo.' },
          { title: 'Latency Compensating Methods', href: 'https://developer.valvesoftware.com/wiki/Latency_Compensating_Methods_in_Client/Server_In-game_Protocol_Design_and_Optimization', by: 'Yahn Bernier, Valve, 2001', adds: 'how Half-Life built on this, and lag compensation for shots.' },
          { title: 'Reliable UDP for Games', href: 'https://orangetide.github.io/the-mechanical-researcher/netchan/', by: 'The Mechanical Researcher', adds: "the netchan's header and its one reliable message in flight, beside ENet and QUIC." },
          { title: 'Networked Physics (2004)', href: 'https://gafferongames.com/post/networked_physics_2004', by: 'Glenn Fiedler', adds: 'the input-sending model with prediction, from first principles.' },
          { title: 'Quake 3 Source Code Review: network', href: 'https://mail.fabiensanglard.net/quake3/network.php', by: 'Fabien Sanglard', adds: 'where the design went next: delta snapshots.' },
        ]}
      />
    </div>
  );
}

function path(lines: Lines, points: readonly Vec[], colour: LineColour) {
  for (let i = 1; i < points.length; i++) lines.line(points[i - 1]!, points[i]!, colour);
}

const MINS = { x: -16, y: -16, z: -24 };
const MAXS = { x: 16, y: 16, z: 32 };
function box(lines: Lines, at: Vec, colour: LineColour) {
  lines.box({ x: at.x + MINS.x, y: at.y + MINS.y, z: at.z + MINS.z }, { x: at.x + MAXS.x, y: at.y + MAXS.y, z: at.z + MAXS.z }, colour);
}
