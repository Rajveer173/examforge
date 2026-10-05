import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  Fingerprint,
  GraduationCap,
  Layers,
  ListChecks,
  Moon,
  ScrollText,
  Shuffle,
  Sun,
  Timer,
  Video,
} from 'lucide-react';
import { Brand } from '../components/Brand.jsx';
import { cx } from '../components/ui.jsx';
import { useTheme } from '../lib/theme.js';

/* ------------------------------------------------------------------- data */

const CYCLE = [
  {
    title: 'Author',
    icon: ListChecks,
    lede: 'Write a question once, reuse it everywhere.',
    body: 'Seven question types are supported: single choice, multiple choice, true/false, fill in the blank, matching, subjective and coding. Every question carries a difficulty, a Bloom level, a topic and tags, and each edit is kept as a version so a paper can be traced back to what was actually asked.',
  },
  {
    title: 'Assemble',
    icon: Layers,
    lede: 'Build a paper by hand, or let a pool draw it.',
    body: 'Group questions into banks, then pull them into a test by hand or through a question pool that draws N questions at random from a filtered set. Tests are built from sections, each with its own marks and ordering, and a paper can shuffle its questions and its option order per candidate.',
  },
  {
    title: 'Deliver',
    icon: Timer,
    lede: 'The clock runs on the server, not in the browser.',
    body: 'Answers autosave as the candidate works, so a dropped connection or a closed tab resumes where it left off. A test can carry a start and end window, a grace period, an attempt limit and an access password.',
  },
  {
    title: 'Grade',
    icon: ClipboardCheck,
    lede: 'Machines mark what machines can mark.',
    body: 'Objective questions score automatically, including negative marking where configured. Coding submissions run against stored test cases. Subjective answers land in a review queue where a teacher awards marks and leaves feedback, and the attempt moves from submitted to evaluated.',
  },
  {
    title: 'Report',
    icon: ScrollText,
    lede: 'Find the bad question, not just the bad score.',
    body: 'Results are broken down by question, section and cohort, with difficulty and discrimination indices computed per question so a weak item can be found and retired. Passing candidates can be issued certificates, and leaderboards rank a batch on completed assessments.',
  },
];

/* Figures quoted below are counted from the lists on this page, not estimated. */
const MEASURES = [
  ['07', 'Question types', 'single, multiple, true/false, fill-blank, matching, subjective, coding'],
  ['05', 'Cycle stages', 'author, assemble, deliver, grade, report'],
  ['04', 'Roles', 'administrator, teacher, student, proctor'],
  ['01', 'Record', 'one trail from the question written to the mark awarded'],
];

const CAPABILITIES = [
  ['Question types', 'Single, multiple, true/false, fill-blank, matching, subjective, coding', 'full'],
  ['Question banks', 'Shared banks, tags, topics, difficulty, Bloom level, version history', 'full'],
  ['Randomisation', 'Per-candidate question order, option order, and pooled random draws', 'full'],
  ['Sectioned papers', 'Sections with independent marks, ordering and instructions', 'full'],
  ['Timing controls', 'Server-side clock, start/end window, grace period, attempt limits', 'full'],
  ['Negative marking', 'Per-test penalty applied to incorrect objective answers', 'full'],
  ['Autosave and resume', 'Answers persisted continuously; attempts resume after disconnect', 'full'],
  ['Coding assessment', 'In-browser editor, stored test cases, per-case pass/fail on submission', 'full'],
  ['Auto-grading', 'Objective and coding questions scored without manual intervention', 'full'],
  ['Manual review', 'Queue for subjective answers with per-question marks and feedback', 'full'],
  ['Proctoring signals', 'Session events with severity and a running suspicion score', 'partial'],
  ['Snapshot capture', 'Screen and camera frames stored against a proctoring session', 'partial'],
  ['Courses and lessons', 'Modules, lessons, resources, enrolment and per-lesson progress', 'full'],
  ['Assignments', 'Briefs, due dates, file submissions and grading', 'full'],
  ['Certificates', 'Issued on completion, verifiable by certificate identifier', 'full'],
  ['Analytics', 'Cohort trends, score distribution, per-question difficulty and discrimination', 'full'],
  ['Audit logging', 'Actor, action, target and timestamp for administrative changes', 'full'],
  ['Two-factor authentication', 'Time-based one-time codes on top of the password', 'full'],
  ['Institutional SSO', 'SAML and OIDC federation with an identity provider', 'none'],
  ['LTI integration', 'Launching from an external learning management system', 'none'],
];

