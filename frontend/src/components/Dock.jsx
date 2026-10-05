import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Bell, Command } from 'lucide-react';
import { useClickOutside, useEscapeKey, useMediaQuery } from '../lib/hooks.js';
import { cx } from './ui.jsx';

/**
 * The dock — primary navigation for the whole app.
 *
 * This replaces the left sidebar outright. Navigation no longer occupies layout
 * space: the dock is an L3 glass pill floating clear of the page, and the
 * sidebar's second level (the routes inside a group) becomes a section popover
 * that opens above it. Two levels, same information, zero columns of the
 * viewport spent on chrome.
 *
 * Sizing note: a group's icon is its FIRST item's icon. `navigation.js`
 * guarantees no two entries in a role share an icon, so the strip is
 * unambiguous without inventing a second icon vocabulary for groups.
 */

// The popover is measured in px because the anchor has to be clamped against
// the viewport, and a Tailwind class can't be read back at runtime.
const POPOVER_WIDTH = 272; // = w-[17rem]
const VIEWPORT_GUTTER = 12;

/** Shared geometry for every control in the dock, labelled or not. */
function dockButtonClass(active, showLabels) {
  return cx(
    'group relative flex shrink-0 items-center justify-center rounded-full text-ink-muted',
    'transition-[background-color,color,box-shadow,transform] duration-150',
    'hover:-translate-y-0.5 hover:bg-accent-soft hover:text-accent-ink',
    showLabels ? 'h-auto w-[4.25rem] flex-col gap-1 px-1 py-1.5' : 'h-10 w-10 lg:h-11 lg:w-11',
    active && 'bg-accent text-accent-on shadow-glow hover:bg-accent-hover hover:text-accent-on',
  );
}

/** The label that rises above an icon on hover. Pointer affordance only. */
function DockTooltip({ label }) {
  return (
    <span
      aria-hidden="true"
      className="glass pointer-events-none absolute bottom-full left-1/2 z-20 mb-2.5 hidden -translate-x-1/2 translate-y-1
                 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold text-ink opacity-0
                 transition-[opacity,transform] duration-150 group-hover:translate-y-0 group-hover:opacity-100
                 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 lg:block"
    >
      {label}
    </span>
  );
}

