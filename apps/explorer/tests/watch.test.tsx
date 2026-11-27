import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoutes } from 'strata-react/testing';
import { routes } from '../src/routes';

// /watch on the committed pak.pak, which has no q2demo1.dm2 and only the 3.00 demo1.dm2: the
// page says which recording is missing, offers the ones there are, and says why 3.00 cannot play.
// The recording itself plays in packages/e2e-tests/watch-demo.test.ts, on the full demo pak.
const render = (route = '/watch') => renderRoutes(routes, { route, toasts: false });

describe('the demo player', () => {
  it('says the 3.14 recording is not open', async () => {
    render();
    expect(await screen.findByText('demos/q2demo1.dm2 is not open')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Through the player's eyes/ })).toBeChecked();
  });

  it('offers the recordings in the open PAKs, and says why a 3.00 one cannot play', async () => {
    const { router } = render();
    const select = await screen.findByRole('combobox', { name: 'Recording' });
    await screen.findByRole('option', { name: 'demos/demo1.dm2' });
    await userEvent.selectOptions(select, 'demos/demo1.dm2');
    expect(router.state.location.search).toBe('?demo=demos%2Fdemo1.dm2');
    expect(await screen.findByText(/demos\/demo1\.dm2 cannot be played: Quake 2 3\.00 demos \(protocol 25\) are not supported/)).toBeInTheDocument();
  });

  it('keeps the camera in the URL', async () => {
    const { router } = render('/watch?camera=behind');
    expect(await screen.findByRole('radio', { name: /Behind the player/ })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: /Through the player's eyes/ }));
    expect(router.state.location.search).toBe('');
  });
});

describe('a recording in the explorer', () => {
  it('links to the player', async () => {
    render('/explore?file=demos%2Fdemo1.dm2');
    expect(await screen.findByRole('link', { name: 'Watch it' })).toHaveAttribute('href', '/watch?demo=demos%2Fdemo1.dm2');
  });
});
