import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CornerDownLeft, Search, X } from 'lucide-react';
import { api } from '../api/client.js';
import { flatNavForRole, quickActionsForRole } from '../config/navigation.js';
import { useAuthStore } from '../store/authStore.js';
import { useDebouncedValue, useEscapeKey, useFocusTrap, useScrollLock } from '../lib/hooks.js';
import { cx, Skeleton } from './ui.jsx';

/**
 * Subsequence match with a crude relevance score: a prefix hit outranks a hit
 * on a later word, which outranks scattered letters. Good enough for a list of
 * a few dozen destinations, and it avoids adding a fuzzy-search dependency.
 */
function fuzzyScore(text, query) {
  if (!query) return 0;
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();

  if (haystack.startsWith(needle)) return 1000 - haystack.length;
  const wordStart = haystack.split(/[\s/-]+/).some((word) => word.startsWith(needle));
  if (wordStart) return 800 - haystack.length;
  const direct = haystack.indexOf(needle);
  if (direct >= 0) return 600 - direct;

  let index = 0;
  let score = 300;
  let lastMatch = -1;
  for (const char of needle) {
    const found = haystack.indexOf(char, index);
    if (found === -1) return -1;
    if (lastMatch >= 0 && found === lastMatch + 1) score += 6;
    lastMatch = found;
    index = found + 1;
  }
  return score - haystack.length;
}

const SEARCH_GROUPS = [
  ['tests', 'Tests', (item) => item.title, (item) => `/search?q=${encodeURIComponent(item.title)}`],
  ['courses', 'Courses', (item) => item.name, (item) => `/courses/${item.id}`],
  ['questions', 'Questions', (item) => item.text, (item) => `/search?q=${encodeURIComponent(item.text.slice(0, 40))}`],
  ['assignments', 'Assignments', (item) => item.title, (item) => `/search?q=${encodeURIComponent(item.title)}`],
  ['lessons', 'Lessons', (item) => item.title, (item) => `/lessons/${item.id}`],
  ['users', 'People', (item) => item.fullName ?? item.username, () => '/search'],
];

