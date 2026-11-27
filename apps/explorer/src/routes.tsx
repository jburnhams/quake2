import { Outlet, type RouteObject } from 'react-router';
import { StrataToastRegion } from 'strata-react';
import { LibraryProvider } from './library/context';
import { ExplorerScreen } from './screens/ExplorerScreen';
import { IntroScreen } from './screens/IntroScreen';
import { PlayScreen } from './screens/PlayScreen';
import { LAB_PATH, MovementLab } from './labs/movement/MovementLab';
import { TRACES_PATH, TracesLab } from './labs/traces/TracesLab';
import { LAG_PATH, NetLab } from './labs/net/NetLab';
import { PVS_PATH, PvsLab } from './labs/pvs/PvsLab';
import { SLIDE_PATH, SlideLab } from './labs/slide/SlideLab';
import { LIGHT_PATH, LightLab } from './labs/light/LightLab';
import { EFFECTS_PATH, EffectsLab } from './labs/effects/EffectsLab';
import { SOUND_PATH, SoundLab } from './labs/sound/SoundLab';
import { WATCH_PATH, WatchScreen } from './labs/demo/WatchScreen';

/** The site's route tree: the intro at /, the explorer at /explore, the game at /play, the demo's recording at /watch, the movement lab at /labs/movement. The library sits above them all, so the demo downloads once. Shared by main.tsx and the tests (renderRoutes). */
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
      { path: WATCH_PATH, element: <WatchScreen /> },
      { path: LAB_PATH, element: <MovementLab /> },
      { path: TRACES_PATH, element: <TracesLab /> },
      { path: LAG_PATH, element: <NetLab /> },
      { path: PVS_PATH, element: <PvsLab /> },
      { path: SLIDE_PATH, element: <SlideLab /> },
      { path: LIGHT_PATH, element: <LightLab /> },
      { path: EFFECTS_PATH, element: <EffectsLab /> },
      { path: SOUND_PATH, element: <SoundLab /> },
    ],
  },
];
