import { Outlet, type RouteObject } from 'react-router';
import { StrataToastRegion } from 'strata-react';
import { LibraryProvider } from './library/context';
import { ExplorerScreen } from './screens/ExplorerScreen';
import { LAB_PATH, MovementLab } from './labs/movement/MovementLab';
import { TRACES_PATH, TracesLab } from './labs/traces/TracesLab';

/** The explorer's route tree, shared by main.tsx and the tests (renderRoutes). */
export const routes: RouteObject[] = [
  {
    element: (
      <LibraryProvider>
        <Outlet />
        <StrataToastRegion />
      </LibraryProvider>
    ),
    children: [
      { path: '/', element: <ExplorerScreen /> },
      { path: LAB_PATH, element: <MovementLab /> },
      { path: TRACES_PATH, element: <TracesLab /> },
    ],
  },
];
