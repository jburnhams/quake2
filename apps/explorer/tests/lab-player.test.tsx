import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoutes } from 'strata-react/testing';
import { routes } from '../src/routes';
import { frameAt } from '../src/labs/movement/at';
import type { MovementFrame } from '../src/labs/movement/simulate';

// The labs' one player (LabPlayer): strata-react's transport over each lab's own clock, so every
// lab with a timeline plays like a video.
const render = (route: string) => renderRoutes(routes, { route, toasts: false });

afterEach(() => vi.useRealTimers());

describe('frameAt', () => {
  const start = { x: 0, y: 0, z: 0 };
  const frames = [1, 2, 3].map((i) => ({ t: i * 0.025, distance: i * 10, origin: { x: i * 10, y: 0, z: 0 } }) as MovementFrame);
  it('is the start before the first frame, between frames, and the last frame at the end', () => {
    expect(frameAt(frames, start, 0).origin.x).toBe(0);
    expect(frameAt(frames, start, 0.0125).origin.x).toBeCloseTo(5);
    expect(frameAt(frames, start, 0.05).origin.x).toBeCloseTo(20);
    expect(frameAt(frames, start, 0.0625).distance).toBeCloseTo(25);
    expect(frameAt(frames, start, 9).origin.x).toBe(30);
  });
});

describe('the movement lab played like a video', () => {
  it('starts at the end, plays from the start, and stops at the end', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    render('/labs/movement');
    const seek = await screen.findByRole('slider', { name: 'The run' }, { timeout: 5000 });
    expect(Number(seek.getAttribute('aria-valuenow') ?? (seek as HTMLInputElement).value)).toBeCloseTo(2.5);
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(1000));
    const mid = Number((seek as HTMLInputElement).value);
    expect(mid).toBeGreaterThan(0.5);
    expect(mid).toBeLessThan(1.5);
    await act(async () => vi.advanceTimersByTime(3000));
    expect(Number((seek as HTMLInputElement).value)).toBeCloseTo(2.5);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('holds the camera and the speed in the link', async () => {
    const { router } = render('/labs/movement?camera=eyes&speed=0.5');
    expect(await screen.findByRole('radio', { name: /Through the player's eyes/ }, { timeout: 5000 })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: /From the side/ }));
    expect(router.state.location.search).toBe('?speed=0.5');
  });
});

describe('the slide lab played like a video', () => {
  it('steps a frame and writes it to the link', async () => {
    const { router } = render('/labs/slide?frame=10');
    expect(await screen.findByRole('heading', { name: 'Every trace frame 10 made, in order' }, { timeout: 5000 })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /forward/i }));
    expect(await screen.findByRole('heading', { name: 'Every trace frame 11 made, in order' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?frame=11');
  });
});