const STATUS_META = {
  full: { label: 'Available', className: 'bg-positive-soft text-positive-ink ring-positive/25' },
  partial: { label: 'Limited', className: 'bg-caution-soft text-caution-ink ring-caution/25' },
  none: { label: 'Not yet', className: 'bg-surface-sunken text-ink-subtle ring-line-strong' },
};

const ROLES = [
  {
    name: 'Administrator',
    icon: Building2,
    summary: 'Runs the institution-wide configuration.',
    points: [
      'Create departments, academic years, semesters and batches',
      'Issue and revoke teacher, proctor and administrator accounts',
      'Review every test, result and attempt across the organisation',
      'Read the audit log of who changed what, and when',
    ],
  },
  {
    name: 'Teacher',
    icon: GraduationCap,
    summary: 'Owns the material and the marking.',
    points: [
      'Build question banks and assemble tests from them',
      'Assign tests and coursework to class batches',
      'Work the manual review queue for subjective answers',
      'Read per-question analytics to retire weak items',
    ],
  },
  {
    name: 'Student',
    icon: ClipboardCheck,
    summary: 'Sits assessments and tracks progress.',
    points: [
      'Enrol in courses and work through lessons and resources',
      'Sit timed attempts with autosave and resume',
      'Review scored answers once results are released',
      'Collect certificates for completed assessments',
    ],
  },
  {
    name: 'Proctor',
    icon: Video,
    summary: 'Watches sittings in progress.',
    points: [
      'See every attempt currently in progress',
      'Read the event stream and suspicion score per candidate',
      'Annotate a session with notes for later review',
    ],
  },
];

const SECURITY = [
  {
    title: 'Session handling',
    icon: Fingerprint,
    body: 'Sign-in issues a short-lived JWT access token held in memory and a refresh token in an HTTP-only cookie. Concurrent requests share a single refresh, and a password change or an explicit sign-out invalidates the stored refresh tokens so other devices drop out.',
  },
  {
    title: 'Two-factor authentication',
    icon: Timer,
    body: 'Accounts can require a time-based one-time code in addition to the password. The sign-in call answers with a distinct status when a code is needed, so the second factor is a separate step rather than a silent failure. Failed attempts are rate limited per address.',
  },
  {
    title: 'Proctoring signals',
    icon: Video,
    body: 'A proctoring session records typed events with a severity and an accumulating suspicion score, plus optional screen or camera snapshots. These are signals for a human to judge, not automatic verdicts: nothing is failed or flagged by the system on its own.',
  },
  {
    title: 'Audit logging',
    icon: ScrollText,
    body: 'Administrative changes are written to an append-only audit log holding the actor, the action, the target record, the source address and the time. Sign-in attempts are recorded separately with their outcome, so a disputed result has a trail behind it.',
  },
];

const TEST_SPEC = [
  ['Duration', '120 minutes, server-timed'],
  ['Sections', '3 — Concepts, Applied, Programming'],
  ['Question source', 'Pool draw: 20 of 74 tagged items'],
  ['Per-candidate order', 'Questions shuffled, options shuffled'],
  ['Negative marking', '0.25 marks per incorrect objective answer'],
  ['Attempts', '1, with a 5 minute grace period'],
  ['Result release', 'Held until manual review completes'],
  ['Proctoring', 'Events recorded, reviewed by a proctor'],
];

const FAQ = [
  {
    q: 'What happens if a candidate loses their connection mid-exam?',
    a: 'Answers autosave to the server as they are entered, and the attempt clock runs server-side. Reopening the exam restores the saved answers and the remaining time, with a grace period if the test defines one.',
  },
  {
    q: 'Can two candidates get different papers from the same test?',
    a: 'Yes. A test can shuffle question order and option order per candidate, and question pools draw a set number of questions at random from a filtered pool, so two sittings of the same test can share a blueprint without sharing an identical paper.',
  },
  {
    q: 'How are coding questions marked?',
    a: 'Each coding problem carries stored test cases. A submission runs against them and the per-case outcome is recorded with the submission, so partial credit reflects how many cases passed rather than an all-or-nothing result.',
  },
  {
    q: 'Does the platform decide whether someone cheated?',
    a: 'No. Proctoring produces events and a suspicion score for a human reviewer. No attempt is voided, failed or flagged automatically on the basis of those signals.',
  },
  {
    q: 'Who can see a result before it is released?',
    a: 'A test chooses whether the score is shown immediately on submission. Until a result is released, the attempt is visible to the teacher who owns the test and to administrators; the candidate sees only that the attempt was submitted.',
  },
  {
    q: 'How do accounts get created?',
    a: 'Students can register themselves and verify by email. Teacher, proctor and administrator accounts are created by an administrator, because those roles carry access to other people’s work.',
  },
];

