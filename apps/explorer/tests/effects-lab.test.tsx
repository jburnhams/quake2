import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoutes } from 'strata-react/testing';
import { routes } from '../src/routes';

// The effects lab: one of the game's effects fired on demo1's floor, through the client's own code.
const render = (route = '/labs/effects') => renderRoutes(routes, { route, toasts: false });

describe('the effects lab', () => {
  it('opens on a rocket going off', async () => {
    render();
    expect(await screen.findByRole('heading', { name: 'Effects lab' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Effect' })).toHaveValue('rocket');
    expect(await screen.findByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('fires another effect, held in the link', async () => {
    const { router } = render();
    await screen.findByRole('heading', { name: 'Effects lab' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Effect' }), 'Railgun shot');
    expect(router.state.location.search).toContain('effect=rail');
    expect(await screen.findByRole('heading', { name: /CL_RailTrail/ })).toBeInTheDocument();
  });

  it('shows id’s effects code beside the port’s', async () => {
    render();
    await screen.findByRole('heading', { name: 'Effects lab' });
    for (const heading of [/CL_ExplosionParticles/, /CL_AddParticles/, /CL_AddExplosions/, /CL_ParseTEnt/]) {
      expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    }
  });
});
