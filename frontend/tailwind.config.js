/** @type {import('tailwindcss').Config} */

// Every colour resolves through a CSS custom property holding a bare "R G B"
// triplet, so a single :root / .dark swap in index.css re-themes the whole app
// and Tailwind opacity modifiers (bg-surface/60) keep working.
const token = (name) => ({ opacityValue }) =>
  opacityValue === undefined
    ? `rgb(var(--${name}))`
    : `rgb(var(--${name}) / ${opacityValue})`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        surface: token('surface'),
        'surface-raised': token('surface-raised'),
        'surface-sunken': token('surface-sunken'),
        line: token('line'),
        'line-strong': token('line-strong'),
        // The always-dark slab. Kept out of the .dark override on purpose: it
        // is the same colour in both themes, which is what makes it a slab.
        panel: {
          DEFAULT: token('panel'),
          raised: token('panel-raised'),
          ink: token('panel-ink'),
          accent: token('panel-accent'),
        },
        'panel-ink': token('panel-ink'),
        ink: token('ink'),
        'ink-muted': token('ink-muted'),
        'ink-subtle': token('ink-subtle'),
        accent: {
          DEFAULT: token('accent'),
          hover: token('accent-hover'),
          soft: token('accent-soft'),
          ink: token('accent-ink'),
          on: token('on-accent'),
        },
        positive: {
          DEFAULT: token('positive'),
          soft: token('positive-soft'),
          ink: token('positive-ink'),
        },
        caution: {
          DEFAULT: token('caution'),
          soft: token('caution-soft'),
          ink: token('caution-ink'),
        },
        critical: {
          DEFAULT: token('critical'),
          soft: token('critical-soft'),
          ink: token('critical-ink'),
          on: token('on-critical'),
        },
        info: { DEFAULT: token('info'), soft: token('info-soft'), ink: token('info-ink') },
      },
      fontFamily: {
        // Bricolage Grotesque carries the display voice — optically tight and
        // characterful at size — over Plus Jakarta Sans for the interface and
        // JetBrains Mono for anything that is a figure or a label.
        sans: [
          'Plus Jakarta Sans',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        display: [
          'Bricolage Grotesque',
          'Plus Jakarta Sans',
          'ui-sans-serif',
          'system-ui',
          'Segoe UI',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'Liberation Mono',
          'monospace',
        ],
      },
      fontSize: {
        // Display sizes live in index.css because they also set a family;
        // what remains here are the one-off UI sizes worth naming.
        eyebrow: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.1em', fontWeight: '500' }],
        stat: ['2.25rem', { lineHeight: '1', letterSpacing: '-0.028em', fontWeight: '700' }],
      },
      borderRadius: {
        // Generous throughout: this system communicates with depth and soft
        // geometry, and a 4px corner under a 44px blur reads as a mistake.
        none: '0',
        sm: '0.375rem',
        DEFAULT: '0.625rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.25rem',
        '2xl': '1.75rem',
        '3xl': '2.25rem',
      },
      boxShadow: {
        // One entry per layer of the depth scale documented in index.css, so an
        // element's shadow is decided by where it sits rather than by taste.
        // All are violet-tinted through --shadow; a neutral grey drop over this
        // canvas reads as dirt.
        card: '0 0 0 1px rgb(var(--shadow) / 0.03), 0 1px 2px 0 rgb(var(--shadow) / 0.04), 0 4px 12px -4px rgb(var(--shadow) / 0.07)',
        raised:
          '0 0 0 1px rgb(var(--shadow) / 0.04), 0 2px 6px -1px rgb(var(--shadow) / 0.07), 0 12px 28px -8px rgb(var(--shadow) / 0.16)',
        dock: '0 2px 8px -2px rgb(var(--shadow) / 0.10), 0 18px 44px -12px rgb(var(--shadow) / 0.22), 0 40px 80px -32px rgb(var(--shadow) / 0.28)',
        overlay:
          '0 4px 12px -4px rgb(var(--shadow) / 0.16), 0 24px 60px -16px rgb(var(--shadow) / 0.32)',
        // Accent bloom. Reserved for the primary action and the active dock
        // item — the two things per screen that should attract the eye.
        glow: '0 1px 2px 0 rgb(var(--accent-glow) / 0.24), 0 6px 20px -6px rgb(var(--accent-glow) / 0.45)',
        'glow-lg': '0 2px 4px 0 rgb(var(--accent-glow) / 0.28), 0 10px 30px -6px rgb(var(--accent-glow) / 0.55)',
      },
      maxWidth: {
        prose: '68ch',
        shell: '92rem',
      },
      spacing: {
        // No sidebar in this system; what is reserved instead is the room the
        // floating chrome needs at the top and bottom of every page.
        topbar: '4.5rem',
        dock: '7.5rem',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in': { from: { opacity: '0', transform: 'translateX(-10px)' }, to: { opacity: '1', transform: 'none' } },
        // The section popover grows out of the dock item that opened it.
        'pop-up': { from: { opacity: '0', transform: 'translateY(10px) scale(0.97)' }, to: { opacity: '1', transform: 'none' } },
        'dock-in': { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-left': { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.985) translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        // Draws the underline beneath an active tab rather than snapping it.
        'rule-in': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.18s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.14s ease-out both',
        'slide-in': 'slide-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-left': 'slide-left 0.24s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scale-in 0.16s cubic-bezier(0.16, 1, 0.3, 1) both',
        'rule-in': 'rule-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pop-up': 'pop-up 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
        'dock-in': 'dock-in 0.34s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};
