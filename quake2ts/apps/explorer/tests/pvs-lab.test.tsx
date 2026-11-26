import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoutes } from 'strata-react/testing';
import { routes } from '../src/routes';

// The visibility lab: demo1 from above, each floor filled by what the renderer does with it from
// an eye held in the URL, with the eye's cluster and the counts in figures.
const render = (route = '/labs/pvs') => renderRoutes(routes, { route, toasts: false });

describe('the visibility lab', () => {
  it("starts at demo1's player start, in a cluster that sees a small part of the level", async () => {
    render();
    expect(await screen.findByText(/^Of 1,391:/)).toBeInTheDocument();
    expect(screen.getByText("The eye at demo1's player start")).toBeInTheDocument();
    expect(screen.getByText(/Leaf 2,646, area 1\./)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Closed/ })).toBeChecked();
    const plan = document.querySelectorAll('polygon');
    expect(plan.length).toBeGreaterThan(100);
    const fates = new Set([...plan].map((p) => p.getAttribute('data-fate')));
    expect(fates).toEqual(new Set(['here', 'drawn', 'hidden']));
  });

  it('cuts off what lies past the shut door, and draws it when the door opens', async () => {
    const { router } = render('/labs/pvs?x=-1040&y=1632&z=-2&yaw=180');
    expect(await screen.findByText(/in an area the shut door cuts off/)).toBeInTheDocument();
    expect(document.querySelector('polygon[data-fate="door"]')).not.toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: /Open/ }));
    expect(router.state.location.search).toContain('door=open');
    expect(await screen.findByText(/its area portal culls nothing/)).toBeInTheDocument();
    expect(document.querySelector('polygon[data-fate="door"]')).toBeNull();
  });

  it('moves the eye to the floor a click lands on, at eye height', async () => {
    const { router } = render();
    await screen.findByText(/^Of 1,391:/);
    const svg = document.querySelector('figure svg[role="img"]') as SVGSVGElement;
    const [, , w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: w!, height: h!, right: w!, bottom: h!, x: 0, y: 0, toJSON: () => ({}) });
    // The middle of a floor in the eye's own cluster (convex, so its corners' mean is inside it).
    const here = document.querySelector('polygon[data-fate="here"]')!;
    const corners = here.getAttribute('points')!.split(' ').map((p) => p.split(',').map(Number));
    const mid = (i: number) => corners.reduce((sum, c) => sum + c[i]!, 0) / corners.length;
    fireEvent.click(svg, { clientX: mid(0), clientY: mid(1) });
    const params = new URLSearchParams(router.state.location.search);
    expect(params.has('x') && params.has('y')).toBe(true);
    // A floor in the start's cluster, so near the start's own height: the eye is 46 above it.
    expect(Math.abs(Number(params.get('z') ?? 63) - 63)).toBeLessThan(64);
  });

  it('ignores an eye outside the map in a link', async () => {
    render('/labs/pvs?x=99999');
    expect(await screen.findByText("The eye at demo1's player start")).toBeInTheDocument();
  });

  it('shows id’s culling beside the port’s', async () => {
    render();
    await screen.findByText(/^Of 1,391:/);
    for (const heading of [/Mod_PointInLeaf/, /Mod_DecompressVis/, /R_MarkLeaves/, /FloodArea_r/]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText('Faces drawn')).toBeInTheDocument();
  });
});
