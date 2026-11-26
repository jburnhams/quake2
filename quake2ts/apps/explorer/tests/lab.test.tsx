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

describe("the movement lab's air view", () => {
  it('takes one frame of the air move apart, with the code beside it', async () => {
    render('/labs/movement?view=air');
    expect(await screen.findByRole('heading', { name: 'The frame in PM_Accelerate' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Air strafing' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('slider', { name: 'Angle to the wish direction' })).toHaveValue('45');
    expect(screen.getAllByRole('link', { name: /rerelease\/p_move\.cpp, lines \d+–\d+/ }).length).toBe(3);
    expect(screen.getAllByRole('link', { name: /packages\/shared\/src\/pmove\/frame\.ts, lines/ }).length).toBe(3);
    // PM_Accelerate and PM_AirAccelerate both take the dot product.
    expect(screen.getAllByText(/currentspeed = pml\.velocity\.dot\(wishdir\);/, { selector: 'code' })).toHaveLength(2);
  });

  it('sets the constants as QuakeWorld ships them from its preset', async () => {
    render('/labs/movement?view=air');
    const preset = await screen.findByRole('link', { name: 'QuakeWorld' });
    expect(preset).toHaveAttribute('href', '/labs/movement?view=air&maxspeed=320&friction=4&airaccel=10');
    await userEvent.click(preset);
    expect(await screen.findByRole('heading', { name: 'The frame in PM_AirAccelerate' })).toBeInTheDocument();
    expect(screen.getByText('wishspd (capped)')).toBeInTheDocument();
    expect(screen.getByText(/3\sconstants changed: top speed, air acceleration, friction/)).toBeInTheDocument();
  });

  it('turns the wish direction from the keyboard and writes it to the URL', async () => {
    const { router } = render('/labs/movement?view=air');
    const angle = await screen.findByRole('slider', { name: 'Angle to the wish direction' });
    angle.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(router.state.location.search).toBe('?view=air&angle=46');
  });
});

describe("the air view's diagram", () => {
  for (const angle of [0, 90, 135, 180]) {
    it(`keeps every line inside the drawing at ${angle}°`, async () => {
      render(`/labs/movement?view=air&angle=${angle}&speed=1000`);
      const svg = await screen.findByRole('img', { name: /From above/ });
      const [, , w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number);
      for (const line of svg.querySelectorAll('line')) {
        for (const [a, limit] of [['x1', w], ['x2', w], ['y1', h], ['y2', h]] as const) {
          const n = Number(line.getAttribute(a));
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThanOrEqual(limit!);
        }
      }
    });
  }
});
