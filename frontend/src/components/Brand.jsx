import { Link } from 'react-router-dom';
import { cx } from './ui.jsx';

/**
 * The single source of the ExamForge lockup.
 *
 * The mark is drawn rather than set in type so it holds its proportions from
 * 20px in the dock to 40px on the auth slab. The gradient runs from a lighter
 * iris to the accent, which is what keeps a 24px rounded square from reading as
 * a flat coloured chip next to real glass.
 *
 * `tone="panel"` is for the always-dark slab, where the surrounding ink is
 * fixed in both themes and the theme tokens would be wrong.
 */

const SIZES = {
  sm: { box: 'h-6 w-6', radius: 7, stroke: 3.2, word: 'text-[0.9375rem]' },
  md: { box: 'h-8 w-8', radius: 9, stroke: 3.1, word: 'text-[1.0625rem]' },
  lg: { box: 'h-10 w-10', radius: 11, stroke: 3, word: 'text-[1.1875rem]' },
};

export function BrandMark({ size = 'md', className }) {
  const spec = SIZES[size] ?? SIZES.md;
  // The gradient id must be unique per instance or a second mark on the page
  // reuses the first one's stops after a hot reload.
  const id = `ef-mark-${size}`;

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cx('shrink-0', spec.box, className)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(var(--accent) / 0.88)" />
          <stop offset="1" stopColor="rgb(var(--accent-hover))" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx={spec.radius} fill={`url(#${id})`} />
      <path
        d="M22 10.4H13.6v3.9H20v3.4h-6.4v3.9H22"
        fill="none"
        stroke="rgb(var(--on-accent))"
        strokeWidth={spec.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Brand({ to = '/', size = 'md', tone = 'default', showWord = true, className }) {
  const spec = SIZES[size] ?? SIZES.md;

  const content = (
    <>
      <BrandMark size={size} />
      {showWord && (
        <span
          className={cx(
            'font-display font-semibold tracking-[-0.028em]',
            spec.word,
            tone === 'panel' ? 'text-panel-ink' : 'text-ink',
          )}
        >
          ExamForge
        </span>
      )}
    </>
  );

  if (!to) {
    return <span className={cx('flex items-center gap-2.5', className)}>{content}</span>;
  }

  return (
    <Link
      to={to}
      aria-label="ExamForge home"
      className={cx(
        'flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80',
        className,
      )}
    >
      {content}
    </Link>
  );
}
