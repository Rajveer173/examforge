import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  Command,
  LogOut,
  Monitor,
  Moon,
  Rows3,
  Search,
  Settings,
  Sun,
  Tags,
  User,
} from 'lucide-react';
import { api } from '../api/client.js';
import { Brand } from '../components/Brand.jsx';
import { CommandPalette, useCommandPalette } from '../components/CommandPalette.jsx';
import { Dock } from '../components/Dock.jsx';
import { Avatar, Badge, cx } from '../components/ui.jsx';
import { navForRole, ROLE_LABEL } from '../config/navigation.js';
import { useClickOutside, useEscapeKey, usePageVisible, usePersistentState } from '../lib/hooks.js';
import { useDensity, useTheme } from '../lib/theme.js';
import { useAuthStore } from '../store/authStore.js';

/**
 * The application shell.
 *
 * There is no sidebar at any breakpoint. Chrome floats above a full-bleed
 * canvas as two L3 glass islands — a slim context island at the top and the
 * dock at the bottom — so every pixel of horizontal space belongs to the page.
 * See `Dock.jsx` for how the sidebar's two levels survive the move.
 */

const POLL_INTERVAL_MS = 60_000;
const CONTENT_ID = 'main-content';

function useUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0);
  const visible = usePageVisible();

  const refresh = useCallback(async (signal) => {
    try {
      const { data } = await api.get('/notifications/unread-count', { signal });
      setUnreadCount(data.data.unreadCount ?? 0);
    } catch {
      // A failed count must never surface as a page-level error.
    }
  }, []);

  useEffect(() => {
    // Polling a hidden tab burns requests for a badge nobody can see, so the
    // interval is torn down entirely rather than skipped inside the callback.
    if (!visible) return undefined;
    const controller = new AbortController();
    refresh(controller.signal);
    const id = setInterval(() => refresh(controller.signal), POLL_INTERVAL_MS);
    return () => {
      clearInterval(id);
      controller.abort();
    };
  }, [visible, refresh]);

  return unreadCount;
}

function SegmentedControl({ value, onChange, options, ariaLabel }) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid grid-cols-2 gap-0.5 rounded-full border border-line bg-surface-sunken p-0.5"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cx(
              'flex items-center justify-center gap-1.5 rounded-full px-2 py-1.5 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.08em] transition-colors',
              selected
                ? 'bg-surface text-ink shadow-card'
                : 'text-ink-subtle hover:text-ink-muted',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Account menu. Rendered twice — once in the top island (pointer range) and
 * once in the dock (thumb range) — so the shell's two islands are each
 * self-sufficient. Theme and density are passed in rather than read from
 * `useTheme`/`useDensity` here: two independent copies of those hooks would
 * both write to storage but keep separate state, and the second menu would
 * show a stale selection.
 */
