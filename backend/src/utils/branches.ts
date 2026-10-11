/**
 * Canonical engineering branch list used by placement profiles and drives.
 *
 * Students and admins used to type branches as free text, so "CSE" on a
 * profile never matched "Computer Science" on a drive. Every write is now
 * canonicalised through `canonicalBranch`, and every eligibility comparison
 * goes through `branchMatches`, which also tolerates legacy free-text rows.
 *
 * Keep in sync with frontend/src/lib/branches.js.
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
] as const;

export type Branch = (typeof BRANCHES)[number];

const ALIASES: Record<Branch, string[]> = {
  'Computer Science': [
    'cse', 'cs', 'comp sci', 'compsci', 'computer', 'computers', 'computer science',
    'computer science and engineering', 'computer engineering', 'coe', 'cse core',
  ],
  'Information Technology': ['it', 'information technology', 'information science', 'ise', 'is'],
  'Artificial Intelligence & Data Science': [
    'ai', 'ads', 'aids', 'ai ds', 'aiml', 'ai ml', 'artificial intelligence',
    'data science', 'artificial intelligence and data science',
    'artificial intelligence and machine learning',
  ],
  'Electronics & Communication': [
    'ece', 'ec', 'electronics', 'electronics and communication', 'electronics and communications',
    'electronics and telecommunication', 'extc', 'entc', 'etc', 'electronics communication',
  ],
  Electrical: ['ee', 'eee', 'electrical', 'electrical and electronics', 'electrical electronics'],
  Mechanical: ['me', 'mech', 'mechanical'],
  Civil: ['ce', 'civ', 'civil'],
  Chemical: ['che', 'chem', 'chemical'],
  Biotechnology: ['bt', 'biotech', 'biotechnology', 'bio technology'],
  Aerospace: ['ae', 'aero', 'aerospace', 'aeronautical', 'aeronautics'],
  Instrumentation: [
    'ei', 'eie', 'ice', 'in', 'instrumentation', 'instrumentation and control',
    'electronics and instrumentation',
  ],
  Metallurgy: ['mme', 'mt', 'metallurgy', 'metallurgical', 'metallurgy and materials', 'materials'],
  'Production & Industrial': ['pie', 'ip', 'production', 'industrial', 'production and industrial'],
};

/** Lower-case, "&" -> "and", drop punctuation, degree prefixes and a trailing "engineering". */
export function branchKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(b ?tech|b ?e|be|m ?tech|bachelor of technology|bachelor of engineering)( in)? /, '')
    .replace(/ (engineering|engg|engineer|eng)$/, '')
    .trim();
}

const LOOKUP = new Map<string, Branch>();
for (const branch of BRANCHES) {
  LOOKUP.set(branchKey(branch), branch);
  for (const alias of ALIASES[branch]) LOOKUP.set(branchKey(alias), branch);
}

/** Canonical branch name for any spelling/alias, or null when unrecognised. */
export function canonicalBranch(raw: string | null | undefined): Branch | null {
  if (!raw || typeof raw !== 'string') return null;
  const key = branchKey(raw);
  if (!key) return null;
  return LOOKUP.get(key) ?? null;
}

/** Comparison key: canonical name when known, otherwise the normalised text. */
function compareKey(raw: string): string {
  return canonicalBranch(raw) ?? branchKey(raw);
}

/** True when the student's branch is in the drive's list (alias/case/spacing tolerant). */
export function branchMatches(studentBranch: string | null | undefined, allowed: string[]): boolean {
  if (!studentBranch) return false;
  const mine = compareKey(studentBranch);
  return allowed.some((b) => typeof b === 'string' && compareKey(b) === mine);
}

/** Canonicalise a list, dropping duplicates; returns the unknown entries separately. */
export function canonicalBranchList(list: string[]): { branches: Branch[]; unknown: string[] } {
  const branches: Branch[] = [];
  const unknown: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string' || !item.trim()) continue;
    const c = canonicalBranch(item);
    if (!c) unknown.push(item.trim());
    else if (!branches.includes(c)) branches.push(c);
  }
  return { branches, unknown };
}

/** Read a drive's JSON branch column defensively. */
export function readBranchList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}
