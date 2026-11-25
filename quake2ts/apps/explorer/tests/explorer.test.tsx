import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderRoutes } from 'strata-react/testing';
import { routes } from '../src/routes';
import { demoPak, server } from './setup';

const render = (route = '/') => renderRoutes(routes, { route, toasts: false });

describe('the explorer', () => {
  it('opens on the demo PAK and lists its folders', async () => {
    render();
    const tree = await screen.findByRole('treegrid', { name: 'Files' });
    expect(await within(tree).findByRole('row', { name: /maps/ })).toBeInTheDocument();
    expect(screen.getByText(/pak\.pak/)).toBeInTheDocument();
    expect(screen.getByText('Choose a file in the tree')).toBeInTheDocument();
  });

  it('shows a map from a link: its entities and where the file comes from', async () => {
    const { router } = render('/?file=maps/demo1.bsp');
    expect(await screen.findByText('Outer Base')).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: 'Entities' })).toBeInTheDocument();
    const details = screen.getByRole('complementary', { name: 'demo1.bsp' });
    expect(within(details).getByText('pak.pak')).toBeInTheDocument();
    expect(await within(details).findByText('38')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'e1u1/clip' }));
    expect(router.state.location.search).toContain('file=textures%2Fe1u1%2Fclip.wal');
    expect(await screen.findByRole('img', { name: /textures\/e1u1\/clip\.wal, 32 by 32 pixels/ })).toBeInTheDocument();
    expect(await screen.findByText('Player clip, Monster clip')).toBeInTheDocument();
  });

  it('opens a file chosen in the tree', async () => {
    const { router } = render('/?open=pics%2F');
    const row = await screen.findByRole('row', { name: /colormap\.pcx/ });
    await userEvent.click(row);
    expect(router.state.location.search).toContain('file=pics%2Fcolormap.pcx');
    expect(await screen.findByRole('img', { name: /256 by 320 pixels/ })).toBeInTheDocument();
  });

  it('says why when the demo PAK cannot be fetched, and still offers to open one', async () => {
    server.use(http.get('*/pak.pak', () => new HttpResponse(null, { status: 404, statusText: 'Not Found' })));
    render();
    expect(await screen.findByText(/The demo PAK could not be fetched \(404 Not Found\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open PAK files' })).toBeInTheDocument();
  });

  it('opens a PAK file chosen with the button, and refuses one that is not a PAK', async () => {
    render();
    await screen.findByRole('treegrid', { name: 'Files' });
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    await userEvent.upload(input, new File(['not a pak at all'], 'broken.pak'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/broken\.pak/);
  });

  it('mounts a second PAK above the first, which then wins its files', async () => {
    render('/?file=default.cfg');
    await screen.findByRole('treegrid', { name: 'Files' });
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    await userEvent.upload(input, new File([new Uint8Array(demoPak)], 'mod.pak'));
    expect(await screen.findByText('Opened mod.pak')).toBeInTheDocument();
    expect(screen.getByText(/pak\.pak, mod\.pak/)).toBeInTheDocument();
    const details = screen.getByRole('complementary', { name: 'default.cfg' });
    expect(await within(details).findByText('mod.pak')).toBeInTheDocument();
  });
});
