import { Outlet, type RouteObject } from 'react-router';
import { StrataToastRegion } from 'strata-react';
import { LibraryProvider } from './library/context';
import { ExplorerScreen } from './screens/ExplorerScreen';

/** The explorer's route tree, shared by main.tsx and the tests (renderRoutes). */
export const routes: RouteObject[] = [
  {
    element: (
      <LibraryProvider>
        <Outlet />
        <StrataToastRegion />
      </LibraryProvider>
    ),
    children: [{ path: '/', element: <ExplorerScreen /> }],
  },
];
