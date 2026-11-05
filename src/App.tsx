import { lazy, Suspense, useEffect } from 'react';
import { useT } from './content/i18n';
import { Icon } from './components/Icon';
import { Logo } from './components/Logo';
import { useStore } from './state/store';
import type { Mode } from './state/url';
import { ExploreView } from './features/explore/ExploreView';

const CaseFilesView = lazy(() => import('./features/case-files/CaseFilesView'));
const CompareView = lazy(() => import('./features/compare/CompareView'));
const LearnView = lazy(() => import('./features/learn/LearnView'));

const NAV: { mode: Mode; icon: string }[] = [
  { mode: 'explore', icon: 'globe' },
  { mode: 'cases', icon: 'folder' },
  { mode: 'compare', icon: 'compare' },
  { mode: 'learn', icon: 'book' },
];

function TopBar() {
  const t = useT();
  const { mode, setMode, theme, setTheme } = useStore();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_srgb,var(--bg)_85%,transparent)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-3 sm:px-5">
        <a href="#explore" className="flex items-center gap-2" onClick={() => setMode('explore')}>
          <Logo />
          <span className="mono hidden text-[13px] font-semibold tracking-[0.18em] text-ink-1 sm:inline">EARTH TREND DETECTIVE</span>
        </a>
        <nav aria-label="Modes" className="ml-auto flex items-center gap-1 sm:ml-6">
          {NAV.map((n) => (
            <button
              key={n.mode}
              type="button"
              onClick={() => setMode(n.mode)}
              aria-current={mode === n.mode ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[14px] ${mode === n.mode ? 'bg-surface-3 text-ink-1' : 'text-ink-2 hover:text-ink-1'}`}
              data-tour={`nav-${n.mode}`}
            >
              <Icon name={n.icon} size={16} />
              <span className="hidden md:inline">{t.nav[n.mode]}</span>
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="ml-1 rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink-1 sm:ml-auto"
          aria-label={t.nav.themeToggle}
          title={theme === 'dark' ? t.nav.themeLight : t.nav.themeDark}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>
    </header>
  );
}

function Footer() {
  const t = useT();
  return (
    <footer className="border-t border-line px-3 py-6 text-[12px] text-ink-3 sm:px-5">
      <div className="mx-auto max-w-[1600px] space-y-1">
        <p>{t.footer.power}</p>
        <p>{t.footer.gibs}</p>
        <p>{t.footer.disclaimer}</p>
      </div>
    </footer>
  );
}

export default function App() {
  const t = useT();
  const { mode, theme } = useStore();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.title = `${t.app.name} — ${t.nav[mode]}`;
  }, [mode, t]);
  return (
    <div className="flex min-h-full flex-col">
      <a href="#analysis" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-1 focus:text-accent-ink">
        {t.app.skip}
      </a>
      <TopBar />
      <main className="flex-1 pt-4">
        {mode === 'explore' && <ExploreView />}
        <Suspense fallback={<div className="mx-auto max-w-5xl p-6"><div className="skeleton h-64" /></div>}>
          {mode === 'cases' && <CaseFilesView />}
          {mode === 'compare' && <CompareView />}
          {mode === 'learn' && <LearnView />}
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