function UserMenu({ user, onSignOut, theme, setTheme, density, setDensity, showLabels, setShowLabels, placement = 'bottom', variant = 'island' }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useClickOutside(containerRef, open, () => setOpen(false));
  useEscapeKey(open, () => {
    setOpen(false);
    triggerRef.current?.focus();
  });

  // The prefix match picks up `menuitemcheckbox` alongside plain `menuitem`,
  // so the dock-labels toggle stays in the same roving cycle as the links.
  const MENU_ITEMS = '[role^="menuitem"]';

  const focusItem = (index) => {
    const items = menuRef.current?.querySelectorAll(MENU_ITEMS);
    if (!items?.length) return;
    const next = (index + items.length) % items.length;
    items[next].focus();
  };

  // Roving focus: the menu owns arrow keys so a pointer-free user can walk the
  // list without Tab escaping into the page behind the dropdown.
  const onMenuKeyDown = (event) => {
    const items = Array.from(menuRef.current?.querySelectorAll(MENU_ITEMS) ?? []);
    const index = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(index + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusItem(items.length - 1);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (open) requestAnimationFrame(() => focusItem(0));
  }, [open]);

  const name = user?.fullName || user?.username || 'Account';
  const dock = variant === 'dock';

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={dock ? `Account: ${name}` : undefined}
        className={cx(
          'flex items-center rounded-full transition-[background-color,color,transform] duration-150 hover:-translate-y-0.5',
          dock
            ? 'h-10 w-10 justify-center hover:bg-accent-soft lg:h-11 lg:w-11'
            : 'gap-2 py-1 pl-1 pr-2 hover:bg-accent-soft',
        )}
      >
        <Avatar name={name} size="sm" />
        {!dock && (
          <>
            <span className="hidden max-w-[9rem] truncate text-[0.8125rem] font-semibold text-ink lg:block">
              {name}
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-ink-subtle lg:block" aria-hidden="true" />
          </>
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKeyDown}
          className={cx(
            'absolute right-0 z-50 w-[17rem] overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-overlay',
            placement === 'top'
              ? 'animate-pop-up bottom-full mb-3 origin-bottom-right'
              : 'animate-scale-in top-full mt-2.5 origin-top-right',
          )}
        >
          <div className="accent-wash flex items-start gap-3 border-b border-line px-4 py-3.5">
            <Avatar name={name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8125rem] font-semibold text-ink">{name}</p>
              <p className="truncate text-xs text-ink-subtle">{user?.email}</p>
              <p className="mt-1.5">
                <Badge tone="accent">{ROLE_LABEL[user?.role] ?? 'Member'}</Badge>
              </p>
            </div>
          </div>

          <div className="p-1.5">
            <Link
              to="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[0.8125rem] font-medium text-ink-muted transition-colors hover:bg-accent-soft hover:text-accent-ink"
            >
              <User className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
              Profile
            </Link>
            <Link
              to="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[0.8125rem] font-medium text-ink-muted transition-colors hover:bg-accent-soft hover:text-accent-ink"
            >
              <Settings className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
              Settings
            </Link>
          </div>

          <div className="border-t border-line p-2.5">
            <p className="eyebrow mb-1.5 px-1">Appearance</p>
            <SegmentedControl
              value={theme}
              onChange={setTheme}
              ariaLabel="Theme"
              options={[
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
              ]}
            />
            <p className="eyebrow mb-1.5 mt-2.5 px-1">Density</p>
            <SegmentedControl
              value={density}
              onChange={setDensity}
              ariaLabel="Density"
              options={[
                { value: 'comfortable', label: 'Comfortable', icon: Monitor },
                { value: 'compact', label: 'Compact', icon: Rows3 },
              ]}
            />
            {/* An icon-only dock is fast once learned and opaque before that.
                The preference persists, so nobody has to relearn the strip on
                every visit. */}
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={showLabels}
              onClick={() => setShowLabels((value) => !value)}
              className="mt-2.5 flex w-full items-center gap-2.5 rounded-xl px-1 py-2 text-left text-[0.8125rem] font-medium text-ink-muted transition-colors hover:text-accent-ink"
            >
              <Tags className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
              <span className="flex-1">Dock labels</span>
              <span
                aria-hidden="true"
                className={cx(
                  'flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
                  showLabels ? 'bg-accent' : 'bg-line-strong',
                )}
              >
                <span
                  className={cx(
                    'h-4 w-4 rounded-full bg-surface shadow-card transition-transform duration-150',
                    showLabels && 'translate-x-4',
                  )}
                />
              </span>
            </button>
          </div>

          <div className="border-t border-line p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[0.8125rem] font-medium text-ink-muted transition-colors hover:bg-critical-soft hover:text-critical-ink"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Shell-level trail: which navigation group and entry the route belongs to. */
function useShellTrail(groups, pathname) {
  return useMemo(() => {
    let best = null;
    groups.forEach((group) => {
      group.items.forEach((item) => {
        const matches = item.end ? pathname === item.to : pathname.startsWith(item.to);
        if (matches && (!best || item.to.length > best.item.to.length)) best = { group, item };
      });
    });
    return best;
  }, [groups, pathname]);
}

export function AppLayout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();

  const groups = useMemo(() => navForRole(user?.role), [user?.role]);
  const unreadCount = useUnreadCount();
  const palette = useCommandPalette();

  // Owned here, not inside the menus: both account menus and the island's theme
  // switch must agree, and these hooks hold per-instance state.
  const { theme, setTheme } = useTheme();
  const { density, setDensity } = useDensity();
  const [showLabels, setShowLabels] = usePersistentState('examforge-dock-labels', false);

  const trail = useShellTrail(groups, location.pathname);

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const menuProps = {
    user,
    onSignOut: handleSignOut,
    theme,
    setTheme,
    density,
    setDensity,
    showLabels,
    setShowLabels,
  };

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href={`#${CONTENT_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent-on focus:shadow-glow"
      >
        Skip to content
      </a>

      {/* The mesh is viewport-fixed rather than painted on the page: a gradient
          stretched down a 4000px report stops reading as a ground and starts
          reading as a banner. */}
      <div aria-hidden="true" className="mesh pointer-events-none fixed inset-0" />

      {/* Top island (L3). Inset from every edge — it is a floating pane, not a
          bar welded to the top of the viewport. */}
      <header className="fixed inset-x-0 top-0 z-30 px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="glass mx-auto flex h-14 max-w-shell items-center gap-3 rounded-2xl px-3 sm:px-4">
          <Brand size="sm" showWord={false} className="shrink-0 lg:hidden" />
          <Brand size="sm" className="hidden shrink-0 lg:flex" />

          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-line-strong/60" />

          {/* Set in mono caps: this is a location readout, not prose, and the
              fixed advance keeps it from twitching as routes change. */}
          <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
            <ol className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.09em] text-ink-subtle">
              <li className="shrink-0">{ROLE_LABEL[user?.role] ?? 'Workspace'}</li>
              {trail && (
                <>
                  <li className="shrink-0 text-line-strong" aria-hidden="true">
                    /
                  </li>
                  <li className="shrink-0">{trail.group.label}</li>
                  <li className="shrink-0 text-line-strong" aria-hidden="true">
                    /
                  </li>
                  <li className="min-w-0 truncate font-semibold text-ink" aria-current="page">
                    {trail.item.label}
                  </li>
                </>
              )}
            </ol>
          </nav>

          {/* Below md the trail collapses to the one thing worth the width. */}
          {trail && (
            <p className="min-w-0 truncate text-[0.8125rem] font-semibold text-ink md:hidden">
              {trail.item.label}
            </p>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {/* The dock carries a ⌘K button of its own for thumbs; this is the
                discoverable, hint-bearing version for pointers. */}
            <button
              type="button"
              onClick={() => palette.setOpen(true)}
              aria-label="Open command palette"
              className="hidden h-9 items-center gap-2 rounded-full border border-line-strong bg-surface/70 pl-3 pr-1.5 text-ink-subtle transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent-ink sm:flex sm:w-56"
            >
              <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="text-[0.8125rem]">Search…</span>
              <kbd className="ml-auto flex items-center gap-0.5 rounded-full border border-line bg-surface-sunken px-2 py-0.5 font-mono text-[0.625rem] font-medium text-ink-subtle">
                <Command className="h-2.5 w-2.5" aria-hidden="true" />K
              </kbd>
            </button>

            {/* Theme gets a one-click switch because it is flipped mid-task;
                density is a set-once preference and stays in the menu. */}
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-accent-soft hover:text-accent-ink"
            >
              {theme === 'dark' ? (
                <Moon className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Sun className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            {/* Below lg the dock's avatar is the only account menu: two of them
                on a phone screen is noise, and `hidden` keeps the duplicate out
                of the accessibility tree rather than merely out of sight. */}
            <div className="hidden lg:block">
              <UserMenu {...menuProps} placement="bottom" variant="island" />
            </div>
          </div>
        </div>
      </header>

      {/* `relative` lifts the page above the fixed mesh layer. */}
      <main
        id={CONTENT_ID}
        tabIndex={-1}
        className="pb-dock relative mx-auto max-w-shell px-4 pt-[5.75rem] sm:px-6 sm:pt-[6.5rem] lg:px-10"
      >
        <Outlet />
      </main>

      <Dock
        groups={groups}
        activeGroupId={trail?.group.id}
        unreadCount={unreadCount}
        onOpenPalette={() => palette.setOpen(true)}
        showLabels={showLabels}
        userMenu={<UserMenu {...menuProps} placement="top" variant="dock" />}
      />

      <CommandPalette open={palette.open} onClose={palette.close} />
    </div>
  );
}