const SECTIONS = [
  ['#cycle', 'How it works'],
  ['#capabilities', 'Capabilities'],
  ['#roles', 'Roles'],
  ['#security', 'Security'],
  ['#faq', 'FAQ'],
];

/* -------------------------------------------------------------- fragments */

/**
 * Every section opens the same way: an index/label pill, then the display
 * heading. The old page ruled each opener with a 1px line running to the edge;
 * in this system the pill carries the same "you are here" job using tone and
 * radius, so nothing on the page is structured by a hairline.
 */
function SectionOpener({ index, label, title, description, tone = 'light' }) {
  const onPanel = tone === 'panel';
  return (
    <div className="mb-10 max-w-3xl sm:mb-14">
      <span
        className={cx(
          'inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 font-mono text-[0.6875rem] uppercase leading-4 tracking-[0.12em] ring-1 ring-inset',
          onPanel
            ? 'bg-panel-raised/80 text-panel-accent ring-panel-ink/15'
            : 'bg-accent-soft text-accent-ink ring-accent/15',
        )}
      >
        {/* Alphas here are the lowest that still clear 4.5:1 on the pill fill in
            both themes — checked numerically, not by eye. */}
        <span className={onPanel ? 'text-panel-ink/60' : 'text-accent-ink/80'}>{index}</span>
        {label}
      </span>

      <h2 className={cx('mt-6 text-display-lg', onPanel ? 'text-panel-ink' : 'text-ink')}>
        {title}
      </h2>
      {description && (
        <p
          className={cx(
            'mt-4 max-w-prose text-[0.9375rem] leading-relaxed',
            onPanel ? 'text-panel-ink/65' : 'text-ink-muted',
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export function LandingPage() {
  const { theme, toggle } = useTheme();
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="mesh min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent-on focus:shadow-glow"
      >
        Skip to content
      </a>

      {/* L3. The header is an island floating over the canvas rather than a bar
          welded to the viewport edge, so the mesh runs underneath it. */}
      <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="glass mx-auto flex h-14 max-w-shell items-center gap-3 rounded-full pl-4 pr-2 sm:h-16 sm:pl-6 sm:pr-3">
          <Brand />

          <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Sections">
            {SECTIONS.map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-muted transition-colors hover:bg-accent-soft hover:text-accent-ink"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={toggle}
              className="btn btn-sm w-8 px-0 text-ink-subtle hover:bg-accent-soft hover:text-accent-ink"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            <Link to="/login" className="btn-ghost btn-sm">
              Sign in
            </Link>
            {/* Hidden on the narrowest widths, where it would push the island
                past the viewport; the hero repeats it immediately below. */}
            <Link to="/register" className="btn-primary btn-sm hidden sm:inline-flex">
              Create student account
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className="pt-24 sm:pt-28">
        {/* ------------------------------------------------------------ hero */}
        <section className="relative">
          {/* The bloom sits behind the hero only, so the canvas mesh stays a
              ground and the accent still reads as a single light source. */}
          <div
            className="pointer-events-none absolute inset-x-0 -top-32 h-[38rem] opacity-90"
            style={{
              backgroundImage:
                'radial-gradient(46% 52% at 22% 26%, rgb(var(--accent) / 0.16) 0%, transparent 68%), radial-gradient(40% 46% at 84% 8%, rgb(var(--mesh-c) / 0.14) 0%, transparent 66%)',
            }}
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-shell px-4 pb-16 pt-8 sm:px-6 lg:px-10 lg:pb-24 lg:pt-14">
            <div className="grid items-start gap-x-12 gap-y-14 lg:grid-cols-[1.05fr_1fr] xl:gap-x-20">
              <div className="max-w-2xl animate-fade-up">
                <span className="eyebrow inline-flex items-center gap-2 rounded-full bg-surface/70 px-3.5 py-1.5 text-accent-ink ring-1 ring-inset ring-accent/15 backdrop-blur">
                  Assessment platform for institutions
                </span>

                <h1 className="mt-7 text-display-2xl text-ink">
                  Question banks, proctored exams and grading{' '}
                  <span className="italic text-accent">on one system.</span>
                </h1>

                <p className="mt-7 max-w-prose text-base leading-relaxed text-ink-muted">
                  ExamForge holds the whole assessment cycle in one place: authoring and versioning
                  questions, assembling sectioned papers, delivering timed attempts with a
                  server-side clock, grading objective and coding answers automatically, routing
                  subjective answers to a human reviewer, and reporting on the result at question,
                  section and cohort level.
                </p>

                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Link to="/login" className="btn-primary btn-lg">
                    Sign in
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link to="/register" className="btn-secondary btn-lg">
                    Register as a student
                  </Link>
                </div>

                <p className="mt-5 text-xs text-ink-subtle">
                  Staff accounts are issued by your institution&rsquo;s administrator.
                </p>
              </div>

              {/* A configuration sheet rather than a decorative illustration:
                  these are the actual controls an author sets on a test. */}
              <div className="relative lg:pt-4">
                {/* A second plane behind the sheet, offset and tilted. It is the
                    cheapest way to say "this is a stack of papers, and depth is
                    how this product is drawn" without inventing a screenshot. */}
                <div
                  aria-hidden="true"
                  className="absolute -inset-x-3 bottom-6 top-6 hidden rotate-[1.6deg] rounded-3xl border border-line bg-surface/70 shadow-card sm:block"
                />

                <figure className="relative overflow-hidden rounded-3xl border border-line bg-surface-raised shadow-raised">
                  <div className="accent-wash pointer-events-none absolute inset-0" aria-hidden="true" />

                  <figcaption className="relative flex items-center justify-between gap-3 px-5 pb-3 pt-5">
                    <span className="font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-muted">
                      Test configuration
                    </span>
                    <span className="rounded-full bg-accent-soft px-2.5 py-1 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-accent-ink ring-1 ring-inset ring-accent/15">
                      Sample
                    </span>
                  </figcaption>

                  {/* Rows are separated by an alternating sunken fill instead of
                      divider rules — same scanability, no hairlines. */}
                  <dl className="relative space-y-1 p-3 pt-1 text-[0.8125rem] sm:p-4 sm:pt-1">
                    {TEST_SPEC.map(([term, value]) => (
                      <div
                        key={term}
                        className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-xl px-3 py-2.5 odd:bg-surface-sunken/70"
                      >
                        <dt className="shrink-0 text-ink-subtle">{term}</dt>
                        <dd className="tabular font-medium text-ink sm:text-right">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </figure>

                <p className="relative mt-5 flex items-start gap-2.5 px-1 text-xs leading-relaxed text-ink-subtle">
                  <Shuffle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    Every one of these settings is per-test. Two papers built from the same bank can
                    differ in timing, penalty, randomisation and release policy.
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- measures */}
        <section className="mx-auto max-w-shell px-4 py-10 sm:px-6 lg:px-10">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MEASURES.map(([figure, label, detail]) => (
              <div key={label} className="card-interactive p-6">
                <dt className="tabular font-mono text-[2.25rem] font-medium leading-none tracking-[-0.02em] text-accent">
                  {figure}
                </dt>
                <dd className="mt-4">
                  <p className="text-[0.9375rem] font-semibold text-ink">{label}</p>
                  <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-subtle">{detail}</p>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ----------------------------------------------------------- cycle */}
        <section id="cycle" className="mx-auto max-w-shell scroll-mt-28 px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
          <SectionOpener
            index="01"
            label="How it works"
            title="Five stages, one record of what was asked and what was answered."
          />

          <ol className="space-y-4">
            {CYCLE.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <li key={stage.title} className="card-interactive group p-5 sm:p-7">
                  <div className="grid gap-x-8 gap-y-4 md:grid-cols-[17rem_1fr]">
                    <div className="flex min-w-0 gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent ring-1 ring-inset ring-accent/15 transition-shadow duration-200 group-hover:shadow-glow">
                        <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2.5">
                          <span className="tabular font-mono text-[0.6875rem] leading-5 text-ink-subtle">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <h3 className="text-title text-ink">{stage.title}</h3>
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{stage.lede}</p>
                      </div>
                    </div>

                    <p className="max-w-prose text-sm leading-relaxed text-ink-muted">
                      {stage.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* ---------------------------------------------------- capabilities */}
        <section
          id="capabilities"
          className="mx-auto max-w-shell scroll-mt-28 px-4 py-16 sm:px-6 lg:px-10 lg:py-24"
        >
          <SectionOpener
            index="02"
            label="Capabilities"
            title="What is built, what is partial, what is not there."
            description="Two entries below are marked as not yet available. They are listed because they are the questions procurement asks first, and an honest table is more useful than a short one."
          />

          <div className="card overflow-hidden">
            <div className="table-shell scrollbar-slim">
              <table className="table-base">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '22%' }}>
                      Capability
                    </th>
                    <th scope="col">What it covers</th>
                    <th scope="col" style={{ width: '8rem' }}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CAPABILITIES.map(([name, detail, status]) => {
                    const meta = STATUS_META[status];
                    return (
                      <tr key={name}>
                        <th
                          scope="row"
                          className="whitespace-nowrap px-[var(--cell-x)] py-[var(--cell-y)] text-left align-top text-[0.8125rem] font-semibold text-ink"
                        >
                          {name}
                        </th>
                        <td className="align-top">{detail}</td>
                        <td className="align-top">
                          <span
                            className={cx(
                              'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] ring-1 ring-inset',
                              meta.className,
                            )}
                          >
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------- roles */}
        <section id="roles" className="mx-auto max-w-shell scroll-mt-28 px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
          <SectionOpener
            index="03"
            label="Roles"
            title="Four roles, each with its own view of the same data."
            description="Access is enforced on the server per route and per record, not by hiding menu items. A teacher reaching another teacher’s test is refused by the API, whatever the client asks for."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            {ROLES.map((role) => {
              const Icon = role.icon;
              return (
                <article key={role.name} className="card-interactive group p-6 sm:p-7">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent ring-1 ring-inset ring-accent/15 transition-shadow duration-200 group-hover:shadow-glow">
                      <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
                    </span>
                    <h3 className="text-title text-ink">{role.name}</h3>
                  </div>
                  <p className="mt-4 text-sm text-ink-muted">{role.summary}</p>

                  <ul className="mt-5 space-y-2.5">
                    {role.points.map((point) => (
                      <li
                        key={point}
                        className="flex gap-3 rounded-xl bg-surface-sunken/60 px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-ink-muted"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-[0.4375rem] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/50"
                        />
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>

          <p className="mt-8 text-sm text-ink-muted">
            Already have an account?{' '}
            <Link to="/login" className="link">
              Sign in and you will land on the workspace for your role
            </Link>
            .
          </p>
        </section>

        {/* -------------------------------------------------------- security */}
        <section id="security" className="mx-auto max-w-shell scroll-mt-28 px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
          {/* The slab is inset and rounded rather than full-bleed: floating it
              off the canvas is what makes it read as a layer instead of a
              band, and it stays dark in both themes by design. */}
          <div className="relative overflow-hidden rounded-3xl bg-panel shadow-overlay">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  'radial-gradient(58% 60% at 12% -6%, rgb(var(--panel-accent) / 0.22) 0%, transparent 64%), radial-gradient(46% 50% at 92% 104%, rgb(var(--mesh-c) / 0.12) 0%, transparent 62%)',
              }}
              aria-hidden="true"
            />

            <div className="relative px-5 py-14 sm:px-10 lg:px-14 lg:py-20">
              <SectionOpener
                index="04"
                label="Security and accountability"
                title="What actually protects an attempt, described plainly."
                tone="panel"
              />

              <div className="grid gap-4 md:grid-cols-2">
                {SECURITY.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-panel-ink/10 bg-panel-raised/70 p-6 shadow-card backdrop-blur-sm sm:p-7"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-panel-accent/15 text-panel-accent">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <h3 className="text-[0.9375rem] font-semibold text-panel-ink">
                          {item.title}
                        </h3>
                      </div>
                      <p className="mt-4 text-sm leading-relaxed text-panel-ink/65">{item.body}</p>
                    </div>
                  );
                })}
              </div>

              <p className="mt-8 max-w-3xl rounded-2xl bg-panel-ink/5 p-6 text-sm leading-relaxed text-panel-ink/55">
                ExamForge does not claim a certification it does not hold. Data residency, retention
                periods and any formal accreditation depend on where your institution deploys it, and
                are set in your own infrastructure rather than by this application.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- faq */}
        <section id="faq" className="mx-auto max-w-4xl scroll-mt-28 px-4 py-16 sm:px-6 lg:py-24">
          <SectionOpener index="05" label="Questions" title="Frequently asked" />

          <dl className="space-y-3">
            {FAQ.map((item, index) => {
              const open = openFaq === index;
              return (
                <div
                  key={item.q}
                  className={cx(
                    'overflow-hidden rounded-2xl border bg-surface transition-[box-shadow,border-color,background-color] duration-200',
                    open
                      ? 'border-accent/25 bg-surface-raised shadow-raised'
                      : 'border-line shadow-card hover:border-accent/20',
                  )}
                >
                  <dt>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? -1 : index)}
                      aria-expanded={open}
                      aria-controls={`faq-${index}`}
                      className="group flex w-full items-start gap-4 px-5 py-5 text-left sm:px-6"
                    >
                      <span className="tabular mt-0.5 shrink-0 font-mono text-[0.6875rem] leading-6 text-ink-subtle">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span
                        className={cx(
                          'flex-1 text-[0.9375rem] font-medium leading-6 transition-colors',
                          open ? 'text-accent' : 'text-ink group-hover:text-accent',
                        )}
                      >
                        {item.q}
                      </span>
                      <span
                        aria-hidden="true"
                        className={cx(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-sm leading-none transition-[transform,background-color,color] duration-200',
                          open
                            ? 'rotate-45 bg-accent text-accent-on'
                            : 'bg-surface-sunken text-ink-subtle group-hover:bg-accent-soft group-hover:text-accent-ink',
                        )}
                      >
                        +
                      </span>
                    </button>
                  </dt>
                  <dd
                    id={`faq-${index}`}
                    hidden={!open}
                    className="px-5 pb-6 pl-[3.25rem] pr-6 text-sm leading-relaxed text-ink-muted sm:pl-[3.75rem]"
                  >
                    {item.a}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>

        {/* ------------------------------------------------------------ next */}
        <section className="mx-auto max-w-shell px-4 pb-16 sm:px-6 lg:px-10">
          <div className="relative overflow-hidden rounded-3xl border border-line bg-surface-raised px-6 py-12 shadow-raised sm:px-10 lg:px-14">
            <div className="accent-wash pointer-events-none absolute inset-0" aria-hidden="true" />
            <div className="relative flex flex-wrap items-center justify-between gap-8">
              <div className="max-w-xl">
                <h2 className="text-display text-ink">Ready to sign in?</h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                  Students can register directly. If you are staff and cannot sign in, your
                  administrator holds the account.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/login" className="btn-primary btn-lg">
                  Sign in
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link to="/register" className="btn-secondary btn-lg">
                  Register as a student
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-shell px-4 pb-14 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-10 rounded-3xl border border-line bg-surface/60 p-8 shadow-card backdrop-blur-sm sm:p-10">
          <div className="max-w-xs">
            <Brand size="sm" />
            <p className="mt-4 text-xs leading-relaxed text-ink-subtle">
              Assessment and coursework platform for institutions. Deployed and operated by the
              institution that runs it.
            </p>
          </div>

          <nav
            className="grid grid-cols-2 gap-x-10 gap-y-6 text-[0.8125rem] sm:grid-cols-3 sm:gap-x-14"
            aria-label="Footer"
          >
            {[
              [
                'Platform',
                [
                  ['#cycle', 'How it works'],
                  ['#capabilities', 'Capabilities'],
                  ['#roles', 'Roles'],
                ],
              ],
              [
                'Trust',
                [
                  ['#security', 'Security'],
                  ['#faq', 'FAQ'],
                ],
              ],
              [
                'Account',
                [
                  ['/login', 'Sign in'],
                  ['/register', 'Register'],
                  ['/forgot-password', 'Reset password'],
                ],
              ],
            ].map(([heading, links]) => (
              <div key={heading}>
                <p className="eyebrow mb-3">{heading}</p>
                <ul className="space-y-2">
                  {links.map(([href, label]) =>
                    href.startsWith('#') ? (
                      <li key={href}>
                        <a href={href} className="text-ink-muted transition-colors hover:text-accent">
                          {label}
                        </a>
                      </li>
                    ) : (
                      <li key={href}>
                        <Link to={href} className="text-ink-muted transition-colors hover:text-accent">
                          {label}
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <p className="mt-8 px-2 font-mono text-[0.6875rem] uppercase leading-5 tracking-[0.08em] text-ink-subtle">
          ExamForge — course management, question banks, proctored exams, auto-grading and
          certification.
        </p>
      </footer>
    </div>
  );
}
