import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Copy,
  Inbox,
  LoaderCircle,
  Minus,
  RotateCcw,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { useEscapeKey, useFocusTrap, useScrollLock } from '../lib/hooks.js';
import { initials as toInitials } from '../lib/format.js';

/*
 * ============================================================================
 * Shared primitives — "Aperture"
 * ============================================================================
 *
 * Everything here is placed on the layer scale defined in index.css, and each
 * element's radius, border, blur and shadow follow from its layer rather than
 * being picked per component:
 *
 *   L1  cards, panels, toolbars, tables .. bg-surface        shadow-card
 *   L2  hover / popover .................. bg-surface-raised shadow-raised
 *   L4  modals, drawers .................. bg-surface-raised shadow-overlay
 *
 * Two consequences worth stating, because they are what stops the redesign
 * from drifting back into the old flat-rules look:
 *
 *   1. Separation is drawn with elevation and soft fills. Hairlines survive
 *      only where they carry information (a table row boundary, a panel
 *      header/body split) — never as decoration around a box.
 *   2. Colour is a signal, not a skin. A tone tints a bloom, a chip or a ring;
 *      it does not recolour body copy or a figure.
 *
 * Accent bloom (shadow-glow, and the blurred discs below) is rationed: the
 * primary action, the active dock item, and the accent stat tile. If more than
 * one thing on a screen bloms, none of them read as primary.
 */

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/* ---------------------------------------------------------------- headings */

