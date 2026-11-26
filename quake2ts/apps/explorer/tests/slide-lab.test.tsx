import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoutes } from 'strata-react/testing';
import { routes } from '../src/routes';

// The slide and step lab: one second of running from a place in demo1, one frame taken apart.
const render = (route = '/labs/slide') => renderRoutes(routes, { route, toasts: false });

describe('the slide and step lab', () => {
  it('opens on the frame that first meets the wall, with its traces in order', async () => {
    render();
    expect(await screen.findByRole('heading', { name: /Every trace frame \d+ made/ })).toBeInTheDocument();
    expect(screen.getByText("Running at a wall at 45°, with the game's step height")).toBeInTheDocument();
    expect(screen.getAllByText(/the velocity is clipped along it/).length).toBeGreaterThan(0);
    expect(screen.getByRole('radio', { name: /A wall at 45°/ })).toBeChecked();
  });

  it('runs up the stairs, and says a frame stepped', async () => {
    const { router } = render();
    await screen.findByRole('heading', { name: /Every trace frame/ });
    await userEvent.click(screen.getByRole('radio', { name: /A staircase/ }));
    expect(router.state.location.search).toContain('at=stairs');
    expect(await screen.findByText(/Up a step: pmove climbs anything up to 18/)).toBeInTheDocument();
    expect(screen.getAllByText('Step up').length).toBeGreaterThan(0);
  });

  it('reads a frame from a link, and ignores one out of range', async () => {
    render('/labs/slide?frame=40');
    expect(await screen.findByRole('heading', { name: 'Every trace frame 40 made, in order' })).toBeInTheDocument();
  });

  it('shows id’s slide and step code beside the port’s', async () => {
    render('/labs/slide?frame=99');
    await screen.findByRole('heading', { name: /Every trace frame/ });
    for (const heading of [/PM_ClipVelocity/, /PM_StepSlideMove_Generic/, /Stepping: PM_StepSlideMove/]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
  });
});
