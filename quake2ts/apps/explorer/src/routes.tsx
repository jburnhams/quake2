import { Outlet, type RouteObject } from 'react-router';
import { StrataToastRegion } from 'strata-react';
import { LibraryProvider } from './library/context';
import { ExplorerScreen } from './screens/ExplorerScreen';
import { IntroScreen } from './screens/IntroScreen';

/** The site's route tree: the intro at /, the explorer at /explore. The library sits above both, so the demo downloads once. Shared by main.tsx and the tests (renderRoutes). */
export const routes: RouteObject[] = [
  {
    element: (
      <LibraryProvider>
        <Outlet />
        <StrataToastRegion />
      </LibraryProvider>
    ),
    children: [
      { path: '/', element: <IntroScreen /> },
      { path: '/explore', element: <ExplorerScreen /> },
    ],
  },
];
