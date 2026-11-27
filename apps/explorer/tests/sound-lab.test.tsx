import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoutes } from 'strata-react/testing';
import { routes } from '../src/routes';

// The sound lab: one of the game's sounds played to a listener at demo1's start, through the client's own mixer.
const render = (route = '/labs/sound') => renderRoutes(routes, { route, toasts: false });

describe('the sound lab', () => {
  it('opens on a rocket going round the listener', async () => {
    render();
    expect(await screen.findByRole('heading', { name: 'Sound lab' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Sound' })).toHaveValue('weapons/rockfly.wav');
    expect(screen.getByRole('combobox', { name: 'Path' })).toHaveValue('round');
    expect(await screen.findByRole('button', { name: 'Play' })).toBeInTheDocument();
    // the test's small PAK has none of the sounds (the simulation's tests mix one)
    expect(await screen.findByText('This PAK has no sound/weapons/rockfly.wav')).toBeInTheDocument();
  });

  it('plays another sound, held in the link', async () => {
    const { router } = render();
    await screen.findByRole('heading', { name: 'Sound lab' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sound' }), 'Door');
    expect(router.state.location.search).toContain('sound=doors%2Fdr1_strt.wav');
  });

  it('shows id’s mixer beside the port’s', async () => {
    render();
    await screen.findByRole('heading', { name: 'Sound lab' });
    for (const heading of [/S_SpatializeOrigin/, /S_InitScaletable/, /S_PaintChannelFrom8/, /S_TransferStereo16/]) {
      expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    }
  });
});
