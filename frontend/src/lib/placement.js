/**
 * Placement cell shared constants and helpers.
 *
 * BRANCHES must stay in sync with backend/src/utils/branches.ts — the server
 * canonicalises every branch it stores to one of these names, and compares
 * them alias-tolerantly (CSE/CS -> Computer Science, ECE -> Electronics &
 * Communication, ...).
 */
export const BRANCHES = [
  'Computer Science',
  'Information Technology',
  'Artificial Intelligence & Data Science',
  'Electronics & Communication',
  'Electrical',
  'Mechanical',
  'Civil',
  'Chemical',
  'Biotechnology',
  'Aerospace',
  'Instrumentation',
  'Metallurgy',
  'Production & Industrial',
];

/** Short codes for compact chips in tables. */
export const BRANCH_SHORT = {
  'Computer Science': 'CSE',
  'Information Technology': 'IT',
  'Artificial Intelligence & Data Science': 'AI&DS',
  'Electronics & Communication': 'ECE',
  Electrical: 'EE',
  Mechanical: 'ME',
  Civil: 'CE',
  Chemical: 'CHE',
  Biotechnology: 'BT',
  Aerospace: 'AE',
  Instrumentation: 'EIE',
  Metallurgy: 'MME',
  'Production & Industrial': 'PIE',
};

const ALIASES = {
  'Computer Science': ['cse', 'cs', 'computer', 'computer science and engineering', 'computer engineering', 'coe'],
  'Information Technology': ['it', 'information science', 'ise', 'is'],
  'Artificial Intelligence & Data Science': ['ai', 'ads', 'aids', 'ai ds', 'aiml', 'ai ml', 'artificial intelligence', 'data science'],
  'Electronics & Communication': ['ece', 'ec', 'electronics', 'electronics and communications', 'electronics and telecommunication', 'extc', 'entc', 'etc'],
  Electrical: ['ee', 'eee', 'electrical and electronics'],
  Mechanical: ['me', 'mech'],
  Civil: ['ce', 'civ'],
  Chemical: ['che', 'chem'],
  Biotechnology: ['bt', 'biotech'],
  Aerospace: ['ae', 'aero', 'aeronautical'],
  Instrumentation: ['ei', 'eie', 'ice', 'instrumentation and control', 'electronics and instrumentation'],
  Metallurgy: ['mme', 'metallurgical', 'metallurgy and materials'],
  'Production & Industrial': ['pie', 'ip', 'production', 'industrial'],
};

function branchKey(raw) {
  return String(raw)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(b ?tech|b ?e|be|m ?tech|bachelor of technology|bachelor of engineering)( in)? /, '')
    .replace(/ (engineering|engg|engineer|eng)$/, '')
    .trim();
}

const LOOKUP = new Map();
for (const b of BRANCHES) {
  LOOKUP.set(branchKey(b), b);
  for (const a of ALIASES[b] || []) LOOKUP.set(branchKey(a), b);
}

/** Canonical branch for any alias/spelling, or null. */
export function canonicalBranch(raw) {
  if (!raw) return null;
  return LOOKUP.get(branchKey(raw)) ?? null;
}

/* ------------------------------------------------------------------ dates */

const pad = (n) => String(n).padStart(2, '0');

/** A stored timestamp -> the "YYYY-MM-DD" a <input type="date"> shows, in local time. */
export function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today + n days as a date-input value (local). */
export function dateInputFromNow(days) {
  return toDateInput(new Date(Date.now() + days * 86400000));
}

function fromDateInput(value, hours, minutes, seconds, ms) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hours, minutes, seconds, ms);
}

/**
 * A deadline picked as a date closes at the END of that local day. Sending
 * `new Date("YYYY-MM-DD")` instead would mean UTC midnight, which is the
 * previous evening west of UTC and closes the drive hours early in India.
 */
export function deadlineToIso(value) {
  const d = fromDateInput(value, 23, 59, 59, 999);
  return d ? d.toISOString() : null;
}

/** A drive date picked as a date is stored at 10:00 local on that day. */
export function driveDateToIso(value) {
  const d = fromDateInput(value, 10, 0, 0, 0);
  return d ? d.toISOString() : null;
}

/** Whole calendar days until the deadline (0 = closes today, negative = passed). */
export function daysUntil(value) {
  if (!value) return null;
  const d = new Date(value);
  const today = new Date();
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a - b) / 86400000);
}

/* ------------------------------------------------------------ statuses */

export const DRIVE_STATUSES = ['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
export const APPLICATION_STATUSES = ['APPLIED', 'SHORTLISTED', 'INTERVIEWED', 'SELECTED', 'REJECTED'];

export const driveStatusTone = (s) =>
  ({ ACTIVE: 'positive', UPCOMING: 'info', COMPLETED: 'neutral', CANCELLED: 'critical' })[s] ?? 'neutral';

export const applicationStatusTone = (s) =>
  ({ APPLIED: 'neutral', SHORTLISTED: 'info', INTERVIEWED: 'accent', SELECTED: 'positive', REJECTED: 'critical' })[s] ??
  'neutral';

export const APPLICATION_STATUS_LABEL = {
  APPLIED: 'Applied - under review',
  SHORTLISTED: 'Shortlisted',
  INTERVIEWED: 'Interviewed',
  SELECTED: 'Selected',
  REJECTED: 'Not selected',
};

/** Pull a readable message out of an API error. */
export function apiError(err, fallback = 'Something went wrong') {
  return err?.response?.data?.message || err?.message || fallback;
}
