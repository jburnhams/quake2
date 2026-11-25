import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoutes } from 'strata-react/testing';
import { routes } from '../src/routes';

// The lag lab: one player through a client, a server and a network, with id's code beside the port's.
const render = (route = '/labs/lag') => renderRoutes(routes, { route, toasts: false });

describe('the lag lab', () => {
  it('runs the player with prediction on and says when a key shows', async () => {
    render();
    expect(await screen.findByText('A 100 ms round trip, nothing lost, prediction on')).toBeInTheDocument();
    expect(await screen.findByText(/Without prediction: \d+\sms\./)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^On/ })).toBeChecked();
    expect(screen.getByRole('slider', { name: 'Latency' })).toHaveValue('50');
    expect(screen.getByText('Every snapshot agreed with what the client had predicted.')).toBeInTheDocument();
  });

  it('shows id’s client and server code beside the port’s', async () => {
    render();
    expect(await screen.findByRole('heading', { name: 'Predicting: CL_PredictMovement' })).toBeInTheDocument();
    for (const file of ['full/client/cl_pred.c', 'full/client/cl_ents.c', 'full/server/sv_user.c', 'full/qcommon/net_chan.c']) {
      expect(screen.getAllByRole('link', { name: new RegExp(`^${file.replace(/\./g, '\\.')}, lines`) }).length).toBeGreaterThan(0);
    }
  });

  it('reads a lossy link with a push from the URL and corrects the miss', async () => {
    render('/labs/lag?loss=10&push=rocket&predict=off');
    expect(await screen.findByText(/3\ssettings changed: packet loss, prediction, a push/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Off/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /A rocket pushes the player/ })).toBeChecked();
    expect(await screen.findByText(/With prediction: \d+\sms\./)).toBeInTheDocument();
    expect(screen.getByText(/A snapshot disagreed with the guess/)).toBeInTheDocument();
  });
});
