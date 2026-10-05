import React, { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Landing } from './Landing';
import { readTheme, applyTheme } from './theme';
import './styles.css';

const Workspace = lazy(() => import('./App'));
const isWorkspace = () =>
  location.hash === '#workspace' || new URLSearchParams(location.search).has('action');

class WorkspaceBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main>
          <div className="card">
            <h1>The workspace could not open.</h1>
            <p>Please reload to try again. If this continues, check the server connection.</p>
            <button className="button primary" onClick={() => location.reload()}>
              Reload SafeLink
            </button>
          </div>
        </main>
      );
    return this.props.children;
  }
}

function Root() {
  const [workspace, setWorkspace] = useState(isWorkspace);
  const [dark, setDark] = useState(readTheme);
  useEffect(() => {
    const sync = () => {
      setWorkspace(isWorkspace());
      setDark(readTheme());
    };
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);
  useEffect(() => applyTheme(dark), [dark]);
  if (!workspace)
    return (
      <Landing
        dark={dark}
        toggleTheme={() => setDark((value) => !value)}
        enter={() => {
          location.hash = 'workspace';
          setWorkspace(true);
          window.scrollTo(0, 0);
        }}
      />
    );
  return (
    <WorkspaceBoundary>
      <Suspense
        fallback={
          <main>
            <div className="card" role="status">
              <h1>Opening your workspace…</h1>
              <p>Loading the scanner and safety tools.</p>
            </div>
          </main>
        }
      >
        <Workspace />
      </Suspense>
    </WorkspaceBoundary>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
