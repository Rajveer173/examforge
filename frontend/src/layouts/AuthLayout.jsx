import { Outlet } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { Brand } from '../components/Brand.jsx';
import { useTheme } from '../lib/theme.js';

/**
 * Two-column auth shell.
 *
 * The left slab is a factual orientation strip, not a marketing slot: someone
 * reaching this screen has already decided to sign in, so it states what the
 * system does and stops. It stays dark in both themes — it is a fixed piece of
 * the identity rather than a themed surface, which is why it draws from the
 * --panel tokens instead of --surface.
 *
 * Depth carries the layout: the slab is inset and rounded so it floats on the
 * mesh canvas, the capability list is three raised tiles rather than three
 * ruled rows, and the form sits on its own L1 card. Nothing here is structured
 * by a hairline.
 */
const CAPABILITIES = [
  ['Authoring', 'Question banks, sectioned papers, per-candidate randomisation.'],
  ['Delivery', 'Timed attempts, autosave, proctoring signals, resume after disconnect.'],
  ['Grading', 'Automatic scoring, manual review queues, certificates.'],
];

export function AuthLayout() {
  const { theme, toggle } = useTheme();

  return (
    <div className="mesh min-h-screen bg-canvas p-0 lg:p-4">
      <div className="grid min-h-screen gap-4 lg:min-h-[calc(100vh-2rem)] lg:grid-cols-[1fr_1.02fr]">
        <aside className="relative hidden overflow-hidden rounded-3xl bg-panel px-10 py-12 shadow-overlay lg:flex lg:flex-col lg:justify-between xl:px-14">
          {/* Two blooms off opposite corners. A single flat slab this large
              reads as a dead area; the second, cooler bloom at the foot is what
              stops the first one from looking like a spotlight. */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(72% 58% at 88% -8%, rgb(var(--panel-accent) / 0.24) 0%, transparent 62%), radial-gradient(58% 46% at 4% 100%, rgb(var(--mesh-c) / 0.13) 0%, transparent 60%)',
            }}
            aria-hidden="true"
          />

          <Brand tone="panel" size="lg" className="relative" />

          <div className="relative max-w-lg">
            <span className="inline-flex items-center rounded-full bg-panel-raised/80 px-3.5 py-1.5 font-mono text-[0.6875rem] uppercase leading-4 tracking-[0.12em] text-panel-accent ring-1 ring-inset ring-panel-ink/15">
              Assessment platform
            </span>
            <h2 className="mt-6 text-display-lg text-panel-ink">
              One system for the whole assessment cycle.
            </h2>

            {/* Numbered like a specification, because that is what it is. */}
            <dl className="mt-10 space-y-3">
              {CAPABILITIES.map(([term, detail], index) => (
                <div
                  key={term}
                  className="grid grid-cols-[2.25rem_1fr] gap-x-4 rounded-2xl border border-panel-ink/10 bg-panel-raised/60 p-5 backdrop-blur-sm"
                >
                  <dt className="font-mono text-[0.6875rem] uppercase leading-6 tracking-[0.1em] text-panel-accent">
                    {String(index + 1).padStart(2, '0')}
                  </dt>
                  <dd className="min-w-0">
                    <p className="text-[0.9375rem] font-semibold leading-6 text-panel-ink">{term}</p>
                    <p className="mt-1 text-sm leading-relaxed text-panel-ink/65">{detail}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="relative max-w-sm text-xs leading-relaxed text-panel-ink/45">
            Accounts are issued by your institution. Contact your administrator if you cannot sign
            in.
          </p>
        </aside>

        <main className="relative flex items-center justify-center px-4 py-14 sm:px-8">
          {/* L3 chrome: the toggle floats over the panel rather than sitting in
              the flow, matching the landing header island. */}
          <button
            type="button"
            onClick={toggle}
            className="glass btn btn-sm absolute right-4 top-4 z-10 w-9 px-0 text-ink-muted hover:text-accent-ink"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <div className="w-full max-w-[26rem]">
            {/* Compact lockup for the mobile layout, where the slab is hidden. */}
            <Brand className="mb-8 lg:hidden" />

            <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-raised sm:p-8">
              <div className="accent-wash pointer-events-none absolute inset-0" aria-hidden="true" />
              <div className="relative animate-fade-up">
                <Outlet />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
