import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import {
  Badge,
  EmptyState,
  ErrorAlert,
  Field,
  Modal,
  PageHeader,
  Spinner,
} from '../../components/ui.jsx';
import { useToast } from '../../components/toast.jsx';
import {
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Video,
  ShieldCheck,
  Search,
  Users,
  Eye,
  Clock,
  ExternalLink,
  Filter,
  Check,
  ShieldAlert,
  Building,
} from 'lucide-react';

export function ProctorPlacementPage() {
  const [candidates, setCandidates] = useState([]);
  const [stats, setStats] = useState(null);
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedDrive, setSelectedDrive] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Proctor Action Modal
  const [actionCandidate, setActionCandidate] = useState(null);
  const [proctorStatus, setProctorStatus] = useState('CLEARED');
  const [proctorNotes, setProctorNotes] = useState('');
  const [assessmentScore, setAssessmentScore] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toast = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [candidatesRes, statsRes, drivesRes] = await Promise.all([
        api.get('/placements/proctor/candidates'),
        api.get('/placements/proctor/stats'),
        api.get('/placements/drives'),
      ]);

      setCandidates(candidatesRes.data?.data?.candidates || []);
      setStats(statsRes.data?.data?.stats || null);
      setDrives(drivesRes.data?.data?.drives || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load proctor data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openActionModal = (candidate) => {
    setActionCandidate(candidate);
    setProctorStatus(candidate.proctorStatus || 'CLEARED');
    setProctorNotes(candidate.proctorNotes || '');
    setAssessmentScore(candidate.assessmentScore?.toString() || '');
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!actionCandidate) return;

    try {
      setSubmitting(true);
      const payload = {
        proctorStatus,
        proctorNotes: proctorNotes.trim() || undefined,
        assessmentScore: assessmentScore ? parseFloat(assessmentScore) : undefined,
      };

      await api.patch(`/placements/proctor/candidates/${actionCandidate.id}`, payload);
      toast.success(`Candidate assessment invigilation status updated to ${proctorStatus}`);
      setActionCandidate(null);
      await loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update proctoring status');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    if (selectedDrive !== 'ALL' && c.driveId !== selectedDrive) return false;
    if (selectedStatus !== 'ALL' && c.proctorStatus !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.student?.fullName?.toLowerCase().includes(q);
      const matchRoll = c.student?.placementProfile?.rollNumber?.toLowerCase().includes(q);
      const matchCompany = c.drive?.companyName?.toLowerCase().includes(q);
      if (!matchName && !matchRoll && !matchCompany) return false;
    }
    return true;
  });

  if (loading) return <Spinner label="Loading Placement Assessment Invigilation…" />;
  if (error) return <ErrorAlert error={error} />;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Placement Assessment Invigilation"
        description="Monitor online screening tests, verify candidate identities, issue malpractice warnings, and clear students for corporate interviews."
        eyebrow="Proctor Operations"
      />

      {/* Proctor KPI Summary */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-subtle uppercase">Candidates Monitored</span>
              <Users className="h-4 w-4 text-accent" />
            </div>
            <p className="mt-2 text-2xl font-bold text-ink">{stats.totalInvigilated ?? 0}</p>
            <span className="text-[11px] text-ink-muted">In assessment pipeline</span>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-subtle uppercase">Cleared for Interviews</span>
              <CheckCircle2 className="h-4 w-4 text-positive" />
            </div>
            <p className="mt-2 text-2xl font-bold text-positive-ink">{stats.clearedCount ?? 0}</p>
            <span className="text-[11px] text-positive-ink/80">Malpractice-free verified</span>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-subtle uppercase">Flagged Sessions</span>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </div>
            <p className="mt-2 text-2xl font-bold text-warning-ink">{stats.flaggedCount ?? 0}</p>
            <span className="text-[11px] text-warning-ink/80">Tab switch / face alerts</span>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-subtle uppercase">Disqualified</span>
              <XCircle className="h-4 w-4 text-critical" />
            </div>
            <p className="mt-2 text-2xl font-bold text-critical-ink">{stats.disqualifiedCount ?? 0}</p>
            <span className="text-[11px] text-critical-ink/80">Sanctioned for malpractice</span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-ink-subtle" />
            <input
              type="text"
              placeholder="Search candidate, roll, company..."
              className="input input-sm pl-9 text-xs w-64 bg-canvas"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="input input-sm text-xs bg-canvas"
            value={selectedDrive}
            onChange={(e) => setSelectedDrive(e.target.value)}
          >
            <option value="ALL">All Company Drives</option>
            {drives.map((d) => (
              <option key={d.id} value={d.id}>
                {d.companyName} ({d.role})
              </option>
            ))}
          </select>

          <select
            className="input input-sm text-xs bg-canvas"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="ALL">All Proctoring Statuses</option>
            <option value="IN_PROGRESS">IN_PROGRESS (Live)</option>
            <option value="CLEARED">CLEARED (Passed)</option>
            <option value="FLAGGED">FLAGGED (Warning)</option>
            <option value="DISQUALIFIED">DISQUALIFIED</option>
            <option value="NOT_STARTED">NOT_STARTED</option>
          </select>
        </div>

        <button
          onClick={loadData}
          className="btn btn-secondary btn-sm text-xs"
        >
          Refresh Live Stream
        </button>
      </div>

      {/* Candidates Invigilation Grid / Table */}
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-ink">Assessment Candidates Live Feed</h3>
            <p className="text-xs text-ink-muted">Manage active placement test sessions and log proctoring audits</p>
          </div>
          <span className="text-xs font-semibold text-ink-subtle">{filteredCandidates.length} candidates</span>
        </div>

        {filteredCandidates.length === 0 ? (
          <EmptyState
            title="No candidates match filters"
            description="No candidates are currently active in the selected assessment filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-line text-ink-subtle uppercase tracking-wider text-[11px]">
                  <th className="pb-3 pr-4 font-semibold">Candidate</th>
                  <th className="pb-3 pr-4 font-semibold">Company Drive</th>
                  <th className="pb-3 pr-4 font-semibold">Current Round</th>
                  <th className="pb-3 pr-4 font-semibold">Score</th>
                  <th className="pb-3 pr-4 font-semibold">Proctor Status</th>
                  <th className="pb-3 pr-4 font-semibold">Invigilator Audit Notes</th>
                  <th className="pb-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredCandidates.map((c) => (
                  <tr key={c.id} className="hover:bg-canvas/50">
                    <td className="py-3.5 pr-4">
                      <strong className="text-ink text-sm block">
                        {c.student?.placementProfile?.fullName || c.student?.fullName || c.student?.username}
                      </strong>
                      <span className="text-ink-subtle text-[11px]">
                        Roll: {c.student?.placementProfile?.rollNumber || 'N/A'} • {c.student?.placementProfile?.branch}
                      </span>
                    </td>

                    <td className="py-3.5 pr-4">
                      <div className="font-bold text-ink">{c.drive?.companyName}</div>
                      <div className="text-ink-muted text-[11px]">{c.drive?.role}</div>
                    </td>

                    <td className="py-3.5 pr-4">
                      <span className="rounded-md bg-canvas px-2.5 py-1 text-[11px] font-semibold text-ink">
                        {c.currentRound || 'Online Assessment'}
                      </span>
                    </td>

                    <td className="py-3.5 pr-4">
                      {c.assessmentScore !== null && c.assessmentScore !== undefined ? (
                        <span className="font-mono font-bold text-positive-ink text-sm">
                          {c.assessmentScore}%
                        </span>
                      ) : (
                        <span className="text-ink-subtle">—</span>
                      )}
                    </td>

                    <td className="py-3.5 pr-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          c.proctorStatus === 'CLEARED'
                            ? 'bg-positive-soft text-positive-ink ring-1 ring-positive/30'
                            : c.proctorStatus === 'FLAGGED'
                            ? 'bg-warning-soft text-warning-ink ring-1 ring-warning/30'
                            : c.proctorStatus === 'DISQUALIFIED'
                            ? 'bg-critical-soft text-critical-ink ring-1 ring-critical/30'
                            : c.proctorStatus === 'IN_PROGRESS'
                            ? 'bg-accent-soft text-accent ring-1 ring-accent/30 animate-pulse'
                            : 'bg-canvas text-ink ring-1 ring-line'
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {c.proctorStatus === 'IN_PROGRESS' ? 'Live Session' : c.proctorStatus}
                      </span>
                    </td>

                    <td className="py-3.5 pr-4 max-w-xs truncate text-[11px] text-ink-muted">
                      {c.proctorNotes || 'No audit flags recorded'}
                    </td>

                    <td className="py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => openActionModal(c)}
                        className="btn btn-primary btn-xs text-xs inline-flex items-center gap-1"
                      >
                        <ShieldCheck className="h-3 w-3" />
                        <span>Invigilate / Clear</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* INVIGILATION ACTION MODAL */}
      {actionCandidate && (
        <Modal
          open={Boolean(actionCandidate)}
          onClose={() => setActionCandidate(null)}
          title={`Invigilate: ${actionCandidate.student?.fullName || 'Candidate'}`}
        >
          <form onSubmit={handleUpdateStatus} className="space-y-4 text-xs">
            <div className="rounded-xl border border-line bg-canvas p-3 space-y-1">
              <p><strong>Candidate:</strong> {actionCandidate.student?.fullName} (Roll: {actionCandidate.student?.placementProfile?.rollNumber})</p>
              <p><strong>Company Drive:</strong> {actionCandidate.drive?.companyName} — {actionCandidate.drive?.role}</p>
              <p><strong>Branch & CGPA:</strong> {actionCandidate.student?.placementProfile?.branch} • {actionCandidate.student?.placementProfile?.cgpa} CGPA</p>
            </div>

            <Field label="Assessment Proctor Status" required>
              <select
                className="input input-sm w-full font-semibold"
                value={proctorStatus}
                onChange={(e) => setProctorStatus(e.target.value)}
                required
              >
                <option value="CLEARED">✓ CLEARED (No Malpractice • Advance to Interview)</option>
                <option value="IN_PROGRESS">⟳ IN_PROGRESS (Active Online Assessment)</option>
                <option value="FLAGGED">⚠ FLAGGED (Suspicious / Tab Switch Warning Issued)</option>
                <option value="DISQUALIFIED">✕ DISQUALIFIED (Malpractice Confirmed)</option>
                <option value="NOT_STARTED">NOT_STARTED</option>
              </select>
            </Field>

            <Field label="Assessment Test Score (0 - 100%)">
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                placeholder="e.g. 94.5"
                className="input input-sm w-full font-mono font-bold"
                value={assessmentScore}
                onChange={(e) => setAssessmentScore(e.target.value)}
              />
            </Field>

            <Field label="Proctor Audit Notes / Identity Verification Log">
              <textarea
                rows={3}
                placeholder="e.g. Student ID verified. Full webcam feed compliant. Zero tab switch violations recorded during 90 minutes."
                className="input input-sm w-full text-xs"
                value={proctorNotes}
                onChange={(e) => setProctorNotes(e.target.value)}
              />
            </Field>

            <div className="pt-3 border-t border-line flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActionCandidate(null)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary btn-sm inline-flex items-center gap-1.5"
              >
                {submitting ? <Spinner size="sm" /> : <Check className="h-4 w-4" />}
                <span>Save Invigilation Audit</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
export default ProctorPlacementPage;
