import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoutes } from 'strata-react/testing';
import { routes } from '../src/routes';

// The traces lab: a box swept from demo1's player start, aimed by sliders held in the URL, with
// what it met said in figures.
const render = (route = '/labs/traces') => renderRoutes(routes, { route, toasts: false });

describe('the traces lab', () => {
  it("sweeps a player's box straight ahead and says it met a wall", async () => {
    render();
    expect(await screen.findByText(/Too steep to stand on/)).toBeInTheDocument();
    expect(screen.getByText("A player's box swept straight ahead from the start")).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Length' })).toHaveValue('512');
    expect(screen.getByRole('radio', { name: /Walls/ })).toBeChecked();
    expect(screen.queryByRole('link', { name: 'Reset' })).not.toBeInTheDocument();
  });

  it('reads the aim and the mask from a link', async () => {
    render('/labs/traces?pitch=89&mask=shot');
    expect(await screen.findByText(/Ground: pmove stands on a face/)).toBeInTheDocument();
    expect(screen.getByText(/2\ssettings changed: pitch, what stops it/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /A shot/ })).toBeChecked();
    expect(screen.getByRole('link', { name: 'Reset' })).toHaveAttribute('href', '/labs/traces');
  });

  it('changes what stops it and writes it to the URL', async () => {
    const { router } = render();
    await screen.findByText(/Too steep to stand on/);
    await userEvent.click(screen.getByRole('radio', { name: /Liquid/ }));
    expect(router.state.location.search).toBe('?mask=water');
    expect(await screen.findByText('Nothing in the way.')).toBeInTheDocument();
    expect(screen.getByText('No face was met.')).toBeInTheDocument();
  });

  it('ignores a mask it does not know', async () => {
    render('/labs/traces?mask=everything');
    expect(await screen.findByRole('radio', { name: /Walls/ })).toBeChecked();
  });
});
