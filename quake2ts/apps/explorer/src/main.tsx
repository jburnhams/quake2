import './app.css';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { StrataQueryProvider, ThemeProvider } from 'strata-react';
import { routes } from './routes';

const router = createBrowserRouter(routes, { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' });

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* The Quake look is drawn for the dark first (a lit HUD on gunmetal); light stays one click away. */}
    <ThemeProvider defaultPreference="dark">
      <StrataQueryProvider>
        <RouterProvider router={router} />
      </StrataQueryProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
