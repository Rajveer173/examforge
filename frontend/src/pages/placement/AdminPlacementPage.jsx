import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client.js';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorAlert,
  Field,
  Modal,
  PageHeader,
  Spinner,
  StatTile,
} from '../../components/ui.jsx';
import { useToast } from '../../components/toast.jsx';
import { formatDate, formatDateTime } from '../../lib/format.js';
import {
  APPLICATION_STATUSES,
  BRANCHES,
  BRANCH_SHORT,
  DRIVE_STATUSES,
  apiError,
  applicationStatusTone,
  canonicalBranch,
  dateInputFromNow,
  deadlineToIso,
  driveDateToIso,
  driveStatusTone,
  toDateInput,
} from '../../lib/placement.js';
import {
  Briefcase,
  CheckCircle2,
  ExternalLink,
  FileText,
  Code2,
  IndianRupee,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';

const SELECTION_ROUNDS = ['Resume Screening', 'Online Assessment', 'Technical Interview', 'HR Round'];

const EMPTY_FORM = {
  selectionProcess: SELECTION_ROUNDS.join(', '),
  companyName: '',
  role: '',
  description: '',
  driveType: 'ON_CAMPUS',
  status: 'ACTIVE',
  eligibilityCgpa: '7.0',
  eligibleBranches: ['Computer Science', 'Information Technology'],
  maxBacklogs: '0',
  minTenthPercent: '60',
  minTwelfthPercent: '60',
  batchYear: String(new Date().getFullYear() + 1),
  ctcLpa: '',
  location: '',
  deadline: '',
  driveDate: '',
};

const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

/** Client-side checks mirroring the API so most mistakes never leave the form. */
function validateDrive(f, { isEdit, originalDeadline }) {
  const e = {};
  if (!f.companyName.trim()) e.companyName = 'Company name is required';
  if (!f.role.trim()) e.role = 'Role is required';
  const range = (key, label, min, max, { int = false } = {}) => {
    if (f[key] === '' || f[key] === null) return;
    const n = Number(f[key]);
    if (Number.isNaN(n)) e[key] = `${label} must be a number`;
    else if (n < min || n > max) e[key] = `${label} must be between ${min} and ${max}`;
    else if (int && !Number.isInteger(n)) e[key] = `${label} must be a whole number`;
  };
  range('eligibilityCgpa', 'Minimum CGPA', 0, 10);
  range('maxBacklogs', 'Max backlogs', 0, 50, { int: true });
  range('minTenthPercent', '10th %', 0, 100);
  range('minTwelfthPercent', '12th %', 0, 100);
  range('batchYear', 'Batch year', 2000, 2040, { int: true });
  range('ctcLpa', 'CTC', 0, 1000);
  if (!f.deadline) e.deadline = 'Application deadline is required';
  else {
    const open = f.status === 'ACTIVE' || f.status === 'UPCOMING';
    const changed = !isEdit || f.deadline !== originalDeadline;
    if (open && changed && new Date(deadlineToIso(f.deadline)) < new Date()) {
      e.deadline = 'Deadline must be today or later for an Active/Upcoming drive';
    }
  }
  if (f.driveDate && f.deadline && f.driveDate < f.deadline) {
    e.driveDate = 'Drive date cannot be before the application deadline';
  }
  return e;
}

function BranchChips({ value, onChange }) {
  const toggle = (b) => onChange(value.includes(b) ? value.filter((x) => x !== b) : [...value, b]);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {BRANCHES.map((b) => {
          const on = value.includes(b);
          return (
            <button
              key={b}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(b)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                on
                  ? 'bg-accent text-accent-on shadow-sm'
                  : 'border border-line bg-canvas text-ink-muted hover:border-accent hover:text-ink'
              }`}
            >
              {on && <CheckCircle2 className="mr-1 inline-block h-3 w-3" />}
              {b}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-ink-subtle">
        <span>
          {value.length === 0 ? 'Open to all branches' : `${value.length} branch${value.length === 1 ? '' : 'es'} selected`}
        </span>
        <button type="button" className="text-accent hover:underline" onClick={() => onChange([...BRANCHES])}>
          Select all
        </button>
        <button type="button" className="text-accent hover:underline" onClick={() => onChange([])}>
          Clear (all branches)
        </button>
      </div>
    </div>
  );
}

function ApplicantRow({ app, onSave, rounds = SELECTION_ROUNDS, showDrive = false }) {
  const p = app.student?.placementProfile;
  const scoreOf = (a) => (a.assessmentScore ?? '') === '' ? '' : String(a.assessmentScore);
  const [status, setStatus] = useState(app.status);
  const [round, setRound] = useState(app.currentRound || rounds[0]);
  const [score, setScore] = useState(scoreOf(app));
  const [notes, setNotes] = useState(app.notes || '');
  const [saving, setSaving] = useState(false);
  const dirty =
    status !== app.status ||
    round !== (app.currentRound || rounds[0]) ||
    score !== scoreOf(app) ||
    (notes || '') !== (app.notes || '');

  useEffect(() => {
    setStatus(app.status);
    setRound(app.currentRound || rounds[0]);
    setScore(scoreOf(app));
    setNotes(app.notes || '');
  }, [app.status, app.currentRound, app.assessmentScore, app.notes]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true);
    await onSave(app.id, { status, currentRound: round, assessmentScore: score === '' ? null : Number(score), notes });
    setSaving(false);
  };

  return (
    <tr className="align-top">
      <td className="py-3 pr-3">
        {showDrive && app.drive && (
          <div className="mb-1 text-[11px] font-semibold text-accent-ink">
            {app.drive.companyName} · {app.drive.role}
          </div>
        )}
        <div className="font-semibold text-ink">{p?.fullName || app.student?.fullName || app.student?.username}</div>
        <div className="text-[11px] text-ink-subtle">{p?.rollNumber || '—'}</div>
        <div className="text-[11px] text-ink-subtle">{app.student?.email}</div>
        {p?.phone && <div className="text-[11px] text-ink-subtle">{p.phone}</div>}
      </td>
      <td className="py-3 pr-3 text-xs">
        {p ? (
          <>
            <div className="font-medium text-ink">{p.branch || '—'}</div>
            <div>
              CGPA <strong className="text-ink">{p.cgpa}</strong> · Backlogs <strong className="text-ink">{p.activeBacklogs ?? 0}</strong>
            </div>
            <div className="text-ink-subtle">
              10th {p.tenthPercentage ?? '—'}% · 12th {p.twelfthPercentage ?? '—'}% · Batch {p.graduationYear ?? '—'}
            </div>
          </>
        ) : (
          <span className="text-ink-subtle">No placement profile</span>
        )}
      </td>
      <td className="py-3 pr-3 text-xs">
        <div className="flex flex-col gap-1">
          {p?.resumeUrl ? (
            <a href={p.resumeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
              <FileText className="h-3 w-3" /> Resume <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          ) : (
            <span className="text-ink-subtle">No resume</span>
          )}
          {p?.githubUrl && (
            <a href={p.githubUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
              <Code2 className="h-3 w-3" /> GitHub
            </a>
          )}
          {p?.linkedinUrl && (
            <a href={p.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
              <Link2 className="h-3 w-3" /> LinkedIn
            </a>
          )}
        </div>
      </td>
      <td className="py-3 pr-3 text-xs text-ink-muted whitespace-nowrap">{formatDate(app.appliedAt)}</td>
      <td className="py-3 pr-3 min-w-[15rem]">
        <div className="flex items-center gap-2">
          <Badge tone={applicationStatusTone(app.status)}>{app.status}</Badge>
        </div>
        <div className="mt-2 flex flex-col gap-2">
          <select
            aria-label="Application status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input h-9 text-xs"
          >
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              aria-label="Current selection round"
              value={round}
              onChange={(e) => setRound(e.target.value)}
              className="input h-9 flex-1 text-xs"
            >
              {[...new Set([...rounds, 'Offer Released', round])].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <input
              aria-label="Assessment score (%)"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="Score %"
              className="input h-9 w-24 text-xs"
            />
          </div>
          <textarea
            aria-label="Notes for this applicant"
            rows={2}
            value={notes}
            maxLength={2000}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (round feedback, offer details…)"
            className="input min-h-0 py-2 text-xs"
          />
          <Button size="sm" variant={dirty ? 'primary' : 'secondary'} disabled={!dirty} loading={saving} onClick={save}>
            Save
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function AdminPlacementPage() {
  const [stats, setStats] = useState(null);
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Drive create/edit modal
  const [driveModal, setDriveModal] = useState(false);
  const [editingDrive, setEditingDrive] = useState(null);
  const [formDrive, setFormDrive] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [savingDrive, setSavingDrive] = useState(false);

  // Delete confirmation
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Applicants modal
  const [viewingDrive, setViewingDrive] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [applicantFilter, setApplicantFilter] = useState('ALL');

  // Candidates (every application) and student profile tabs
  const [tab, setTab] = useState('drives');
  const [candidates, setCandidates] = useState(null);
  const [candidateDrive, setCandidateDrive] = useState('ALL');
  const [candidateStatus, setCandidateStatus] = useState('ALL');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [profiles, setProfiles] = useState(null);
  const [profileSearch, setProfileSearch] = useState('');
  const [profileBranch, setProfileBranch] = useState('ALL');
  const [verifying, setVerifying] = useState(null);

  const toast = useToast();

  const loadData = async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setLoading(true);
      setError(null);
      const [statsRes, drivesRes] = await Promise.all([api.get('/placements/stats'), api.get('/placements/drives')]);
      setStats(statsRes.data?.data?.stats || null);
      setDrives(drivesRes.data?.data?.drives || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const set = (key) => (e) => setFormDrive((f) => ({ ...f, [key]: e.target.value }));

  const openCreateModal = () => {
    setEditingDrive(null);
    setFormDrive({ ...EMPTY_FORM, deadline: dateInputFromNow(14), driveDate: dateInputFromNow(21) });
    setFormErrors({});
    setServerError(null);
    setDriveModal(true);
  };

  const openEditModal = (drive) => {
    setEditingDrive(drive);
    const branches = Array.isArray(drive.eligibleBranches) ? drive.eligibleBranches : [];
    setFormDrive({
      companyName: drive.companyName || '',
      role: drive.role || '',
      description: drive.description || '',
      driveType: drive.driveType || 'ON_CAMPUS',
      status: drive.status || 'ACTIVE',
      eligibilityCgpa: drive.eligibilityCgpa != null ? String(drive.eligibilityCgpa) : '',
      eligibleBranches: Array.from(new Set(branches.map((b) => canonicalBranch(b) || b))).filter((b) => BRANCHES.includes(b)),
      maxBacklogs: drive.maxBacklogs != null ? String(drive.maxBacklogs) : '0',
      minTenthPercent: drive.minTenthPercent != null ? String(drive.minTenthPercent) : '',
      minTwelfthPercent: drive.minTwelfthPercent != null ? String(drive.minTwelfthPercent) : '',
      batchYear: drive.batchYear != null ? String(drive.batchYear) : '',
      ctcLpa: drive.ctcLpa != null ? String(drive.ctcLpa) : '',
      location: drive.location || '',
      selectionProcess: (Array.isArray(drive.selectionProcess) && drive.selectionProcess.length
        ? drive.selectionProcess
        : SELECTION_ROUNDS
      ).join(', '),
      deadline: toDateInput(drive.deadline),
      driveDate: toDateInput(drive.driveDate),
    });
    setFormErrors({});
    setServerError(null);
    setDriveModal(true);
  };

  const handleSaveDrive = async (e) => {
    e.preventDefault();
    const errs = validateDrive(formDrive, {
      isEdit: Boolean(editingDrive),
      originalDeadline: editingDrive ? toDateInput(editingDrive.deadline) : null,
    });
    setFormErrors(errs);
    setServerError(null);
    if (Object.keys(errs).length) return;

    const payload = {
      companyName: formDrive.companyName.trim(),
      role: formDrive.role.trim(),
      description: formDrive.description.trim() || null,
      driveType: formDrive.driveType,
      status: formDrive.status,
      eligibilityCgpa: numOrNull(formDrive.eligibilityCgpa) ?? 0,
      eligibleBranches: formDrive.eligibleBranches,
      maxBacklogs: numOrNull(formDrive.maxBacklogs) ?? 0,
      minTenthPercent: numOrNull(formDrive.minTenthPercent),
      minTwelfthPercent: numOrNull(formDrive.minTwelfthPercent),
      batchYear: numOrNull(formDrive.batchYear),
      ctcLpa: numOrNull(formDrive.ctcLpa),
      location: formDrive.location.trim() || null,
      selectionProcess: formDrive.selectionProcess
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean),
      driveDate: formDrive.driveDate ? driveDateToIso(formDrive.driveDate) : null,
    };
    // Re-sending an unchanged deadline would shift it to end-of-day local time;
    // only send it when the admin actually changed the date.
    if (!editingDrive || formDrive.deadline !== toDateInput(editingDrive.deadline)) {
      payload.deadline = deadlineToIso(formDrive.deadline);
    }

    try {
      setSavingDrive(true);
      if (editingDrive) {
        await api.put(`/placements/drives/${editingDrive.id}`, payload);
        toast.success(`${payload.companyName} drive updated`);
      } else {
        await api.post('/placements/drives', payload);
        toast.success(`${payload.companyName} drive published`);
      }
      setDriveModal(false);
      loadData({ quiet: true });
    } catch (err) {
      setServerError(apiError(err, 'Failed to save drive'));
    } finally {
      setSavingDrive(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      setDeleteBusy(true);
      await api.delete(`/placements/drives/${deleting.id}`);
      toast.success(`${deleting.companyName} drive deleted`);
      setDeleting(null);
      loadData({ quiet: true });
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete drive'));
    } finally {
      setDeleteBusy(false);
    }
  };

  const fetchApplicants = async (driveId) => {
    const res = await api.get(`/placements/drives/${driveId}`);
    setApplicants(res.data?.data?.drive?.applications || []);
  };

  const handleOpenApplicants = async (drive) => {
    setViewingDrive(drive);
    setApplicants([]);
    setApplicantFilter('ALL');
    try {
      setLoadingApplicants(true);
      await fetchApplicants(drive.id);
    } catch (err) {
      toast.error(apiError(err, 'Failed to load applicants'));
    } finally {
      setLoadingApplicants(false);
    }
  };

  const loadCandidates = async () => {
    try {
      const res = await api.get('/placements/proctor/candidates');
      setCandidates(res.data?.data?.candidates || []);
    } catch (err) {
      toast.error(apiError(err, 'Failed to load candidates'));
      setCandidates([]);
    }
  };

  const loadProfiles = async () => {
    try {
      const res = await api.get('/placements/profiles');
      setProfiles(res.data?.data?.profiles || []);
    } catch (err) {
      toast.error(apiError(err, 'Failed to load student profiles'));
      setProfiles([]);
    }
  };

  useEffect(() => {
    if (tab === 'candidates' && candidates === null) loadCandidates();
    if (tab === 'profiles' && profiles === null) loadProfiles();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVerifyProfile = async (profile, isVerified) => {
    try {
      setVerifying(profile.id);
      await api.patch(`/placements/profiles/${profile.id}/verify`, { isVerified });
      toast.success(`${profile.fullName} ${isVerified ? 'verified' : 'marked unverified'}`);
      await loadProfiles();
    } catch (err) {
      toast.error(apiError(err, 'Failed to update profile'));
    } finally {
      setVerifying(null);
    }
  };

  const handleUpdateApplicant = async (appId, changes) => {
    try {
      await api.patch(`/placements/applications/${appId}/status`, changes);
      toast.success(`Applicant updated: ${changes.status} · ${changes.currentRound}`);
      if (viewingDrive) await fetchApplicants(viewingDrive.id);
      if (candidates !== null) loadCandidates();
      loadData({ quiet: true });
    } catch (err) {
      toast.error(apiError(err, 'Failed to update applicant'));
    }
  };

  const visibleDrives = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drives.filter((d) => {
      if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
      if (!q) return true;
      return [d.companyName, d.role, d.location].some((v) => v?.toLowerCase().includes(q));
    });
  }, [drives, statusFilter, search]);

  const visibleApplicants = applicants.filter((a) => applicantFilter === 'ALL' || a.status === applicantFilter);

  if (loading) return <Spinner label="Loading placement operations…" />;
  if (error) return <ErrorAlert error={error} onRetry={() => loadData()} />;

  const byStatus = stats?.applicationsByStatus || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Placement Cell"
        description="Publish recruitment drives, review applicants and move them through the selection pipeline."
        eyebrow="Placement administration"
        actions={
          <Button variant="primary" icon={Plus} onClick={openCreateModal}>
            New drive
          </Button>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            label="Open drives"
            value={(stats.activeDrives ?? 0) + (stats.upcomingDrives ?? 0)}
            hint={`${stats.activeDrives ?? 0} active · ${stats.upcomingDrives ?? 0} upcoming · ${stats.totalDrives ?? 0} total`}
            icon={Briefcase}
            tone="accent"
          />
          <StatTile
            label="Applications"
            value={stats.totalApplications ?? 0}
            hint={`${byStatus.SHORTLISTED ?? 0} shortlisted · ${byStatus.INTERVIEWED ?? 0} interviewed`}
            icon={Users}
            tone="info"
          />
          <StatTile
            label="Students placed"
            value={stats.placedStudents ?? 0}
            hint={`${stats.placementRate ?? 0}% of ${stats.totalRegisteredStudents ?? 0} registered`}
            icon={CheckCircle2}
            tone="positive"
          />
          <StatTile
            label="Average CTC"
            value={stats.averageCtc != null ? `₹${stats.averageCtc} LPA` : '—'}
            hint={`Highest: ${stats.highestCtc != null ? `₹${stats.highestCtc} LPA` : '—'}`}
            icon={IndianRupee}
            tone="neutral"
          />
        </div>
      )}

      <div role="tablist" aria-label="Placement sections" className="inline-flex rounded-full p-1" style={{ backgroundColor: 'rgb(var(--fill) / var(--fill-alpha))' }}>
        {[
          ['drives', 'Drives', drives.length],
          ['candidates', 'Candidates', stats?.totalApplications ?? null],
          ['profiles', 'Student profiles', stats?.totalRegisteredStudents ?? null],
        ].map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              tab === id ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {label}
            {count != null && <span className="ml-1.5 text-xs text-ink-subtle">{count}</span>}
          </button>
        ))}
      </div>

      {tab === 'drives' && (
      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-ink">Recruitment drives</h3>
            <p className="text-xs text-ink-muted">
              {visibleDrives.length} of {drives.length} drives
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company, role, location"
                aria-label="Search drives"
                className="input h-9 w-56 pl-8 text-xs"
              />
            </div>
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input h-9 w-36 text-xs"
            >
              <option value="ALL">All statuses</option>
              {DRIVE_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {drives.length === 0 ? (
          <EmptyState
            title="No placement drives yet"
            description="Create the first drive so students can check their eligibility and apply."
            action={
              <Button variant="primary" size="sm" icon={Plus} onClick={openCreateModal}>
                Create first drive
              </Button>
            }
          />
        ) : visibleDrives.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">No drives match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-subtle">
                  <th className="pb-3 pr-4 font-semibold">Company & role</th>
                  <th className="pb-3 pr-4 font-semibold">Eligibility</th>
                  <th className="pb-3 pr-4 font-semibold">CTC</th>
                  <th className="pb-3 pr-4 font-semibold">Dates</th>
                  <th className="pb-3 pr-4 font-semibold">Applicants</th>
                  <th className="pb-3 pr-4 font-semibold">Status</th>
                  <th className="pb-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visibleDrives.map((drive) => {
                  const branches = Array.isArray(drive.eligibleBranches) ? drive.eligibleBranches : [];
                  const sc = drive.statusCounts || {};
                  return (
                    <tr key={drive.id} className="align-top hover:bg-canvas/50">
                      <td className="py-3.5 pr-4">
                        <div className="text-sm font-bold text-ink">{drive.companyName}</div>
                        <div className="text-ink-muted">{drive.role}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-subtle">
                          <Badge tone={drive.driveType === 'ON_CAMPUS' ? 'accent' : 'info'}>
                            {drive.driveType === 'ON_CAMPUS' ? 'On-campus' : 'Off-campus'}
                          </Badge>
                          <span>{drive.location || 'Location TBA'}</span>
                        </div>
                      </td>
                      <td className="space-y-0.5 py-3.5 pr-4 text-[11px]">
                        <div>
                          CGPA ≥ <strong>{drive.eligibilityCgpa > 0 ? drive.eligibilityCgpa : 'any'}</strong> · Backlogs ≤{' '}
                          <strong>{drive.maxBacklogs ?? 0}</strong>
                        </div>
                        <div>
                          10th ≥ <strong>{drive.minTenthPercent ? `${drive.minTenthPercent}%` : 'any'}</strong> · 12th ≥{' '}
                          <strong>{drive.minTwelfthPercent ? `${drive.minTwelfthPercent}%` : 'any'}</strong>
                        </div>
                        <div>Batch: <strong>{drive.batchYear || 'any'}</strong></div>
                        <div className="flex max-w-[16rem] flex-wrap gap-1 pt-0.5">
                          {branches.length === 0 ? (
                            <span className="text-ink-subtle">All branches</span>
                          ) : (
                            branches.map((b) => (
                              <span key={b} title={b} className="rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                                {BRANCH_SHORT[b] || b}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 pr-4 text-sm font-bold text-positive-ink whitespace-nowrap">
                        {drive.ctcLpa != null ? `₹${drive.ctcLpa} LPA` : '—'}
                      </td>
                      <td className="py-3.5 pr-4 text-[11px] text-ink-muted whitespace-nowrap">
                        <div>
                          Apply by <strong className="text-ink">{formatDateTime(drive.deadline)}</strong>
                        </div>
                        {drive.isExpired && <div className="font-semibold text-critical-ink">Deadline passed</div>}
                        <div>Drive: {drive.driveDate ? formatDate(drive.driveDate) : 'TBA'}</div>
                      </td>
                      <td className="py-3.5 pr-4">
                        <Button size="sm" variant="secondary" icon={Users} onClick={() => handleOpenApplicants(drive)}>
                          {drive.applicantCount || 0}
                        </Button>
                        {(sc.SHORTLISTED || sc.SELECTED) > 0 && (
                          <div className="mt-1 text-[10px] text-ink-subtle">
                            {sc.SHORTLISTED || 0} shortlisted · {sc.SELECTED || 0} selected
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 pr-4">
                        <Badge tone={driveStatusTone(drive.status)}>{drive.status}</Badge>
                      </td>
                      <td className="py-3.5 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEditModal(drive)} aria-label={`Edit ${drive.companyName} drive`}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Trash2}
                          onClick={() => setDeleting(drive)}
                          aria-label={`Delete ${drive.companyName} drive`}
                          className="text-critical-ink hover:bg-critical-soft"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {tab === 'candidates' && (
        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-ink">All candidates</h3>
              <p className="text-xs text-ink-muted">
                Every application across drives. Move candidates between rounds, record test scores and decisions.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Search candidates"
                  placeholder="Name, roll no., email…"
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  className="input h-9 w-56 pl-9 text-xs"
                />
              </div>
              <select aria-label="Filter by drive" value={candidateDrive} onChange={(e) => setCandidateDrive(e.target.value)} className="input h-9 w-48 text-xs">
                <option value="ALL">All drives</option>
                {drives.map((d) => (
                  <option key={d.id} value={d.id}>{d.companyName} · {d.role}</option>
                ))}
              </select>
              <select aria-label="Filter by status" value={candidateStatus} onChange={(e) => setCandidateStatus(e.target.value)} className="input h-9 w-36 text-xs">
                <option value="ALL">All statuses</option>
                {APPLICATION_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          {candidates === null ? (
            <Spinner label="Loading candidates…" />
          ) : (
            (() => {
              const q = candidateSearch.trim().toLowerCase();
              const rows = candidates.filter((c) => {
                if (candidateDrive !== 'ALL' && c.driveId !== candidateDrive) return false;
                if (candidateStatus !== 'ALL' && c.status !== candidateStatus) return false;
                if (!q) return true;
                const p = c.student?.placementProfile;
                return [p?.fullName, p?.rollNumber, c.student?.fullName, c.student?.email, c.drive?.companyName].some((v) =>
                  v?.toLowerCase().includes(q),
                );
              });
              if (rows.length === 0) return <p className="py-10 text-center text-sm text-ink-muted">No candidates match these filters.</p>;
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-line text-[11px] text-ink-subtle">
                        <th className="pb-3 pr-3 font-semibold">Candidate</th>
                        <th className="pb-3 pr-3 font-semibold">Academics</th>
                        <th className="pb-3 pr-3 font-semibold">Links</th>
                        <th className="pb-3 pr-3 font-semibold">Applied</th>
                        <th className="pb-3 font-semibold">Decision</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {rows.map((c) => (
                        <ApplicantRow
                          key={c.id}
                          app={c}
                          showDrive
                          rounds={
                            Array.isArray(c.drive?.selectionProcess) && c.drive.selectionProcess.length
                              ? c.drive.selectionProcess
                              : SELECTION_ROUNDS
                          }
                          onSave={handleUpdateApplicant}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()
          )}
        </div>
      )}

      {tab === 'profiles' && (
        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-ink">Student placement profiles</h3>
              <p className="text-xs text-ink-muted">Check each student's academic record and verify it before they apply.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Search profiles"
                  placeholder="Name or roll no.…"
                  value={profileSearch}
                  onChange={(e) => setProfileSearch(e.target.value)}
                  className="input h-9 w-56 pl-9 text-xs"
                />
              </div>
              <select aria-label="Filter by branch" value={profileBranch} onChange={(e) => setProfileBranch(e.target.value)} className="input h-9 w-48 text-xs">
                <option value="ALL">All branches</option>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>
          {profiles === null ? (
            <Spinner label="Loading profiles…" />
          ) : (
            (() => {
              const q = profileSearch.trim().toLowerCase();
              const rows = profiles.filter((p) => {
                if (profileBranch !== 'ALL' && (canonicalBranch(p.branch) || p.branch) !== profileBranch) return false;
                return !q || [p.fullName, p.rollNumber, p.user?.email].some((v) => v?.toLowerCase().includes(q));
              });
              if (rows.length === 0) return <p className="py-10 text-center text-sm text-ink-muted">No profiles match these filters.</p>;
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-line text-[11px] text-ink-subtle">
                        <th className="pb-3 pr-3 font-semibold">Student</th>
                        <th className="pb-3 pr-3 font-semibold">Branch</th>
                        <th className="pb-3 pr-3 font-semibold">CGPA</th>
                        <th className="pb-3 pr-3 font-semibold">10th / 12th</th>
                        <th className="pb-3 pr-3 font-semibold">Backlogs</th>
                        <th className="pb-3 pr-3 font-semibold">Batch</th>
                        <th className="pb-3 pr-3 font-semibold">Resume</th>
                        <th className="pb-3 text-right font-semibold">Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {rows.map((p) => (
                        <tr key={p.id} className="align-middle">
                          <td className="py-3 pr-3">
                            <div className="font-semibold text-ink">{p.fullName}</div>
                            <div className="text-[11px] text-ink-subtle">{p.rollNumber || '—'} · {p.user?.email}</div>
                          </td>
                          <td className="py-3 pr-3">{p.branch || '—'}</td>
                          <td className="py-3 pr-3 font-semibold text-ink">{p.cgpa}</td>
                          <td className="py-3 pr-3">{p.tenthPercentage ?? '—'}% / {p.twelfthPercentage ?? '—'}%</td>
                          <td className="py-3 pr-3">{p.activeBacklogs ?? 0}</td>
                          <td className="py-3 pr-3">{p.graduationYear ?? '—'}</td>
                          <td className="py-3 pr-3">
                            {p.resumeUrl ? (
                              <a href={p.resumeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-ink hover:underline">
                                <FileText className="h-3 w-3" /> View
                              </a>
                            ) : (
                              <span className="text-ink-subtle">—</span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Badge tone={p.isVerified ? 'positive' : 'caution'}>{p.isVerified ? 'Verified' : 'Pending'}</Badge>
                              <Button
                                size="sm"
                                variant={p.isVerified ? 'secondary' : 'primary'}
                                loading={verifying === p.id}
                                onClick={() => handleVerifyProfile(p, !p.isVerified)}
                              >
                                {p.isVerified ? 'Unverify' : 'Verify'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* CREATE / EDIT DRIVE */}
      <Modal
        open={driveModal}
        onClose={() => !savingDrive && setDriveModal(false)}
        width="xl"
        title={editingDrive ? `Edit ${editingDrive.companyName} drive` : 'New placement drive'}
        description="Students only see eligibility against the criteria you set here."
      >
        <form onSubmit={handleSaveDrive} noValidate className="space-y-5">
          {serverError && <ErrorAlert error={serverError} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name" required error={formErrors.companyName} htmlFor="pd-company">
              <input id="pd-company" className="input" value={formDrive.companyName} onChange={set('companyName')} placeholder="e.g. Google" maxLength={200} />
            </Field>
            <Field label="Role / designation" required error={formErrors.role} htmlFor="pd-role">
              <input id="pd-role" className="input" value={formDrive.role} onChange={set('role')} placeholder="e.g. Software Engineer (New Grad)" maxLength={200} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Drive type" htmlFor="pd-type">
              <select id="pd-type" className="input" value={formDrive.driveType} onChange={set('driveType')}>
                <option value="ON_CAMPUS">On-campus</option>
                <option value="OFF_CAMPUS">Off-campus</option>
              </select>
            </Field>
            <Field label="Status" htmlFor="pd-status" hint="Only Active/Upcoming drives accept applications">
              <select id="pd-status" className="input" value={formDrive.status} onChange={set('status')}>
                {DRIVE_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="CTC (LPA)" error={formErrors.ctcLpa} htmlFor="pd-ctc">
              <input id="pd-ctc" type="number" step="0.1" min="0" className="input" value={formDrive.ctcLpa} onChange={set('ctcLpa')} placeholder="e.g. 18.5" />
            </Field>
            <Field label="Location" htmlFor="pd-loc">
              <input id="pd-loc" className="input" value={formDrive.location} onChange={set('location')} placeholder="e.g. Bengaluru / Hybrid" maxLength={200} />
            </Field>
          </div>

          <Field label="Selection rounds" hint="Comma separated, in order" htmlFor="pd-rounds">
            <input id="pd-rounds" className="input" value={formDrive.selectionProcess} onChange={set('selectionProcess')} placeholder="Resume Screening, Online Assessment, Technical Interview, HR Round" maxLength={600} />
          </Field>

          <fieldset className="rounded-xl border border-line bg-canvas p-4">
            <legend className="px-1 text-xs font-bold uppercase tracking-wider text-ink-muted">Eligibility criteria</legend>
            <div className="grid gap-4 sm:grid-cols-5">
              <Field label="Min CGPA" error={formErrors.eligibilityCgpa} htmlFor="pd-cgpa">
                <input id="pd-cgpa" type="number" step="0.01" min="0" max="10" className="input" value={formDrive.eligibilityCgpa} onChange={set('eligibilityCgpa')} placeholder="0 = any" />
              </Field>
              <Field label="Max backlogs" error={formErrors.maxBacklogs} htmlFor="pd-backlogs">
                <input id="pd-backlogs" type="number" min="0" step="1" className="input" value={formDrive.maxBacklogs} onChange={set('maxBacklogs')} />
              </Field>
              <Field label="Min 10th %" error={formErrors.minTenthPercent} htmlFor="pd-tenth">
                <input id="pd-tenth" type="number" min="0" max="100" step="0.1" className="input" value={formDrive.minTenthPercent} onChange={set('minTenthPercent')} placeholder="any" />
              </Field>
              <Field label="Min 12th %" error={formErrors.minTwelfthPercent} htmlFor="pd-twelfth">
                <input id="pd-twelfth" type="number" min="0" max="100" step="0.1" className="input" value={formDrive.minTwelfthPercent} onChange={set('minTwelfthPercent')} placeholder="any" />
              </Field>
              <Field label="Batch year" error={formErrors.batchYear} htmlFor="pd-batch">
                <input id="pd-batch" type="number" min="2000" max="2040" step="1" className="input" value={formDrive.batchYear} onChange={set('batchYear')} placeholder="any" />
              </Field>
            </div>
            <div className="mt-4">
              <span className="label">Eligible branches</span>
              <BranchChips
                value={formDrive.eligibleBranches}
                onChange={(eligibleBranches) => setFormDrive((f) => ({ ...f, eligibleBranches }))}
              />
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Application deadline" required error={formErrors.deadline} hint="Applications close at 11:59 pm on this day" htmlFor="pd-deadline">
              <input id="pd-deadline" type="date" className="input" value={formDrive.deadline} onChange={set('deadline')} />
            </Field>
            <Field label="Drive / interview date" error={formErrors.driveDate} htmlFor="pd-drivedate">
              <input id="pd-drivedate" type="date" className="input" value={formDrive.driveDate} onChange={set('driveDate')} min={formDrive.deadline || undefined} />
            </Field>
          </div>

          <Field label="Job description & selection process" htmlFor="pd-desc">
            <textarea id="pd-desc" rows={4} className="input" value={formDrive.description} onChange={set('description')} maxLength={5000} placeholder="Responsibilities, skills expected, selection rounds…" />
          </Field>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={() => setDriveModal(false)} disabled={savingDrive}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={savingDrive}>
              {editingDrive ? 'Save changes' : 'Publish drive'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION */}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteBusy}
        title={deleting ? `Delete ${deleting.companyName} drive?` : 'Delete drive?'}
        description={
          deleting
            ? `"${deleting.role}" and its ${deleting.applicantCount || 0} application${deleting.applicantCount === 1 ? '' : 's'} will be permanently removed.`
            : ''
        }
        confirmLabel="Delete drive"
      />

      {/* APPLICANTS */}
      <Modal
        open={Boolean(viewingDrive)}
        onClose={() => setViewingDrive(null)}
        width="xl"
        title={viewingDrive ? `Applicants · ${viewingDrive.companyName}` : 'Applicants'}
        description={viewingDrive ? `${viewingDrive.role} · ${applicants.length} applicant${applicants.length === 1 ? '' : 's'}` : undefined}
      >
        <div className="space-y-4">
          {applicants.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {['ALL', ...APPLICATION_STATUSES].map((s) => {
                const count = s === 'ALL' ? applicants.length : applicants.filter((a) => a.status === s).length;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setApplicantFilter(s)}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                      applicantFilter === s ? 'bg-accent text-accent-on' : 'bg-surface-sunken text-ink-muted hover:text-ink'
                    }`}
                  >
                    {s === 'ALL' ? 'All' : s} ({count})
                  </button>
                );
              })}
            </div>
          )}
          {loadingApplicants ? (
            <Spinner label="Loading applicants…" />
          ) : applicants.length === 0 ? (
            <EmptyState title="No applicants yet" description="No student has applied to this drive yet." />
          ) : visibleApplicants.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">No applicants with this status.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-subtle">
                    <th className="pb-2.5 pr-3 font-semibold">Student</th>
                    <th className="pb-2.5 pr-3 font-semibold">Academics</th>
                    <th className="pb-2.5 pr-3 font-semibold">Links</th>
                    <th className="pb-2.5 pr-3 font-semibold">Applied</th>
                    <th className="pb-2.5 pr-3 font-semibold">Stage & notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visibleApplicants.map((app) => (
                    <ApplicantRow
                      key={app.id}
                      app={app}
                      rounds={
                        Array.isArray(viewingDrive?.selectionProcess) && viewingDrive.selectionProcess.length
                          ? viewingDrive.selectionProcess
                          : SELECTION_ROUNDS
                      }
                      onSave={handleUpdateApplicant}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default AdminPlacementPage;
