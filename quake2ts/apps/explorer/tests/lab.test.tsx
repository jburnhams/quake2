import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoutes } from 'strata-react/testing';
import { routes } from '../src/routes';

// The movement lab: sliders for the movement constants, held in the URL, and the run on demo1
// redrawn against the game's.
const render = (route = '/labs/movement') => renderRoutes(routes, { route, toasts: false });

describe('the movement lab', () => {
  it("runs demo1 with the game's values", async () => {
    render();
    expect(await screen.findAllByText("The same as the game's.")).toHaveLength(4);
    expect(screen.getByText("Every constant at the game's value")).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Reset' })).not.toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Gravity' })).toHaveValue('800');
  });

  it('reads the constants from a link and says which changed', async () => {
    render('/labs/movement?gravity=400&jump=350');
    expect(await screen.findByText(/2\sconstants changed: gravity, jump speed/)).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Gravity' })).toHaveValue('400');
    expect((await screen.findAllByText(/^The game's run:/)).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Reset' })).toHaveAttribute('href', '/labs/movement');
  });

  it('moves a constant from the keyboard and writes it to the URL', async () => {
    const { router } = render();
    const gravity = await screen.findByRole('slider', { name: 'Gravity' });
    await screen.findAllByText("The same as the game's.");
    gravity.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(router.state.location.search).toBe('?gravity=790');
    expect(await screen.findByText(/1\sconstant changed: gravity/)).toBeInTheDocument();
  });

  it('ignores a value outside a slider\'s limits', async () => {
    render('/labs/movement?gravity=99999');
    expect(await screen.findByRole('slider', { name: 'Gravity' })).toHaveValue('800');
  });
});
