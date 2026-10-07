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
  CheckCircle,
  ExternalLink,
  Plus,
  Trash2,
  Users,
  Building,
  GraduationCap,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
} from 'lucide-react';

export function AdminPlacementPage() {
  const [stats, setStats] = useState(null);
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Drive create/edit modal
  const [driveModal, setDriveModal] = useState(false);
  const [editingDrive, setEditingDrive] = useState(null);
  const [formDrive, setFormDrive] = useState({
    companyName: '',
    role: '',
    description: '',
    driveType: 'ON_CAMPUS',
    eligibilityCgpa: '7.0',
    eligibleBranches: 'Computer Science, Information Technology',
    maxBacklogs: '0',
    minTenthPercent: '70',
    minTwelfthPercent: '70',
    batchYear: '2026',
    ctcLpa: '12.0',
    location: 'Bangalore / Hybrid',
    deadline: '',
    driveDate: '',
    status: 'ACTIVE',
  });
  const [savingDrive, setSavingDrive] = useState(false);

  // Applicants modal
  const [viewingApplicantsDrive, setViewingApplicantsDrive] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  const toast = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, drivesRes] = await Promise.all([
        api.get('/placements/stats').catch(() => ({ data: { data: { stats: null } } })),
        api.get('/placements/drives'),
      ]);
      setStats(statsRes.data?.data?.stats || null);
      setDrives(drivesRes.data?.data?.drives || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load placement data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingDrive(null);
    setFormDrive({
      companyName: '',
      role: '',
      description: '',
      driveType: 'ON_CAMPUS',
      eligibilityCgpa: '7.0',
      eligibleBranches: 'Computer Science, Information Technology',
      maxBacklogs: '0',
      minTenthPercent: '70',
      minTwelfthPercent: '70',
      batchYear: '2026',
      ctcLpa: '12.0',
      location: 'Bangalore / Hybrid',
      deadline: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      driveDate: new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0],
      status: 'ACTIVE',
    });
    setDriveModal(true);
  };

  const openEditModal = (drive) => {
    setEditingDrive(drive);
    setFormDrive({
      companyName: drive.companyName || '',
      role: drive.role || '',
      description: drive.description || '',
      driveType: drive.driveType || 'ON_CAMPUS',
      eligibilityCgpa: drive.eligibilityCgpa?.toString() || '0.0',
      eligibleBranches: Array.isArray(drive.eligibleBranches) ? drive.eligibleBranches.join(', ') : '',
      maxBacklogs: drive.maxBacklogs !== undefined ? drive.maxBacklogs.toString() : '0',
      minTenthPercent: drive.minTenthPercent !== undefined && drive.minTenthPercent !== null ? drive.minTenthPercent.toString() : '',
      minTwelfthPercent: drive.minTwelfthPercent !== undefined && drive.minTwelfthPercent !== null ? drive.minTwelfthPercent.toString() : '',
      batchYear: drive.batchYear !== undefined && drive.batchYear !== null ? drive.batchYear.toString() : '2026',
      ctcLpa: drive.ctcLpa?.toString() || '',
      location: drive.location || '',
      deadline: drive.deadline ? new Date(drive.deadline).toISOString().split('T')[0] : '',
      driveDate: drive.driveDate ? new Date(drive.driveDate).toISOString().split('T')[0] : '',
      status: drive.status || 'ACTIVE',
    });
    setDriveModal(true);
  };

  const handleSaveDrive = async (e) => {
    e.preventDefault();
    if (!formDrive.companyName.trim() || !formDrive.role.trim() || !formDrive.deadline) {
      toast.error('Company Name, Role, and Deadline are required');
      return;
    }

    try {
      setSavingDrive(true);
      const payload = {
        companyName: formDrive.companyName.trim(),
        role: formDrive.role.trim(),
        description: formDrive.description.trim() || undefined,
        driveType: formDrive.driveType,
        eligibilityCgpa: parseFloat(formDrive.eligibilityCgpa) || 0,
        eligibleBranches: formDrive.eligibleBranches
          ? formDrive.eligibleBranches.split(',').map((b) => b.trim()).filter(Boolean)
          : [],
        maxBacklogs: formDrive.maxBacklogs ? parseInt(formDrive.maxBacklogs, 10) : 0,
        minTenthPercent: formDrive.minTenthPercent ? parseFloat(formDrive.minTenthPercent) : undefined,
        minTwelfthPercent: formDrive.minTwelfthPercent ? parseFloat(formDrive.minTwelfthPercent) : undefined,
        batchYear: formDrive.batchYear ? parseInt(formDrive.batchYear, 10) : undefined,
        ctcLpa: formDrive.ctcLpa ? parseFloat(formDrive.ctcLpa) : undefined,
        location: formDrive.location.trim() || undefined,
        deadline: new Date(formDrive.deadline).toISOString(),
        driveDate: formDrive.driveDate ? new Date(formDrive.driveDate).toISOString() : undefined,
        status: formDrive.status,
      };

      if (editingDrive) {
        await api.put(`/placements/drives/${editingDrive.id}`, payload);
        toast.success('Placement drive updated successfully!');
      } else {
        await api.post('/placements/drives', payload);
        toast.success('Placement drive created successfully!');
      }

      setDriveModal(false);
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save drive');
    } finally {
      setSavingDrive(false);
    }
  };

  const handleDeleteDrive = async (driveId) => {
    if (!window.confirm('Are you sure you want to delete this placement drive? All applications will be removed.')) {
      return;
    }
    try {
      await api.delete(`/placements/drives/${driveId}`);
      toast.success('Placement drive deleted successfully');
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete drive');
    }
  };

  const handleOpenApplicants = async (drive) => {
    setViewingApplicantsDrive(drive);
    try {
      setLoadingApplicants(true);
      const res = await api.get(`/placements/drives/${drive.id}`);
      setApplicants(res.data?.data?.drive?.applications || []);
    } catch (err) {
      toast.error('Failed to load drive applicants');
    } finally {
      setLoadingApplicants(false);
    }
  };

  const handleUpdateApplicantStatus = async (appId, newStatus, currentNotes) => {
    try {
      await api.patch(`/placements/applications/${appId}/status`, {
        status: newStatus,
        notes: currentNotes,
      });
      toast.success(`Applicant status updated to ${newStatus}`);
      if (viewingApplicantsDrive) {
        const res = await api.get(`/placements/drives/${viewingApplicantsDrive.id}`);
        setApplicants(res.data?.data?.drive?.applications || []);
      }
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update applicant status');
    }
  };

  if (loading) return <Spinner label="Loading Placement Operations…" />;
  if (error) return <ErrorAlert error={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training & Placement Cell Operations"
        description="Corporate drive management, candidate eligibility shortlisting, and placement statistics."
        eyebrow="Placement Administration"
      >
        <button
          type="button"
          onClick={openCreateModal}
          className="btn btn-primary inline-flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          <span>New Recruitment Drive</span>
        </button>
      </PageHeader>

      {/* Statistics Overview */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-subtle uppercase">Active Drives</span>
              <Briefcase className="h-4 w-4 text-accent" />
            </div>
            <p className="mt-2 text-2xl font-bold text-ink">{stats.activeDrives ?? 0}</p>
            <span className="text-[11px] text-ink-muted">Total: {stats.totalDrives ?? 0} drives</span>
          </div>

          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-subtle uppercase">Applications</span>
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-ink">{stats.totalApplications ?? 0}</p>
            <span className="text-[11px] text-ink-muted">Across all drives</span>
          </div>

          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-subtle uppercase">Placed / Selected</span>
              <CheckCircle className="h-4 w-4 text-positive" />
            </div>
            <p className="mt-2 text-2xl font-bold text-positive-ink">{stats.selectedCount ?? 0}</p>
            <span className="text-[11px] text-ink-muted">Offers secured</span>
          </div>

          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-subtle uppercase">Avg CTC Package</span>
              <span className="text-xs font-bold text-accent">₹</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-ink">
              {stats.averageCtc ? `₹${stats.averageCtc.toFixed(1)} LPA` : '—'}
            </p>
            <span className="text-[11px] text-ink-muted">Highest: {stats.highestCtc ? `₹${stats.highestCtc} LPA` : '—'}</span>
          </div>
        </div>
      )}

      {/* Drives Management Table */}
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-ink">Campus & Off-Campus Drives</h3>
            <p className="text-xs text-ink-muted">Manage active recruiting drives and review registered applicants</p>
          </div>
          <span className="text-xs font-semibold text-ink-subtle">{drives.length} total drives</span>
        </div>

        {drives.length === 0 ? (
          <EmptyState
            title="No placement drives created"
            description="Create your first placement drive to allow students to verify eligibility and apply."
            action={
              <button onClick={openCreateModal} className="btn btn-sm btn-primary">
                Create First Drive
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-ink-subtle uppercase tracking-wider text-[11px]">
                  <th className="pb-3 pr-4 font-semibold">Company & Role</th>
                  <th className="pb-3 pr-4 font-semibold">Type</th>
                  <th className="pb-3 pr-4 font-semibold">Criteria (CGPA/Backlogs/Batch)</th>
                  <th className="pb-3 pr-4 font-semibold">CTC (LPA)</th>
                  <th className="pb-3 pr-4 font-semibold">Deadline</th>
                  <th className="pb-3 pr-4 font-semibold">Applicants</th>
                  <th className="pb-3 pr-4 font-semibold">Status</th>
                  <th className="pb-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {drives.map((drive) => (
                  <tr key={drive.id} className="hover:bg-canvas/50">
                    <td className="py-3.5 pr-4">
                      <div className="font-bold text-ink text-sm">{drive.companyName}</div>
                      <div className="text-ink-muted">{drive.role}</div>
                      <div className="text-[11px] text-ink-subtle mt-0.5">{drive.location || 'Remote/Hybrid'}</div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          drive.driveType === 'ON_CAMPUS'
                            ? 'bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                        }`}
                      >
                        {drive.driveType === 'ON_CAMPUS' ? 'On-Campus' : 'Off-Campus'}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 space-y-0.5 text-[11px]">
                      <div>Min CGPA: <strong>{drive.eligibilityCgpa > 0 ? drive.eligibilityCgpa : 'Open'}</strong></div>
                      <div>Max Backlogs: <strong>{drive.maxBacklogs ?? 0}</strong></div>
                      {drive.batchYear && <div>Batch: <strong>{drive.batchYear}</strong></div>}
                    </td>
                    <td className="py-3.5 pr-4 font-bold text-positive-ink text-sm">
                      {drive.ctcLpa ? `₹${drive.ctcLpa} LPA` : '—'}
                    </td>
                    <td className="py-3.5 pr-4 text-ink-muted">
                      {new Date(drive.deadline).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 pr-4">
                      <button
                        type="button"
                        onClick={() => handleOpenApplicants(drive)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent hover:text-white transition-colors"
                      >
                        <Users className="h-3.5 w-3.5" />
                        <span>{drive.applicantCount || 0} candidates</span>
                      </button>
                    </td>
                    <td className="py-3.5 pr-4">
                      <Badge
                        tone={
                          drive.status === 'ACTIVE'
                            ? 'positive'
                            : drive.status === 'COMPLETED'
                            ? 'neutral'
                            : drive.status === 'CANCELLED'
                            ? 'critical'
                            : 'warning'
                        }
                      >
                        {drive.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(drive)}
                        className="btn btn-ghost btn-xs text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDrive(drive.id)}
                        className="btn btn-ghost btn-xs text-critical-ink hover:bg-critical-soft"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT DRIVE MODAL */}
      {driveModal && (
        <Modal
          open={driveModal}
          onClose={() => setDriveModal(false)}
          title={editingDrive ? `Edit ${editingDrive.companyName} Drive` : 'New Placement Drive'}
        >
          <form onSubmit={handleSaveDrive} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company Name" required>
                <input
                  type="text"
                  required
                  value={formDrive.companyName}
                  onChange={(e) => setFormDrive({ ...formDrive, companyName: e.target.value })}
                  placeholder="e.g. Google, Microsoft, Amazon"
                  className="input input-sm w-full"
                />
              </Field>

              <Field label="Job Role / Designation" required>
                <input
                  type="text"
                  required
                  value={formDrive.role}
                  onChange={(e) => setFormDrive({ ...formDrive, role: e.target.value })}
                  placeholder="e.g. Software Engineer Intern"
                  className="input input-sm w-full"
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Drive Type">
                <select
                  value={formDrive.driveType}
                  onChange={(e) => setFormDrive({ ...formDrive, driveType: e.target.value })}
                  className="input input-sm w-full"
                >
                  <option value="ON_CAMPUS">ON_CAMPUS</option>
                  <option value="OFF_CAMPUS">OFF_CAMPUS</option>
                </select>
              </Field>

              <Field label="Drive Status">
                <select
                  value={formDrive.status}
                  onChange={(e) => setFormDrive({ ...formDrive, status: e.target.value })}
                  className="input input-sm w-full"
                >
                  <option value="UPCOMING">UPCOMING</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </Field>

              <Field label="Package CTC (LPA)">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formDrive.ctcLpa}
                  onChange={(e) => setFormDrive({ ...formDrive, ctcLpa: e.target.value })}
                  placeholder="e.g. 18.5"
                  className="input input-sm w-full font-mono font-semibold"
                />
              </Field>
            </div>

            {/* Criteria Grid */}
            <div className="grid grid-cols-4 gap-3 p-3 rounded-xl bg-canvas border border-line">
              <Field label="Min CGPA Cutoff">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={formDrive.eligibilityCgpa}
                  onChange={(e) => setFormDrive({ ...formDrive, eligibilityCgpa: e.target.value })}
                  placeholder="7.5"
                  className="input input-sm w-full font-mono"
                />
              </Field>

              <Field label="Max Active Backlogs">
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={formDrive.maxBacklogs}
                  onChange={(e) => setFormDrive({ ...formDrive, maxBacklogs: e.target.value })}
                  placeholder="0"
                  className="input input-sm w-full font-mono"
                />
              </Field>

              <Field label="Target Batch Year">
                <input
                  type="number"
                  min="2020"
                  max="2035"
                  value={formDrive.batchYear}
                  onChange={(e) => setFormDrive({ ...formDrive, batchYear: e.target.value })}
                  placeholder="2026"
                  className="input input-sm w-full font-mono"
                />
              </Field>

              <Field label="Min 10th %">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formDrive.minTenthPercent}
                  onChange={(e) => setFormDrive({ ...formDrive, minTenthPercent: e.target.value })}
                  placeholder="70"
                  className="input input-sm w-full font-mono"
                />
              </Field>
            </div>

            <Field label="Eligible Branches (comma separated)">
              <input
                type="text"
                value={formDrive.eligibleBranches}
                onChange={(e) => setFormDrive({ ...formDrive, eligibleBranches: e.target.value })}
                placeholder="Computer Science, Information Technology, Electronics"
                className="input input-sm w-full text-xs"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Location">
                <input
                  type="text"
                  value={formDrive.location}
                  onChange={(e) => setFormDrive({ ...formDrive, location: e.target.value })}
                  placeholder="e.g. Bangalore / Hybrid"
                  className="input input-sm w-full"
                />
              </Field>

              <Field label="Application Deadline" required>
                <input
                  type="date"
                  required
                  value={formDrive.deadline}
                  onChange={(e) => setFormDrive({ ...formDrive, deadline: e.target.value })}
                  className="input input-sm w-full"
                />
              </Field>
            </div>

            <Field label="Job Description & Criteria Details">
              <textarea
                rows={3}
                value={formDrive.description}
                onChange={(e) => setFormDrive({ ...formDrive, description: e.target.value })}
                placeholder="Role requirements, technical skills expected, selection stages..."
                className="input input-sm w-full text-xs"
              />
            </Field>

            <div className="pt-4 border-t border-line flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDriveModal(false)}
                className="btn btn-sm btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingDrive}
                className="btn btn-sm btn-primary"
              >
                {savingDrive ? 'Saving...' : editingDrive ? 'Update Drive' : 'Publish Drive'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* APPLICANTS REVIEW MODAL */}
      {viewingApplicantsDrive && (
        <Modal
          open={Boolean(viewingApplicantsDrive)}
          onClose={() => setViewingApplicantsDrive(null)}
          title={`Applicants: ${viewingApplicantsDrive.companyName} (${viewingApplicantsDrive.role})`}
        >
          <div className="space-y-4">
            {loadingApplicants ? (
              <Spinner label="Loading applicants..." />
            ) : applicants.length === 0 ? (
              <EmptyState
                title="No applicants yet"
                description="No registered students have submitted applications for this recruitment drive yet."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-line text-ink-subtle uppercase tracking-wider text-[10px]">
                      <th className="pb-2.5 pr-3 font-semibold">Student Name & Roll</th>
                      <th className="pb-2.5 pr-3 font-semibold">Academic Credentials</th>
                      <th className="pb-2.5 pr-3 font-semibold">Resume Dossier</th>
                      <th className="pb-2.5 pr-3 font-semibold">Applied On</th>
                      <th className="pb-2.5 pr-3 font-semibold">Status</th>
                      <th className="pb-2.5 pr-3 font-semibold">Change Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {applicants.map((app) => (
                      <tr key={app.id} className="hover:bg-canvas/50">
                        <td className="py-3 pr-3">
                          <strong className="text-ink block font-semibold">
                            {app.student?.placementProfile?.fullName || app.student?.fullName || app.student?.username}
                          </strong>
                          <span className="text-[11px] text-ink-subtle">
                            {app.student?.placementProfile?.rollNumber || app.student?.email}
                          </span>
                        </td>
                        <td className="py-3 pr-3 space-y-0.5">
                          <div className="text-ink font-medium">{app.student?.placementProfile?.branch || 'N/A'}</div>
                          <div className="text-positive-ink font-bold">
                            CGPA: {app.student?.placementProfile?.cgpa ?? '—'}
                          </div>
                          <div className="text-ink-subtle text-[10px]">
                            Backlogs: {app.student?.placementProfile?.activeBacklogs ?? 0} • Batch: {app.student?.placementProfile?.graduationYear ?? '—'}
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          {app.student?.placementProfile?.resumeUrl ? (
                            <a
                              href={app.student?.placementProfile?.resumeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-accent underline hover:opacity-80"
                            >
                              <span>View Resume</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-ink-subtle">No resume URL</span>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-ink-muted">
                          {new Date(app.appliedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 pr-3">
                          <Badge
                            tone={
                              app.status === 'SELECTED'
                                ? 'positive'
                                : app.status === 'SHORTLISTED'
                                ? 'blue'
                                : app.status === 'REJECTED'
                                ? 'critical'
                                : 'neutral'
                            }
                          >
                            {app.status}
                          </Badge>
                        </td>
                        <td className="py-3 pr-3">
                          <select
                            value={app.status}
                            onChange={(e) =>
                              handleUpdateApplicantStatus(app.id, e.target.value, app.notes)
                            }
                            className="input input-xs text-[11px] bg-canvas"
                          >
                            <option value="APPLIED">APPLIED</option>
                            <option value="SHORTLISTED">SHORTLISTED</option>
                            <option value="INTERVIEWED">INTERVIEWED</option>
                            <option value="SELECTED">SELECTED</option>
                            <option value="REJECTED">REJECTED</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-3 border-t border-line flex justify-end">
              <button
                type="button"
                onClick={() => setViewingApplicantsDrive(null)}
                className="btn btn-sm btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default AdminPlacementPage;
