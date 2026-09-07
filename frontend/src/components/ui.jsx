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

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/* ---------------------------------------------------------------- headings */

function Breadcrumbs({ items }) {
  if (!items?.length) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-subtle">
        {items.map((crumb, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="h-3 w-3 shrink-0 text-ink-subtle" aria-hidden="true" />
              )}
              {crumb.to && !last ? (
                <Link to={crumb.to} className="rounded-sm hover:text-ink hover:underline">
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

export function PageHeader({ title, description, actions, eyebrow, breadcrumbs }) {
  return (
    <header className="mb-6 border-b border-line pb-4">
      <Breadcrumbs items={breadcrumbs} />
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
          <h1 className="text-display text-ink">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionHeader({ title, description, action }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <h2 className="text-[0.9375rem] font-semibold tracking-[-0.006em] text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------- panel */

const PANEL_PADDING = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
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
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-[0.875rem] font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[0.8125rem] text-ink-muted">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={cx('flex-1 min-w-0', bodyClassName ?? PANEL_PADDING[padding] ?? PANEL_PADDING.md)}>
        {children}
      </div>
      {footer && (
        <div className="border-t border-line bg-surface-sunken/60 px-4 py-2.5 text-[0.8125rem] text-ink-muted">
          {footer}
        </div>
      )}
    </section>
  );
}

/** Filter / search row that sits directly above a table or grid. */
export function Toolbar({ children, className }) {
  return (
    <div
      className={cx(
        'mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 shadow-card',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- stat tile */

const STAT_TONES = {
  neutral: 'text-ink',
  accent: 'text-accent',
  positive: 'text-positive',
  caution: 'text-caution',
  critical: 'text-critical',
  info: 'text-info',
};

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus };
const TREND_TONE = { up: 'text-positive', down: 'text-critical', flat: 'text-ink-subtle' };

export function StatTile({ label, value, hint, tone = 'neutral', icon: Icon, trend }) {
  const TrendIcon = trend ? TREND_ICON[trend.direction] ?? Minus : null;
  return (
    <div className="card px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow truncate">{label}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className={cx('tabular text-[1.625rem] font-semibold leading-none tracking-tight', STAT_TONES[tone] ?? STAT_TONES.neutral)}>
          {value}
        </p>
        {trend && (
          <span className={cx('tabular inline-flex items-center gap-0.5 text-xs font-medium', TREND_TONE[trend.direction] ?? TREND_TONE.flat)}>
            <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {trend.value}
          </span>
        )}
      </div>
      {hint && <p className="mt-1.5 truncate text-xs text-ink-subtle">{hint}</p>}
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
      <div
        className="animate-fade-in fixed inset-0 bg-[rgb(var(--shadow))]/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cx(
          'animate-fade-up relative my-auto w-full rounded-xl border border-line bg-surface-raised shadow-overlay',
          MODAL_WIDTHS[width] ?? width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-title text-ink">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-ink-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm -mr-1 -mt-0.5 px-1.5 text-ink-subtle hover:bg-surface-sunken hover:text-ink"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="scrollbar-slim max-h-[70vh] overflow-y-auto p-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3">
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
      <p className="text-sm text-ink-muted">{description}</p>
      {tone === 'danger' && (
        <p className="mt-2 text-sm font-medium text-critical-ink">This cannot be undone.</p>
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
      <div
        className="animate-fade-in absolute inset-0 bg-[rgb(var(--shadow))]/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cx(
          'animate-slide-left relative flex h-full w-full flex-col border-l border-line bg-surface shadow-overlay',
          DRAWER_WIDTHS[width] ?? width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-title text-ink">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm -mr-1 -mt-0.5 px-1.5 text-ink-subtle hover:bg-surface-sunken hover:text-ink"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="scrollbar-slim flex-1 overflow-y-auto p-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ states */

export function Spinner({ label = 'Loading…', className }) {
  return (
    <div className={cx('flex flex-col items-center justify-center py-12 text-ink-subtle', className)} role="status">
      <LoaderCircle className="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
      {label && <p className="mt-2.5 text-sm">{label}</p>}
    </div>
  );
}

/** Single shimmer block. Compose these into shapes that match the real layout. */
export function Skeleton({ className }) {
  return (
    <div
      className={cx('shimmer rounded-md bg-surface-sunken', className ?? 'h-4 w-full')}
      aria-hidden="true"
    />
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="table-shell" role="status" aria-label="Loading table">
      <table className="table-base">
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
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface-sunken text-ink-subtle">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
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
        'flex flex-wrap items-start gap-x-3 gap-y-2 rounded-md border border-critical/30 bg-critical-soft px-3 py-2.5 text-sm text-critical-ink',
        className,
      )}
    >
      <CircleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{errorMessage(error)}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-sm font-medium underline underline-offset-2 hover:no-underline"
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
  accent: 'bg-accent-soft text-accent-ink ring-accent/30',
  positive: 'bg-positive-soft text-positive-ink ring-positive/30',
  caution: 'bg-caution-soft text-caution-ink ring-caution/30',
  critical: 'bg-critical-soft text-critical-ink ring-critical/30',
  info: 'bg-info-soft text-info-ink ring-info/30',
  blue: 'bg-info-soft text-info-ink ring-info/30',
  green: 'bg-positive-soft text-positive-ink ring-positive/30',
  amber: 'bg-caution-soft text-caution-ink ring-caution/30',
  red: 'bg-critical-soft text-critical-ink ring-critical/30',
  violet: 'bg-accent-soft text-accent-ink ring-accent/30',
  slate: 'bg-surface-sunken text-ink-muted ring-line-strong',
  brand: 'bg-accent-soft text-accent-ink ring-accent/30',
};

const BADGE_DOTS = {
  neutral: 'bg-ink-subtle',
  accent: 'bg-accent',
  positive: 'bg-positive',
  caution: 'bg-caution',
  critical: 'bg-critical',
  info: 'bg-info',
  blue: 'bg-info',
  green: 'bg-positive',
  amber: 'bg-caution',
  red: 'bg-critical',
  violet: 'bg-accent',
  slate: 'bg-ink-subtle',
  brand: 'bg-accent',
};

export function Badge({ children, tone = 'neutral', dot = false, className }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        BADGE_TONES[tone] ?? BADGE_TONES.neutral,
        className,
      )}
    >
      {dot && (
        <span
          className={cx('h-1.5 w-1.5 shrink-0 rounded-full', BADGE_DOTS[tone] ?? BADGE_DOTS.neutral)}
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
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-critical-ink">
          {error}
        </p>
      )}
      {!error && hint && <p className="mt-1.5 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cx('input', invalid && 'border-critical focus:border-critical focus:ring-critical/30', className)}
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
      className={cx('input', invalid && 'border-critical focus:border-critical focus:ring-critical/30', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select({ className, invalid, children, options, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cx('input', invalid && 'border-critical focus:border-critical', className)}
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

export const Checkbox = forwardRef(function Checkbox({ className, label, description, id, ...props }, ref) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const box = (
    <input
      ref={ref}
      id={inputId}
      type="checkbox"
      className={cx(
        'h-4 w-4 shrink-0 cursor-pointer rounded-sm border border-line-strong bg-surface text-accent',
        'accent-[rgb(var(--accent))] focus-visible:ring-2 focus-visible:ring-accent',
        className,
      )}
      {...props}
    />
  );
  if (!label) return box;
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5">{box}</span>
      <label htmlFor={inputId} className="min-w-0 cursor-pointer select-none">
        <span className="block text-[0.8125rem] font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-subtle">{description}</span>}
      </label>
    </div>
  );
});

/**
 * Switch renders a real checkbox with role="switch" so it participates in forms
 * and in `register()` exactly like the other primitives.
 */
export const Switch = forwardRef(function Switch(
  { className, label, description, checked, defaultChecked, id, disabled, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className={cx('flex items-start gap-3', className)}>
      <span className="relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center">
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
          className="pointer-events-none h-5 w-9 rounded-full border border-line-strong bg-surface-sunken transition-colors peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-canvas peer-disabled:opacity-50"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0.5 h-4 w-4 rounded-full bg-surface shadow-card transition-transform peer-checked:translate-x-4"
        />
      </span>
      {label && (
        <label htmlFor={inputId} className="min-w-0 cursor-pointer select-none">
          <span className="block text-[0.8125rem] font-medium text-ink">{label}</span>
          {description && <span className="mt-0.5 block text-xs text-ink-subtle">{description}</span>}
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
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
        aria-hidden="true"
      />
      <input
        ref={ref}
        type="search"
        value={value}
        placeholder={placeholder}
        className={cx('input pl-8', showClear && 'pr-8')}
        {...props}
      />
      {showClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-ink-subtle hover:bg-surface-sunken hover:text-ink"
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

export function Table({ head, children, className, dense = false }) {
  return (
    <div className={cx('table-shell scrollbar-slim rounded-lg border border-line bg-surface', className)}>
      <table className={cx('table-base', dense && '[&_tbody_td]:py-1.5')}>
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
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-1 pt-3"
      aria-label="Pagination"
    >
      <p className="tabular text-xs text-ink-subtle">
        {total === undefined
          ? `Page ${current} of ${pages}`
          : `Showing ${from}–${to} of ${total}`}
      </p>

      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-xs text-ink-subtle">
            <span>Rows</span>
            <select
              className="input h-7 w-auto py-0 pl-2 pr-6 text-xs"
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

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="btn btn-sm px-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-40"
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
                  'tabular btn btn-sm min-w-[1.75rem] px-1.5',
                  item === current
                    ? 'border-line-strong bg-surface-sunken font-semibold text-ink'
                    : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
                )}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            className="btn btn-sm px-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-40"
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
      className={cx('flex items-center gap-1 overflow-x-auto border-b border-line', className)}
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
              '-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[0.8125rem] font-medium transition-colors',
              active
                ? 'border-accent text-ink'
                : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cx(
                  'tabular rounded-sm px-1 py-0.5 text-[0.6875rem] font-semibold',
                  active ? 'bg-accent-soft text-accent-ink' : 'bg-surface-sunken text-ink-subtle',
                )}
              >
                {tab.count}
              </span>
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
        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs text-ink-muted">
          <span className="truncate">{label}</span>
          <span className="tabular shrink-0">{Math.round(pct)}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
      >
        <div
          className={cx('h-full rounded-full transition-[width] duration-300', PROGRESS_TONES[tone] ?? PROGRESS_TONES.accent)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ avatar */

const AVATAR_SIZES = {
  xs: 'h-6 w-6 text-[0.625rem]',
  sm: 'h-7 w-7 text-[0.6875rem]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
  xl: 'h-14 w-14 text-lg',
};

export function Avatar({ name, src, size = 'md', className }) {
  const label = name || 'Unknown';
  if (src) {
    return (
      <img
        src={src}
        alt={label}
        className={cx('shrink-0 rounded-md border border-line object-cover', AVATAR_SIZES[size] ?? AVATAR_SIZES.md, className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      title={label}
      className={cx(
        'flex shrink-0 select-none items-center justify-center rounded-md border border-accent/25 bg-accent-soft font-semibold text-accent-ink',
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
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
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
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-sm border border-line bg-surface-raised px-2 py-1 text-xs text-ink shadow-overlay',
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
        'btn btn-sm gap-1 text-ink-muted hover:bg-surface-sunken hover:text-ink',
        className,
      )}
      aria-label={copied ? 'Copied' : label}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-positive" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
}