export function Dock({
  groups,
  activeGroupId,
  unreadCount = 0,
  onOpenPalette,
  showLabels = false,
  userMenu,
}) {
  const { pathname } = useLocation();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [openId, setOpenId] = useState(null);
  const [anchor, setAnchor] = useState(0);

  const dockRef = useRef(null);
  const popoverRef = useRef(null);
  const triggerRefs = useRef(new Map());
  // Read in `close` so the focus restore never runs inside a state updater,
  // which React may invoke twice in StrictMode.
  const openIdRef = useRef(null);
  openIdRef.current = openId;

  const close = useCallback((restoreFocus) => {
    const id = openIdRef.current;
    setOpenId(null);
    if (restoreFocus && id) triggerRefs.current.get(id)?.focus();
  }, []);

  useEscapeKey(Boolean(openId), () => close(true));
  useClickOutside(dockRef, Boolean(openId), () => close(false));

  // A popover left open over the page the user just chose hides the answer they
  // asked for. Focus is deliberately NOT restored here: it travelled with the
  // navigation.
  useEffect(() => {
    setOpenId(null);
  }, [pathname]);

  // Centre the panel on its trigger, clamped inside the viewport — a group at
  // either end of the pill would otherwise hang off the screen edge.
  useLayoutEffect(() => {
    if (!openId || !isDesktop) return undefined;
    const measure = () => {
      const dock = dockRef.current;
      const trigger = triggerRefs.current.get(openId);
      if (!dock || !trigger) return;
      const dockRect = dock.getBoundingClientRect();
      const rect = trigger.getBoundingClientRect();
      const half = POPOVER_WIDTH / 2;
      const centre = Math.min(
        Math.max(rect.left + rect.width / 2, half + VIEWPORT_GUTTER),
        window.innerWidth - half - VIEWPORT_GUTTER,
      );
      setAnchor(centre - dockRect.left);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [openId, isDesktop]);

  // Opening the section list and then having to Tab into it would make the
  // popover useless without a mouse.
  useEffect(() => {
    if (!openId) return undefined;
    const raf = requestAnimationFrame(() => {
      popoverRef.current?.querySelector('[data-dock-link]')?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [openId]);

  const onPopoverKeyDown = (event) => {
    const links = Array.from(popoverRef.current?.querySelectorAll('[data-dock-link]') ?? []);
    if (links.length === 0) return;
    const index = links.indexOf(document.activeElement);
    const focusAt = (next) => {
      event.preventDefault();
      links[(next + links.length) % links.length].focus();
    };
    if (event.key === 'ArrowDown') focusAt(index + 1);
    else if (event.key === 'ArrowUp') focusAt(index - 1);
    else if (event.key === 'Home') focusAt(0);
    else if (event.key === 'End') focusAt(links.length - 1);
    else if (event.key === 'Tab') close(false);
  };

  const openGroup = groups.find((group) => group.id === openId) ?? null;
  // A full pill can't take a 36px corner radius once the labels make it two
  // rows tall — it turns into a stadium with dead space at both ends.
  const shape = cx('rounded-t-3xl', showLabels ? 'lg:rounded-3xl' : 'lg:rounded-full');

  return (
    <>
      {/* Below the dock (z-40) but above the top island (z-30): on a phone the
          section list is a sheet, and a sheet without a scrim reads as a stray
          card floating over the page. */}
      {openGroup && !isDesktop && (
        <div
          aria-hidden="true"
          className="animate-fade-in fixed inset-0 z-[38] bg-[rgb(var(--shadow))]/45 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <div
        // The strip spans the viewport so the pill can centre inside it, so it
        // must not swallow clicks on the page underneath.
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center lg:bottom-6"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div ref={dockRef} className="pointer-events-auto relative w-full lg:w-auto">
          {openGroup && (
            <div
              className={cx(
                'absolute bottom-full z-10 mb-3',
                isDesktop ? 'w-[17rem]' : 'inset-x-2',
              )}
              // The animation owns `transform`, so the horizontal centring has
              // to live on this wrapper rather than on the animated panel.
              style={isDesktop ? { left: anchor, transform: 'translateX(-50%)' } : undefined}
            >
              <div
                ref={popoverRef}
                id={`dock-section-${openGroup.id}`}
                onKeyDown={onPopoverKeyDown}
                className="glass animate-pop-up flex max-h-[min(60vh,26rem)] flex-col overflow-hidden rounded-2xl"
              >
                <p className="eyebrow shrink-0 px-4 pb-1 pt-3.5">{openGroup.label}</p>
                <ul
                  aria-label={openGroup.label}
                  className="scrollbar-slim min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2 pt-1"
                >
                  {openGroup.items.map((item) => {
                    const Icon = item.icon;
                    const count = item.badge === 'notifications' ? unreadCount : 0;
                    return (
                      <li key={`${item.to}${item.label}`}>
                        <NavLink
                          to={item.to}
                          end={item.end}
                          data-dock-link=""
                          className={({ isActive }) =>
                            cx(
                              'flex items-center gap-3 rounded-xl px-2.5 py-2 text-[0.8125rem] transition-colors',
                              isActive
                                ? 'bg-accent-soft font-semibold text-accent-ink'
                                : 'font-medium text-ink-muted hover:bg-accent-soft/60 hover:text-accent-ink',
                            )
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <Icon
                                className={cx(
                                  'h-4 w-4 shrink-0',
                                  isActive ? 'text-accent' : 'text-ink-subtle',
                                )}
                                aria-hidden="true"
                              />
                              <span className="min-w-0 flex-1 truncate">{item.label}</span>
                              {count > 0 && (
                                <span className="tabular shrink-0 rounded-full bg-critical px-1.5 py-0.5 font-mono text-[0.625rem] font-semibold leading-none text-critical-on">
                                  {count > 99 ? '99+' : count}
                                </span>
                              )}
                              {isActive && (
                                <span
                                  aria-hidden="true"
                                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                                />
                              )}
                            </>
                          )}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          {/* `.glass` and `shadow-dock` both set box-shadow, and .glass wins the
              cascade (it is emitted after the generated utilities). Its inset
              top highlight is what sells the pane as a physical object, so the
              wide dock drop goes on a wrapper rather than fighting for the
              property — and the wrapper has to carry the same radius or the
              shadow is cast by the wrong silhouette. */}
          <div className={cx('shadow-dock', shape)}>
            <nav
              aria-label="Primary"
              className={cx('glass animate-dock-in flex items-center px-2 py-2 lg:px-2.5', shape)}
            >
              {/* Admin carries six groups; on a narrow phone the strip scrolls
                  rather than shrinking the targets below thumb size. */}
              <div className="scrollbar-slim flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto lg:flex-none lg:gap-1 lg:overflow-x-visible">
                {groups.map((group) => {
                  const Icon = group.items[0]?.icon;
                  const active = group.id === activeGroupId;
                  const expanded = group.id === openId;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      ref={(node) => {
                        if (node) triggerRefs.current.set(group.id, node);
                        else triggerRefs.current.delete(group.id);
                      }}
                      onClick={() => setOpenId((current) => (current === group.id ? null : group.id))}
                      aria-haspopup="true"
                      aria-expanded={expanded}
                      aria-controls={expanded ? `dock-section-${group.id}` : undefined}
                      aria-current={active ? 'true' : undefined}
                      aria-label={active ? `${group.label}, current section` : group.label}
                      className={dockButtonClass(active, showLabels)}
                    >
                      {/* The open group's own tooltip would land on top of the
                          panel it just opened, so it stands down. */}
                      {!showLabels && !expanded && <DockTooltip label={group.label} />}
                      {Icon && <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />}
                      {showLabels && (
                        <span className="w-full truncate text-center text-[0.625rem] font-semibold leading-none">
                          {group.label}
                        </span>
                      )}
                      {/* The open section keeps a mark of its own so the pill
                          still says where you are while the panel is up. */}
                      <span
                        aria-hidden="true"
                        className={cx(
                          'absolute left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent transition-opacity duration-150',
                          showLabels ? '-bottom-0.5' : 'bottom-1',
                          expanded && !active ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </button>
                  );
                })}
              </div>

              <span
                aria-hidden="true"
                className="mx-1 h-6 w-px shrink-0 bg-line-strong/60 lg:mx-1.5"
              />

              <div className="flex shrink-0 items-center gap-0.5 lg:gap-1">
                <button
                  type="button"
                  onClick={onOpenPalette}
                  aria-label="Open command palette"
                  className={dockButtonClass(false, showLabels)}
                >
                  {!showLabels && <DockTooltip label="Search ⌘K" />}
                  <Command className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {showLabels && (
                    <span className="w-full truncate text-center text-[0.625rem] font-semibold leading-none">
                      Search
                    </span>
                  )}
                </button>

                <Link
                  to="/notifications"
                  aria-label={
                    unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
                  }
                  className={dockButtonClass(false, showLabels)}
                >
                  {!showLabels && <DockTooltip label="Notifications" />}
                  <span className="relative flex">
                    <Bell className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {unreadCount > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-critical ring-2 ring-[rgb(var(--glass))]"
                      />
                    )}
                  </span>
                  {showLabels && (
                    <span className="w-full truncate text-center text-[0.625rem] font-semibold leading-none">
                      Alerts
                    </span>
                  )}
                </Link>

                {userMenu}
              </div>
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}
