// Every lab that plays something over time plays it like a video (Jonathan, 2026-11-26: "some of
// the labs already have play controls (light, slide) so we should make universal"): one clock
// (useLabClock) and one control row (LabPlayer), built from strata-react's media parts. Transport,
// SeekBar, TimeReadout and RateChoice are made for a player the app owns, so they drive a recorded
// run, a light pattern or a frame-by-frame slide as they would a <video>. The clock is the lab's
// own until strata-react has one (strata-react#384, and #386 for one 3D media viewer):
// requestAnimationFrame while playing, times the speed; a seek pauses, as dragging a seek bar
// does; playing from the end starts again. The speed is in the URL (`speed`), like every other
// setting a person would link; the time is the lab's to keep (a URL frame, or none).
// transportShortcuts is left out: its arrows would fight the 3D view's (strata-react#385); the
// seek bar's own keys step a frame while it has focus.
import * as React from 'react';
import { RateChoice, SeekBar, TimeReadout, Transport, useSearchParam, type Precision, type SeekBarSpan } from 'strata-react';

const RATES = [0.25, 0.5, 1, 2] as const;
const parseRate = (v: string) => (RATES.map(String).includes(v) ? v : undefined);

export interface LabClock {
  /** Seconds since the start. */
  readonly time: number;
  readonly duration: number;
  readonly playing: boolean;
  readonly rate: number;
  readonly setRate: (rate: number) => void;
  /** Play from here (from the start at the end), or pause. */
  readonly toggle: () => void;
  /** Go to a time and pause there. */
  readonly seek: (time: number) => void;
  /** One step of the lab's frame, either way, pausing. */
  readonly step: (frames: number) => void;
}

export interface LabClockOptions {
  /** Seconds. */
  readonly duration: number;
  /** Seconds per frame: what a step moves. */
  readonly frame: number;
  /** Go round at the end instead of stopping (a light pattern). */
  readonly loop?: boolean;
  /** Where it starts, in seconds. Default 0. */
  readonly start?: number;
  /**
   * A time the lab keeps elsewhere (a frame in the URL, so a link opens on it): the clock starts
   * there, follows it when it changes while paused (a link, Back), and writes to it when it stops
   * (pause, seek, the end), never on every frame of playing.
   */
  readonly held?: { readonly time: number; readonly set: (time: number) => void };
}

/** The lab's playhead over `duration` seconds, at the speed in the URL. */
export function useLabClock({ duration, frame, loop = false, start = 0, held }: LabClockOptions): LabClock {
  const [rateRaw, setRateRaw] = useSearchParam<string>('speed', { default: '1', parse: parseRate });
  const rate = Number(rateRaw);
  const [time, setTime] = React.useState(() => clamp(held?.time ?? start, duration));
  const [playing, setPlaying] = React.useState(false);
  const ref = React.useRef({ time, playing, rate });
  ref.current = { time, playing, rate };

  React.useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let id = requestAnimationFrame(function tick(now) {
      const t = ref.current.time + ((now - last) / 1000) * ref.current.rate;
      last = now;
      if (loop) {
        ref.current.time = duration > 0 ? t % duration : 0;
      } else {
        ref.current.time = Math.min(t, duration);
        if (t >= duration) {
          setTime(duration);
          setPlaying(false);
          return;
        }
      }
      setTime(ref.current.time);
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [playing, duration, loop]);

  // A shorter run (a new pattern) keeps the playhead inside it.
  React.useEffect(() => setTime((t) => clamp(t, duration)), [duration]);

  // The held time: followed while paused, written when the clock stops somewhere else.
  const heldTime = held?.time;
  const setHeld = React.useRef(held?.set);
  setHeld.current = held?.set;
  React.useEffect(() => {
    if (heldTime === undefined || ref.current.playing) return;
    ref.current.time = clamp(heldTime, duration);
    setTime(ref.current.time);
  }, [heldTime, duration]);
  React.useEffect(() => {
    if (playing || heldTime === undefined || Math.abs(time - heldTime) < frame / 2) return;
    setHeld.current?.(time);
    // Only when it stops: `time` changes every frame while playing.
  }, [playing, time]);

  const toggle = React.useCallback(() => {
    if (ref.current.playing) return setPlaying(false);
    if (!loop && ref.current.time >= duration) {
      ref.current.time = 0;
      setTime(0);
    }
    setPlaying(true);
  }, [duration, loop]);
  const seek = React.useCallback(
    (to: number) => {
      setPlaying(false);
      ref.current.time = clamp(to, duration);
      setTime(ref.current.time);
    },
    [duration],
  );
  const step = React.useCallback((n: number) => seek(Math.round(ref.current.time / frame + n) * frame), [seek, frame]);
  const setRate = React.useCallback((r: number) => setRateRaw(String(r)), [setRateRaw]);
  return { time, duration, playing, rate, setRate, toggle, seek, step };
}

const clamp = (t: number, duration: number) => Math.min(Math.max(t, 0), duration);

export interface LabPlayerProps {
  readonly clock: LabClock;
  /** Names the seek bar: what is being played ("The run", "The pattern"). */
  readonly label: string;
  /** Seconds per frame, as the clock was given it. */
  readonly frame: number;
  /** Named moments on the bar (the jump); pressing one goes there. */
  readonly marks?: readonly { time: number; label: string }[];
  /** Stretches drawn along the bar (in the air). */
  readonly spans?: readonly SeekBarSpan[];
  /** How the time reads. Default "ms". */
  readonly precision?: Precision;
  readonly className?: string;
}

/** The lab's play controls: play and pause, to either end, a frame either way, the seek bar, the time and the speed. */
export function LabPlayer({ clock, label, frame, marks, spans, precision = 'ms', className }: LabPlayerProps) {
  const fps = 1 / frame;
  return (
    <Transport
      playing={clock.playing}
      onPlayPause={clock.toggle}
      onToStart={() => clock.seek(0)}
      onToEnd={() => clock.seek(clock.duration)}
      onStepBack={() => clock.step(-1)}
      onStepForward={() => clock.step(1)}
      className={className}
    >
      <SeekBar
        label={label}
        time={clock.time}
        duration={clock.duration}
        onSeek={clock.seek}
        step={frame}
        bigStep={Math.max(frame * 10, clock.duration / 10)}
        precision={precision}
        fps={fps}
        marks={marks}
        spans={spans}
        className="min-w-48 grow"
      />
      <TimeReadout time={clock.time} duration={clock.duration} precision={precision} fps={fps} />
      <RateChoice rate={clock.rate} onRateChange={clock.setRate} rates={RATES} />
    </Transport>
  );
}