function Breadcrumbs({ items }) {
  if (!items?.length) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.07em] text-ink-subtle">
        {items.map((crumb, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 && (
                <span className="shrink-0 text-line-strong" aria-hidden="true">
                  /
                </span>
              )}
              {crumb.to && !last ? (
                <Link to={crumb.to} className="rounded-sm transition-colors hover:text-accent">
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={last ? 'text-ink-muted' : undefined}>
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * The masthead of every page. The title is the only thing on a page set in the
 * display family — that is what marks a page apart from a section.
 *
 * The rule underneath fades out to the right instead of running edge to edge:
 * a full-width 1px line is exactly the device this system replaced, and a
 * fading one reads as the end of the header rather than as a table border.
 */
export function PageHeader({ title, description, actions, eyebrow, breadcrumbs }) {
  return (
    <header className="relative mb-8 pb-6">
      <Breadcrumbs items={breadcrumbs} />
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="eyebrow mb-3 flex items-center gap-2.5">
              <span aria-hidden="true" className="h-px w-6 shrink-0 rounded-full bg-accent" />
              <span className="truncate">{eyebrow}</span>
            </p>
          )}
          <h1 className="text-display text-ink">{title}</h1>
          {description && (
            <p className="mt-3 max-w-prose text-[0.9375rem] leading-relaxed text-ink-muted">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-line-strong via-line to-transparent"
      />
    </header>
  );
}

export function SectionHeader({ title, description, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1.5">
      <div className="min-w-0">
        <h2 className="text-title text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------- panel */

const PANEL_PADDING = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Panel({
  title,
  description,
  action,
  footer,
  children,
  className,
  bodyClassName,
  padding = 'md',
}) {
  return (
    <section className={cx('card flex flex-col', className)}>
      {(title || action || description) && (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line px-6 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-title text-ink">{title}</h2>}
            {description && <p className="mt-1 text-[0.8125rem] text-ink-muted">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
      )}
      {/* bodyClassName composes with the padding rather than replacing it: every
          call site that passes one is passing layout (a flex row), not a padding
          reset, and losing the padding flushed that content to the card edge. */}
      <div className={cx('min-w-0 flex-1', PANEL_PADDING[padding] ?? PANEL_PADDING.md, bodyClassName)}>
        {children}
      </div>
      {footer && (
        <div className="rounded-b-2xl border-t border-line bg-surface-sunken px-6 py-4 text-[0.8125rem] text-ink-muted">
          {footer}
        </div>
      )}
    </section>
  );
}

/**
 * Filter / search row that sits directly above a table or grid. It is a full L1
 * surface of its own — the same card treatment as the data below it, so the two
 * read as a pair of stacked objects rather than as a strip glued to a box.
 */
export function Toolbar({ children, className }) {
  return (
    <div
      className={cx(
        'mb-4 flex flex-wrap items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- stat tile */

/**
 * Tone on a stat tile is carried by light — a blurred disc bleeding out of the
 * top-right corner, plus the icon chip — and never by the figure itself. A red
 * number reads as an error, and most of these numbers are not errors.
 */
const STAT_TONES = {
  neutral: { bloom: 'bg-ink-subtle/20', chip: 'bg-surface-sunken text-ink-subtle ring-line', ring: null },
  accent: { bloom: 'bg-accent/35', chip: 'bg-accent-soft text-accent-ink ring-accent/25', ring: 'ring-1 ring-accent/20' },
  positive: { bloom: 'bg-positive/25', chip: 'bg-positive-soft text-positive-ink ring-positive/25', ring: null },
  caution: { bloom: 'bg-caution/25', chip: 'bg-caution-soft text-caution-ink ring-caution/25', ring: null },
  critical: { bloom: 'bg-critical/25', chip: 'bg-critical-soft text-critical-ink ring-critical/25', ring: null },
  info: { bloom: 'bg-info/25', chip: 'bg-info-soft text-info-ink ring-info/25', ring: null },
};

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus };
const TREND_TONE = {
  up: 'bg-positive-soft text-positive-ink ring-positive/20',
  down: 'bg-critical-soft text-critical-ink ring-critical/20',
  flat: 'bg-surface-sunken text-ink-subtle ring-line',
};

export function StatTile({ label, value, hint, tone = 'neutral', icon: Icon, trend }) {
  const spec = STAT_TONES[resolveTone(tone)] ?? STAT_TONES.neutral;
  const TrendIcon = trend ? TREND_ICON[trend.direction] ?? Minus : null;

  return (
    <div
      className={cx(
        'card group relative overflow-hidden p-5 transition-shadow duration-200 hover:shadow-raised',
        spec.ring,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full opacity-70 blur-2xl transition-opacity duration-300 group-hover:opacity-100',
          spec.bloom,
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <p className="eyebrow min-w-0 flex-1 truncate pt-1.5">{label}</p>
        {Icon && (
          <span
            className={cx(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
              spec.chip,
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="relative mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <p className="tabular text-stat text-ink">{value}</p>
        {trend && (
          <span
            className={cx(
              'tabular inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[0.6875rem] font-semibold leading-none ring-1 ring-inset',
              TREND_TONE[trend.direction] ?? TREND_TONE.flat,
            )}
          >
            <TrendIcon className="h-3 w-3" aria-hidden="true" />
            {trend.value}
          </span>
        )}
      </div>

      {hint && (
        <p className="relative mt-4 truncate border-t border-line pt-3 text-xs text-ink-subtle">
          {hint}
        </p>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- dialogs */

const MODAL_WIDTHS = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

/* L4 scrim. The blur is what puts the dialog on its own layer: a flat wash
   dims the page, a blur removes it from the plane the dialog sits on.
   Positioning is left to the caller — the modal's scroll container needs a
   fixed scrim so it does not scroll away with a tall dialog. */
const SCRIM = 'animate-fade-in inset-0 bg-[rgb(var(--shadow))]/50 backdrop-blur-md';

/** Circular icon button used for the close affordance on both overlays. */
const OVERLAY_CLOSE =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors ' +
  'hover:bg-surface-sunken hover:text-ink focus-visible:ring-4 focus-visible:ring-accent/20';

export function Modal({ open, onClose, title, description, children, footer, width = 'md' }) {
  const panelRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useScrollLock(open);
  useEscapeKey(open, () => onClose?.());
  useFocusTrap(panelRef, open);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
      <div className={cx('fixed', SCRIM)} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cx(
          'animate-scale-in relative my-auto w-full overflow-hidden rounded-3xl border border-line bg-surface-raised shadow-overlay',
          MODAL_WIDTHS[width] ?? width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-title text-ink">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                {description}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className={cx(OVERLAY_CLOSE, '-mr-2 -mt-1')} aria-label="Close dialog">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="scrollbar-slim max-h-[70vh] overflow-y-auto p-6">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-sunken px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
}) {
  return (
    <Modal
      // While the confirmed action is in flight the dialog must stay put, or the
      // backdrop click cancels a request that is already running.
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      width="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-muted">{description}</p>
      {tone === 'danger' && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-critical-soft px-3 py-1.5 text-[0.8125rem] font-semibold text-critical-ink ring-1 ring-inset ring-critical/20">
          <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
          This cannot be undone.
        </p>
      )}
    </Modal>
  );
}

const DRAWER_WIDTHS = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-xl',
  xl: 'sm:max-w-3xl',
};

export function Drawer({ open, onClose, title, description, children, footer, width = 'md' }) {
  const panelRef = useRef(null);
  const titleId = useId();

  useScrollLock(open);
  useEscapeKey(open, () => onClose?.());
  useFocusTrap(panelRef, open);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className={cx('absolute', SCRIM)} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cx(
          // Above sm the drawer is inset from the viewport and fully rounded, so
          // it reads as a slab floating over the page rather than as a second
          // window welded to the edge of the screen. On phones it stays flush,
          // where every pixel of width is worth more than the effect.
          'animate-slide-left relative flex h-full w-full flex-col overflow-hidden border border-line bg-surface-raised shadow-overlay',
          'sm:my-3 sm:mr-3 sm:h-[calc(100%-1.5rem)] sm:rounded-3xl',
          DRAWER_WIDTHS[width] ?? width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-title text-ink">
              {title}
            </h2>
            {description && <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className={cx(OVERLAY_CLOSE, '-mr-2 -mt-1')} aria-label="Close panel">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="scrollbar-slim flex-1 overflow-y-auto p-6">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-sunken px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ states */

export function Spinner({ label = 'Loading…', className }) {
  return (
    <div
      className={cx('flex flex-col items-center justify-center py-16 text-ink-subtle', className)}
      role="status"
    >
      <span className="relative flex h-10 w-10 items-center justify-center">
        {/* The bloom behind the spinner keeps a lone 20px glyph from looking
            lost in the middle of an otherwise empty card. */}
        <span aria-hidden="true" className="absolute inset-0 rounded-full bg-accent/15 blur-lg" />
        <LoaderCircle className="relative h-6 w-6 animate-spin text-accent" aria-hidden="true" />
      </span>
      {label && <p className="eyebrow mt-4">{label}</p>}
    </div>
  );
}

/** Single shimmer block. Compose these into shapes that match the real layout. */
export function Skeleton({ className }) {
  return (
    <div
      className={cx('shimmer rounded-lg bg-surface-sunken', className ?? 'h-4 w-full')}
      aria-hidden="true"
    />
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  // Shares Table's shell so the page does not resize when the data lands.
  return (
    <div
      className="table-shell scrollbar-slim overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
      role="status"
      aria-label="Loading table"
    >
      <table className={cx('table-base', TABLE_GUTTERS)}>
        <thead>
          <tr>
            {Array.from({ length: cols }, (_, i) => (
              <th key={i} scope="col">
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }, (_, c) => (
                <td key={c}>
                  <Skeleton className={cx('h-3.5', c === 0 ? 'w-40' : 'w-24')} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({ title, description, action, icon: Icon = Inbox }) {
  return (
    <div className="animate-fade-up relative flex flex-col items-center overflow-hidden rounded-2xl border border-dashed border-line-strong bg-surface-sunken/60 px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-accent/10 blur-2xl"
      />
      {/* The icon sits on a real L1 tile: an empty state is still a place, and
          giving it one lifted object stops it reading as a broken region. */}
      <span className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface text-accent shadow-card">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="relative text-title text-ink">{title}</h3>
      {description && (
        <p className="relative mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p>
      )}
      {action && <div className="relative mt-6">{action}</div>}
    </div>
  );
}

/**
 * Normalises axios errors, plain Errors and bare strings into one message.
 * Network failures and aborts get their own wording: "Something went wrong" is
 * useless when the real problem is that the API is unreachable.
 */
export function errorMessage(error) {
  if (!error) return 'Something went wrong.';
  if (typeof error === 'string') return error;
  if (error.code === 'ERR_CANCELED' || error.name === 'CanceledError') return 'Request cancelled.';
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return 'The request timed out. Check your connection and try again.';
  }
  const data = error?.response?.data;
  if (data) {
    if (typeof data === 'string') return data;
    if (data.message) return data.message;
    if (data.error) return typeof data.error === 'string' ? data.error : data.error.message;
    if (Array.isArray(data.errors) && data.errors.length) {
      return data.errors.map((e) => e.message ?? String(e)).join(' ');
    }
  }
  if (error?.response?.status === 403) return 'You do not have permission to do that.';
  if (error?.request && !error?.response) return 'Cannot reach the server. Check your connection.';
  return error?.message ?? 'Something went wrong.';
}

export function ErrorAlert({ error, className, onRetry }) {
  return (
    <div
      role="alert"
      className={cx(
        'flex flex-wrap items-start gap-x-3 gap-y-2.5 rounded-2xl bg-critical-soft px-4 py-3.5 text-sm text-critical-ink shadow-card ring-1 ring-inset ring-critical/20',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-critical/15"
      >
        <CircleAlert className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1 pt-0.5 leading-relaxed">{errorMessage(error)}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold ring-1 ring-inset ring-critical/25 transition-colors hover:bg-critical/10"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- badge */

const BADGE_TONES = {
  neutral: 'bg-surface-sunken text-ink-muted ring-line-strong',
  accent: 'bg-accent-soft text-accent-ink ring-accent/25',
  positive: 'bg-positive-soft text-positive-ink ring-positive/25',
  caution: 'bg-caution-soft text-caution-ink ring-caution/25',
  critical: 'bg-critical-soft text-critical-ink ring-critical/25',
  info: 'bg-info-soft text-info-ink ring-info/25',
};

/**
 * Earlier pages were written against a raw-colour vocabulary (green, red,
 * amber, blue, slate, brand, violet) that the semantic palette replaced. Those
 * call sites fell through to `neutral`, which is why every status chip in the
 * app rendered grey. Rather than a rename across forty files, the old names are
 * kept as aliases onto the semantic tone they always meant.
 */
const TONE_ALIASES = {
  green: 'positive',
  red: 'critical',
  amber: 'caution',
  orange: 'caution',
  blue: 'info',
  violet: 'accent',
  brand: 'accent',
  primary: 'accent',
  danger: 'critical',
  slate: 'neutral',
  gray: 'neutral',
  grey: 'neutral',
};

/** Normalise any tone name — semantic or legacy — onto the semantic palette. */
export const resolveTone = (tone) => TONE_ALIASES[tone] ?? tone ?? 'neutral';

const BADGE_DOTS = {
  neutral: 'bg-ink-subtle',
  accent: 'bg-accent',
  positive: 'bg-positive',
  caution: 'bg-caution',
  critical: 'bg-critical',
  info: 'bg-info',
};

/**
 * A status chip is metadata, so it is set in the mono face and shaped as a pill
 * — the same geometry as the buttons and the dock, which is what keeps the
 * chrome of a row from looking like a different kit to the controls above it.
 */
export function Badge({ children, tone = 'neutral', dot = false, className }) {
  const key = resolveTone(tone);
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[0.625rem] font-semibold uppercase leading-none tracking-[0.08em] ring-1 ring-inset',
        BADGE_TONES[key] ?? BADGE_TONES.neutral,
        className,
      )}
    >
      {dot && (
        <span
          className={cx('h-1.5 w-1.5 shrink-0 rounded-full', BADGE_DOTS[key] ?? BADGE_DOTS.neutral)}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

/** Domain status -> badge tone; unknown statuses degrade to neutral. */
const STATUS_TONES = {
  DRAFT: 'neutral',
  SCHEDULED: 'info',
  PUBLISHED: 'positive',
  ACTIVE: 'positive',
  ARCHIVED: 'neutral',
  CLOSED: 'critical',
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'info',
  SUBMITTED: 'caution',
  EVALUATED: 'positive',
  GRADED: 'positive',
  PASSED: 'positive',
  FAILED: 'critical',
  PENDING: 'caution',
  EXPIRED: 'critical',
  CANCELLED: 'neutral',
  FLAGGED: 'critical',
  REVIEWED: 'info',
  EASY: 'positive',
  MEDIUM: 'caution',
  HARD: 'critical',
};

export const statusTone = (status) =>
  STATUS_TONES[String(status ?? '').toUpperCase()] ?? 'neutral';

/* -------------------------------------------------------------------- form */

export function Field({ label, error, hint, htmlFor, required, children }) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  return (
    <div className="min-w-0">
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required && (
            <span className="ml-0.5 text-critical" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error && (
        <p id={errorId} role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-medium text-critical-ink">
          <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0">{error}</span>
        </p>
      )}
      {!error && hint && <p className="mt-2 text-xs leading-5 text-ink-subtle">{hint}</p>}
    </div>
  );
}

/* The invalid look mirrors the focus ring on .input — same 4px spread, critical
   hue — so an error state is the same shape of signal as a focus state. */
const INVALID = 'border-critical focus:border-critical focus:ring-4 focus:ring-critical/20';

export const Input = forwardRef(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cx('input', invalid && INVALID, className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ className, invalid, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cx('input', invalid && INVALID, className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select({ className, invalid, children, options, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cx('input', invalid && INVALID, className)}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {options
        ? options.map((option) =>
            typeof option === 'string' ? (
              <option key={option} value={option}>
                {option}
              </option>
            ) : (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ),
          )
        : children}
    </select>
  );
});

/**
 * The box is a real `appearance-none` checkbox rather than a styled sibling, so
 * it keeps native semantics, form participation and `register()` support while
 * taking the system's softer geometry. The tick is painted on top with pointer
 * events off, which leaves the whole 20px square as the hit target.
 */
export const Checkbox = forwardRef(function Checkbox({ className, label, description, id, ...props }, ref) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const box = (
    // className lands on the wrapper, not the input: every call site passes
    // alignment (mt-0.5 next to a wrapped row of text), and margin on the
    // absolutely-positioned input would move the box off its own hit area.
    <span className={cx('relative inline-flex h-5 w-5 shrink-0 items-center justify-center', className)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className={cx(
          'peer absolute inset-0 m-0 h-5 w-5 cursor-pointer appearance-none rounded-[0.5rem] border border-line-strong bg-surface',
          'transition-[background-color,border-color,box-shadow] duration-150',
          'checked:border-accent checked:bg-accent hover:border-accent/60',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20',
          'disabled:cursor-not-allowed disabled:opacity-45',
        )}
        {...props}
      />
      <Check
        aria-hidden="true"
        className="pointer-events-none relative h-3.5 w-3.5 scale-75 text-accent-on opacity-0 transition duration-150 peer-checked:scale-100 peer-checked:opacity-100"
        strokeWidth={3}
      />
    </span>
  );
  if (!label) return box;
  return (
    <div className="flex items-start gap-2.5">
      {box}
      <label htmlFor={inputId} className="min-w-0 cursor-pointer select-none pt-px">
        <span className="block text-[0.8125rem] font-medium leading-5 text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-5 text-ink-subtle">{description}</span>}
      </label>
    </div>
  );
});

/**
 * Switch renders a real checkbox with role="switch" so it participates in forms
 * and in `register()` exactly like the other primitives. The track picks up the
 * accent bloom when on: it is the one control whose state is worth announcing
 * with light rather than only with colour.
 */
export const Switch = forwardRef(function Switch(
  { className, label, description, checked, defaultChecked, id, disabled, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className={cx('flex items-start gap-3', className)}>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          role="switch"
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          className="peer absolute inset-0 z-10 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...props}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none h-6 w-11 rounded-full border border-line-strong bg-surface-sunken transition-[background-color,border-color,box-shadow] duration-200 peer-checked:border-accent peer-checked:bg-accent peer-checked:shadow-glow peer-focus-visible:ring-4 peer-focus-visible:ring-accent/20 peer-disabled:opacity-50"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-[0.1875rem] h-[1.125rem] w-[1.125rem] rounded-full bg-surface shadow-card transition-transform duration-200 peer-checked:translate-x-5"
        />
      </span>
      {label && (
        <label htmlFor={inputId} className="min-w-0 cursor-pointer select-none">
          <span className="block text-[0.8125rem] font-medium leading-6 text-ink">{label}</span>
          {description && <span className="mt-0.5 block text-xs leading-5 text-ink-subtle">{description}</span>}
        </label>
      )}
    </div>
  );
});

export const SearchInput = forwardRef(function SearchInput(
  { className, onClear, value, placeholder = 'Search…', ...props },
  ref,
) {
  const showClear = Boolean(onClear && value);
  return (
    <div className={cx('relative min-w-0', className)}>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
        aria-hidden="true"
      />
      <input
        ref={ref}
        type="search"
        value={value}
        placeholder={placeholder}
        className={cx('input pl-10', showClear && 'pr-10')}
        {...props}
      />
      {showClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ button */

const BUTTON_VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  link: 'btn px-0 text-accent underline-offset-[3px] hover:underline',
};

const BUTTON_SIZES = { sm: 'btn-sm', md: 'btn-md', lg: 'btn-lg' };

export const Button = forwardRef(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    icon: Icon,
    iconRight: IconRight,
    as: Component = 'button',
    className,
    children,
    disabled,
    type,
    ...rest
  },
  ref,
) {
  const isNative = Component === 'button';
  const classes = cx(
    BUTTON_VARIANTS[variant] ?? BUTTON_VARIANTS.secondary,
    variant === 'link' ? null : BUTTON_SIZES[size] ?? BUTTON_SIZES.md,
    // Icon-only buttons collapse to a circle — .btn is already fully rounded, so
    // a square aspect ratio is all that is needed to get there.
    !children && 'px-0 aspect-square',
    className,
  );

  const content = (
    <>
      {loading ? (
        <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && <IconRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
    </>
  );

  return (
    <Component
      ref={ref}
      className={classes}
      // Non-button elements (router Link, anchor) have no disabled attribute, so
      // the disabled look has to be expressed through ARIA and pointer events.
      {...(isNative
        ? { type: type ?? 'button', disabled: disabled || loading }
        : {
            'aria-disabled': disabled || loading || undefined,
            tabIndex: disabled || loading ? -1 : undefined,
          })}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </Component>
  );
});

/* ------------------------------------------------------------------- table */

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' };

/*
 * Vertical cell padding comes from --cell-y/--cell-x so the density toggle keeps
 * working; what is added here is horizontal air at the card edge, which the
 * density setting has no reason to take away. Without it the first column is
 * jammed against a 28px corner radius.
 */
const TABLE_GUTTERS =
  '[&_thead_th:first-child]:pl-6 [&_tbody_td:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:last-child]:pr-6';

export function Table({ head, children, className, dense = false }) {
  return (
    <div
      className={cx(
        'table-shell scrollbar-slim overflow-hidden rounded-2xl border border-line bg-surface shadow-card',
        className,
      )}
    >
      <table className={cx('table-base', TABLE_GUTTERS, dense && '[&_tbody_td]:py-1.5')}>
        {head && (
          <thead>
            <tr>
              {head.map((cell, index) => {
                const isString = typeof cell === 'string';
                const key = isString ? cell : cell.key ?? cell.label ?? index;
                return (
                  <th
                    key={key}
                    scope="col"
                    className={isString ? undefined : cx(ALIGN[cell.align])}
                    style={isString || !cell.width ? undefined : { width: cell.width }}
                  >
                    {isString ? cell : cell.label}
                  </th>
                );
              })}
            </tr>
          </thead>
        )}
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({ children, className, ...rest }) {
  return (
    <tr className={className} {...rest}>
      {children}
    </tr>
  );
}

export function Th({ children, align, className, ...rest }) {
  return (
    <th scope="col" className={cx(ALIGN[align], className)} {...rest}>
      {children}
    </th>
  );
}

export function Td({ children, align, className, ...rest }) {
  return (
    <td className={cx(ALIGN[align], className)} {...rest}>
      {children}
    </td>
  );
}

/**
 * Optional convenience wrapper over Table for the common
 * columns + rows + async-state case. Column shape:
 * `{ key, label, align, width, render?(row, index), className? }`.
 */
export function DataTable({
  columns,
  rows,
  loading = false,
  error = null,
  onRetry,
  empty,
  rowKey = (row, index) => row?.id ?? index,
  onRowClick,
  dense = false,
  className,
}) {
  if (loading) return <SkeletonTable rows={6} cols={columns.length} />;
  if (error) return <ErrorAlert error={error} onRetry={onRetry} />;
  if (!rows?.length) {
    return empty ?? <EmptyState title="Nothing to show" description="No records match the current filters." />;
  }

  return (
    <Table
      className={className}
      dense={dense}
      head={columns.map((c) => ({ key: c.key, label: c.label, align: c.align, width: c.width }))}
    >
      {rows.map((row, index) => (
        <tr
          key={rowKey(row, index)}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          className={onRowClick ? 'cursor-pointer' : undefined}
        >
          {columns.map((column) => (
            <td key={column.key} className={cx(ALIGN[column.align], column.className)}>
              {column.render ? column.render(row, index) : row[column.key]}
            </td>
          ))}
        </tr>
      ))}
    </Table>
  );
}

/* -------------------------------------------------------------- pagination */

const PAGE_SIZES = [10, 25, 50, 100];

/* Pagination sits directly under a table card. It gets no rule of its own —
   the card edge above it is already the separation. */
export function Pagination({ page, pageCount, total, pageSize, onPageChange, onPageSizeChange }) {
  const pages = Math.max(1, pageCount ?? 1);
  const current = Math.min(Math.max(1, page ?? 1), pages);
  const from = total === 0 ? 0 : (current - 1) * (pageSize ?? 0) + 1;
  const to = pageSize ? Math.min(current * pageSize, total ?? current * pageSize) : total;

  const windowed = useMemo(() => {
    const span = 2;
    const items = [];
    for (let p = 1; p <= pages; p += 1) {
      if (p === 1 || p === pages || (p >= current - span && p <= current + span)) items.push(p);
      else if (items[items.length - 1] !== '…') items.push('…');
    }
    return items;
  }, [pages, current]);

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 px-1 pt-4" aria-label="Pagination">
      <p className="tabular font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-ink-subtle">
        {total === undefined
          ? `Page ${current} of ${pages}`
          : `Showing ${from}–${to} of ${total}`}
      </p>

      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <label className="flex items-center gap-2 text-xs text-ink-subtle">
            <span>Rows</span>
            <select
              className="input h-8 w-auto py-0 pl-3 pr-7 text-xs"
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              aria-label="Rows per page"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* One pill rail: the page numbers sit in a sunken track so the set
            reads as a single control rather than as loose buttons. */}
        <div className="flex items-center gap-0.5 rounded-full border border-line bg-surface p-1 shadow-card">
          <button
            type="button"
            className="btn btn-sm h-7 w-7 px-0 text-ink-muted hover:bg-accent-soft hover:text-accent-ink disabled:opacity-40"
            onClick={() => onPageChange(current - 1)}
            disabled={current <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          {windowed.map((item, index) =>
            item === '…' ? (
              <span key={`gap-${index}`} className="px-1 text-xs text-ink-subtle" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === current ? 'page' : undefined}
                className={cx(
                  'tabular btn btn-sm h-7 min-w-[1.75rem] px-2 font-mono text-[0.75rem]',
                  item === current
                    ? 'bg-accent-soft text-accent-ink ring-1 ring-inset ring-accent/25'
                    : 'text-ink-muted hover:bg-accent-soft/60 hover:text-accent-ink',
                )}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            className="btn btn-sm h-7 w-7 px-0 text-ink-muted hover:bg-accent-soft hover:text-accent-ink disabled:opacity-40"
            onClick={() => onPageChange(current + 1)}
            disabled={current >= pages}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </nav>
  );
}

/* -------------------------------------------------------------------- tabs */

export function Tabs({ tabs, value, onChange, className }) {
  const listRef = useRef(null);

  const onKeyDown = (event) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex((t) => t.value === value);
    let next = index;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    onChange(tabs[next].value);
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={onKeyDown}
      className={cx('scrollbar-slim flex items-center gap-1 overflow-x-auto border-b border-line', className)}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={cx(
              'relative flex items-center gap-2 whitespace-nowrap rounded-t-xl px-3.5 py-3 text-[0.8125rem] font-semibold transition-colors',
              active ? 'text-ink' : 'text-ink-muted hover:bg-accent-soft/40 hover:text-ink',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cx(
                  'tabular rounded-full px-2 py-0.5 font-mono text-[0.625rem] font-semibold leading-4',
                  active ? 'bg-accent-soft text-accent-ink' : 'bg-surface-sunken text-ink-subtle',
                )}
              >
                {tab.count}
              </span>
            )}
            {/* The underline is drawn on select rather than swapped in, so the
                eye follows the mark to the tab it landed on. */}
            {active && (
              <span
                aria-hidden="true"
                className="animate-rule-in absolute -bottom-px left-2 right-2 h-0.5 origin-left rounded-full bg-accent"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ meters */

const PROGRESS_TONES = {
  accent: 'bg-accent',
  positive: 'bg-positive',
  caution: 'bg-caution',
  critical: 'bg-critical',
  info: 'bg-info',
  neutral: 'bg-ink-subtle',
};

export function ProgressBar({ value = 0, max = 100, tone = 'accent', label, className }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={cx('min-w-0', className)}>
      {label && (
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="truncate text-xs text-ink-muted">{label}</span>
          <span className="tabular shrink-0 font-mono text-[0.6875rem] font-semibold text-ink">
            {Math.round(pct)}%
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
        // A sunken track with an inset ring instead of a bordered box: the fill
        // should look like it sits in a groove, not inside a rectangle.
        className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken ring-1 ring-inset ring-line"
      >
        <div
          className={cx(
            'h-full rounded-full transition-[width] duration-500 ease-out',
            PROGRESS_TONES[resolveTone(tone)] ?? PROGRESS_TONES.accent,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ avatar */

const AVATAR_SIZES = {
  xs: 'h-6 w-6 text-[0.5625rem]',
  sm: 'h-7 w-7 text-[0.625rem]',
  md: 'h-8 w-8 text-[0.6875rem]',
  lg: 'h-10 w-10 text-xs',
  xl: 'h-14 w-14 text-base',
};

export function Avatar({ name, src, size = 'md', className }) {
  const label = name || 'Unknown';
  if (src) {
    return (
      <img
        src={src}
        alt={label}
        className={cx(
          'shrink-0 rounded-full object-cover ring-1 ring-inset ring-line-strong',
          AVATAR_SIZES[size] ?? AVATAR_SIZES.md,
          className,
        )}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      title={label}
      className={cx(
        'flex shrink-0 select-none items-center justify-center rounded-full bg-accent-soft font-mono font-semibold uppercase tracking-[0.02em] text-accent-ink ring-1 ring-inset ring-accent/25',
        AVATAR_SIZES[size] ?? AVATAR_SIZES.md,
        className,
      )}
    >
      {toInitials(label)}
    </span>
  );
}

/* ----------------------------------------------------------------- tooltip */

const TOOLTIP_SIDES = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

/**
 * Hover and focus both reveal the label, so the tooltip is reachable from the
 * keyboard; the label is also the accessible description of the trigger.
 */
export function Tooltip({ label, children, side = 'top', className }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  if (!label) return children;

  return (
    <span
      className={cx('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={id} className="inline-flex">
        {children}
      </span>
      <span
        id={id}
        role="tooltip"
        hidden={!open}
        className={cx(
          // Set on the always-dark slab rather than on surface: a tooltip that
          // matches the page it floats over stops reading as a separate layer.
          // It is the same dark tone the dock's own labels use.
          'animate-fade-in pointer-events-none absolute z-50 whitespace-nowrap rounded-lg bg-panel px-2.5 py-1.5 text-xs font-medium text-panel-ink shadow-overlay ring-1 ring-inset ring-white/10',
          TOOLTIP_SIDES[side] ?? TOOLTIP_SIDES.top,
        )}
      >
        {label}
      </span>
    </span>
  );
}

/* -------------------------------------------------------------- copy value */

export function CopyButton({ value, label = 'Copy', className }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value ?? ''));
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied; the value stays selectable on screen.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={cx(
        'btn btn-sm gap-1.5 text-ink-muted transition-colors hover:bg-accent-soft hover:text-accent-ink',
        copied && 'bg-positive-soft text-positive-ink hover:bg-positive-soft hover:text-positive-ink',
        className,
      )}
      aria-label={copied ? 'Copied' : label}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
}
