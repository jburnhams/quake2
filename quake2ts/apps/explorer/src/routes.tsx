import { Outlet, type RouteObject } from 'react-router';
import { StrataToastRegion } from 'strata-react';
import { LibraryProvider } from './library/context';
import { ExplorerScreen } from './screens/ExplorerScreen';
import { IntroScreen } from './screens/IntroScreen';
import { PlayScreen } from './screens/PlayScreen';
import { LAB_PATH, MovementLab } from './labs/movement/MovementLab';
import { TRACES_PATH, TracesLab } from './labs/traces/TracesLab';

/** The site's route tree: the intro at /, the explorer at /explore, the game at /play, the movement lab at /labs/movement. The library sits above them all, so the demo downloads once. Shared by main.tsx and the tests (renderRoutes). */
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
      { path: '/play', element: <PlayScreen /> },
      { path: LAB_PATH, element: <MovementLab /> },
      { path: TRACES_PATH, element: <TracesLab /> },
    ],
  },
];
