import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoutes } from 'strata-react/testing';
import { routes } from '../src/routes';

// The light styles lab: one of demo1's lights, played letter by letter.
const render = (route = '/labs/light') => renderRoutes(routes, { route, toasts: false });

describe('the light styles lab', () => {
  it("opens on the flickering room, at the first letter of style 6's pattern", async () => {
    render();
    expect(await screen.findByRole('heading', { name: "demo1's light styles" })).toBeInTheDocument();
    expect(screen.getByText("demo1's flickering room, as the game plays it")).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /The flickering room/ })).toBeChecked();
    expect(screen.getByText('17 letters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play the light' })).toBeInTheDocument();
  });

  it('plays the style as another of the table, held in the link', async () => {
    const { router } = render();
    await screen.findByRole('heading', { name: "demo1's light styles" });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Play it as' }), 'Style 9: slow strobe (fourth variety)');
    expect(router.state.location.search).toContain('as=9');
    expect(await screen.findByText('16 letters')).toBeInTheDocument();
  });

  it('says what is wrong with a typed pattern', async () => {
    render('/labs/light?as=own&pattern=m2');
    expect(await screen.findByText(/Use only the letters a to z/)).toBeInTheDocument();
  });

  it('shows id’s light style code beside the port’s', async () => {
    render('/labs/light?at=strobe');
    await screen.findByRole('heading', { name: "demo1's light styles" });
    for (const heading of [/SP_worldspawn/, /CL_SetLightstyle and CL_RunLightStyles/, /R_BuildLightMap/, /SP_light/]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
  });
});