export function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.user?.role);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [remote, setRemote] = useState([]);
  const [searching, setSearching] = useState(false);

  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const debouncedQuery = useDebouncedValue(query.trim(), 220);

  useScrollLock(open);
  useEscapeKey(open, onClose);
  useFocusTrap(panelRef, open, { initialFocusRef: inputRef });

  useEffect(() => {
    if (!open) {
      setQuery('');
      setRemote([]);
      setCursor(0);
    }
  }, [open]);

  // Server search only earns its round trip once the query is specific enough
  // to return something narrower than the navigation list already shows.
  useEffect(() => {
    if (!open || debouncedQuery.length < 2) {
      setRemote([]);
      setSearching(false);
      return undefined;
    }
    const controller = new AbortController();
    setSearching(true);
    api
      .get('/search', { params: { q: debouncedQuery, limit: 4 }, signal: controller.signal })
      .then(({ data }) => {
        const payload = data?.data ?? {};
        const results = [];
        SEARCH_GROUPS.forEach(([key, label, toLabel, toPath]) => {
          (payload[key] ?? []).forEach((item) => {
            const text = toLabel(item);
            if (!text) return;
            results.push({
              id: `${key}:${item.id}`,
              label: text.length > 70 ? `${text.slice(0, 70)}…` : text,
              group: label,
              to: toPath(item),
            });
          });
        });
        setRemote(results);
      })
      .catch(() => {
        // A failed lookup leaves navigation results in place rather than
        // replacing the palette with an error the user cannot act on.
        setRemote([]);
      })
      .finally(() => setSearching(false));

    return () => controller.abort();
  }, [open, debouncedQuery]);

  const items = useMemo(() => {
    const navItems = flatNavForRole(role).map((item) => ({
      id: `nav:${item.to}:${item.label}`,
      label: item.label,
      group: item.group,
      icon: item.icon,
      to: item.to,
      end: item.end,
    }));
    const actions = quickActionsForRole(role).map((action) => ({
      id: `action:${action.to}:${action.label}`,
      label: action.label,
      hint: action.hint,
      group: 'Actions',
      to: action.to,
    }));

    const local = [...actions, ...navItems];
    if (!query.trim()) return [...local, ...remote];

    const q = query.trim();
    const scored = local
      .map((item) => ({ item, score: Math.max(fuzzyScore(item.label, q), fuzzyScore(item.group ?? '', q) - 200) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);

    return [...scored, ...remote];
  }, [role, query, remote]);

  useEffect(() => {
    setCursor((current) => (items.length === 0 ? 0 : Math.min(current, items.length - 1)));
  }, [items.length]);

  const activate = useCallback(
    (item) => {
      if (!item) return;
      onClose();
      navigate(item.to);
    },
    [navigate, onClose],
  );

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((c) => (items.length ? (c + 1) % items.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((c) => (items.length ? (c - 1 + items.length) % items.length : 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setCursor(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setCursor(Math.max(0, items.length - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      activate(items[cursor]);
    }
  };

  // Keep the highlighted row inside the scroll viewport while arrowing.
  useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  let lastGroup = null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[10vh]">
      {/* L4 scrim. The blur is what pushes the page a layer back rather than
          just dimming it, which is how every other overlay in the system reads. */}
      <div
        className="animate-fade-in absolute inset-0 bg-[rgb(var(--shadow))]/50 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="animate-fade-up relative flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-overlay"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items[cursor] ? `${listId}-${cursor}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, actions, tests, courses…"
            className="h-[3.25rem] w-full border-0 bg-transparent text-[0.9375rem] text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-0"
          />
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-accent-soft hover:text-accent-ink"
            aria-label="Close command palette"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div ref={listRef} className="scrollbar-slim max-h-[22rem] overflow-y-auto p-2">
          {searching && items.length === 0 && (
            <div className="space-y-1.5 p-2">
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-4/5" />
              <Skeleton className="h-7 w-3/5" />
            </div>
          )}

          {!searching && items.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-ink-subtle">
              Nothing matches “{query}”.
            </p>
          )}

          <ul id={listId} role="listbox" aria-label="Results">
            {items.map((item, index) => {
              const showGroup = item.group && item.group !== lastGroup;
              lastGroup = item.group;
              const Icon = item.icon;
              const active = index === cursor;
              return (
                <li key={item.id}>
                  {showGroup && (
                    <p className="eyebrow px-3 pb-1.5 pt-3.5 first:pt-1">{item.group}</p>
                  )}
                  <div
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={active}
                    data-active={active}
                    onMouseMove={() => setCursor(index)}
                    onClick={() => activate(item)}
                    className={cx(
                      'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                      active ? 'bg-accent-soft text-accent-ink' : 'text-ink-muted',
                    )}
                  >
                    {Icon ? (
                      <Icon className={cx('h-4 w-4 shrink-0', active ? 'text-accent' : 'text-ink-subtle')} aria-hidden="true" />
                    ) : (
                      <ArrowRight className={cx('h-4 w-4 shrink-0', active ? 'text-accent' : 'text-ink-subtle')} aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      <span className={active ? 'font-semibold' : undefined}>{item.label}</span>
                      {item.hint && <span className="ml-2 text-xs text-ink-subtle">{item.hint}</span>}
                    </span>
                    {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center gap-4 border-t border-line bg-surface-sunken px-4 py-2.5 font-mono text-[0.625rem] uppercase tracking-[0.06em] text-ink-subtle">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            to navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Enter</Kbd>
            to open
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Esc</Kbd>
            to close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Kbd({ children }) {
  return (
    <kbd className="rounded-full border border-line-strong bg-surface px-1.5 py-px font-mono text-[0.625rem] normal-case text-ink-muted">
      {children}
    </kbd>
  );
}

/** Owns the Ctrl/Cmd-K binding so the layout only has to render the palette. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return { open, setOpen, close: useCallback(() => setOpen(false), []) };
}
