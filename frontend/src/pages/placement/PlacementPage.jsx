import { useEffect, useState, useMemo } from 'react';
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
  Building,
  CheckCircle2,
  Clock,
  ExternalLink,
  GraduationCap,
  MapPin,
  Search,
  Sparkles,
  UserCheck,
  XCircle,
  FileText,
  Award,
  AlertCircle,
  Calendar,
  DollarSign,
  Filter,
  ArrowRight,
  ChevronRight,
  Info,
  SlidersHorizontal,
  Check,
  Edit3,
  ShieldCheck,
  Send,
} from 'lucide-react';

const COMMON_SKILLS = [
  'React', 'Node.js', 'TypeScript', 'JavaScript', 'Python', 'Java',
  'C++', 'SQL', 'MongoDB', 'Docker', 'AWS', 'Data Structures & Algorithms',
  'System Design', 'Git', 'Next.js', 'Machine Learning'
];

const DEPARTMENTS = [
  'Computer Science',
  'Information Technology',
  'Electronics & Communication',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Artificial Intelligence & Data Science',
];

export function PlacementPage() {
  const [activeTab, setActiveTab] = useState('eligible'); // 'eligible' | 'all' | 'applications' | 'profile'
  const [profile, setProfile] = useState(null);
  const [drives, setDrives] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDrive, setSelectedDrive] = useState(null);
  const [applyModalDrive, setApplyModalDrive] = useState(null);
  const [applying, setApplying] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'ON_CAMPUS' | 'OFF_CAMPUS'
  const [searchQuery, setSearchQuery] = useState('');

  // Profile form state
  const [formProfile, setFormProfile] = useState({
    fullName: '',
    rollNumber: '',
    phone: '',
    branch: 'Computer Science',
    cgpa: '',
    tenthPercentage: '',
    twelfthPercentage: '',
    activeBacklogs: '0',
    graduationYear: '2026',
    skills: '',
    resumeUrl: '',
    githubUrl: '',
    linkedinUrl: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const toast = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [profileRes, drivesRes, appsRes] = await Promise.all([
        api.get('/placements/profile').catch(() => ({ data: { data: { profile: null } } })),
        api.get('/placements/drives'),
        api.get('/placements/applications').catch(() => ({ data: { data: { applications: [] } } })),
      ]);

      const prof = profileRes.data?.data?.profile || null;
      setProfile(prof);
      if (prof) {
        setFormProfile({
          fullName: prof.fullName || '',
          rollNumber: prof.rollNumber || '',
          phone: prof.phone || '',
          branch: prof.branch || 'Computer Science',
          cgpa: prof.cgpa !== undefined ? prof.cgpa.toString() : '',
          tenthPercentage: prof.tenthPercentage !== undefined && prof.tenthPercentage !== null ? prof.tenthPercentage.toString() : '',
          twelfthPercentage: prof.twelfthPercentage !== undefined && prof.twelfthPercentage !== null ? prof.twelfthPercentage.toString() : '',
          activeBacklogs: prof.activeBacklogs !== undefined ? prof.activeBacklogs.toString() : '0',
          graduationYear: prof.graduationYear !== undefined && prof.graduationYear !== null ? prof.graduationYear.toString() : '2026',
          skills: Array.isArray(prof.skills) ? prof.skills.join(', ') : '',
          resumeUrl: prof.resumeUrl || '',
          githubUrl: prof.githubUrl || '',
          linkedinUrl: prof.linkedinUrl || '',
        });
      }

      setDrives(drivesRes.data?.data?.drives || []);
      setApplications(appsRes.data?.data?.applications || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load placement data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const hasCompleteProfile = useMemo(() => {
    return Boolean(
      profile &&
      profile.fullName &&
      profile.branch &&
      profile.cgpa !== undefined &&
      profile.cgpa !== null &&
      Number(profile.cgpa) > 0
    );
  }, [profile]);

  const handleSkillToggle = (skill) => {
    const current = formProfile.skills
      ? formProfile.skills.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    if (current.includes(skill)) {
      setFormProfile({
        ...formProfile,
        skills: current.filter((s) => s !== skill).join(', '),
      });
    } else {
      setFormProfile({
        ...formProfile,
        skills: [...current, skill].join(', '),
      });
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!formProfile.fullName.trim()) {
      toast.error('Full Name is required');
      return;
    }
    const cgpaNum = parseFloat(formProfile.cgpa);
    if (isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 10) {
      toast.error('Please enter a valid CGPA between 0.0 and 10.0');
      return;
    }

    try {
      setSavingProfile(true);
      const payload = {
        fullName: formProfile.fullName.trim(),
        rollNumber: formProfile.rollNumber.trim() || undefined,
        phone: formProfile.phone.trim() || undefined,
        branch: formProfile.branch.trim() || undefined,
        cgpa: cgpaNum,
        tenthPercentage: formProfile.tenthPercentage ? parseFloat(formProfile.tenthPercentage) : undefined,
        twelfthPercentage: formProfile.twelfthPercentage ? parseFloat(formProfile.twelfthPercentage) : undefined,
        activeBacklogs: formProfile.activeBacklogs ? parseInt(formProfile.activeBacklogs, 10) : 0,
        graduationYear: formProfile.graduationYear ? parseInt(formProfile.graduationYear, 10) : 2026,
        skills: formProfile.skills ? formProfile.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
        resumeUrl: formProfile.resumeUrl.trim() || undefined,
        githubUrl: formProfile.githubUrl.trim() || undefined,
        linkedinUrl: formProfile.linkedinUrl.trim() || undefined,
      };

      const res = await api.post('/placements/profile', payload);
      const savedProf = res.data?.data?.profile;
      setProfile(savedProf);
      setIsRegistering(false);
      toast.success('Placement profile registered and verified!');
      // Switch directly to eligible drives view
      setActiveTab('eligible');
      await loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save placement profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleApply = async (driveId) => {
    try {
      setApplying(true);
      await api.post(`/placements/drives/${driveId}/apply`);
      toast.success('Application submitted successfully!');
      setApplyModalDrive(null);
      setSelectedDrive(null);
      await loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to apply for drive');
    } finally {
      setApplying(false);
    }
  };

  const handleWithdraw = async (driveId) => {
    if (!window.confirm('Are you sure you want to withdraw your application?')) return;
    try {
      await api.post(`/placements/drives/${driveId}/withdraw`);
      toast.success('Application withdrawn successfully');
      await loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to withdraw application');
    }
  };

  if (loading) return <Spinner label="Loading Placement Portal…" />;
  if (error) return <ErrorAlert error={error} />;

  // Filter drives based on tab and query
  const eligibleDrives = drives.filter((d) => d.isEligible);
  const displayedDrives = drives.filter((d) => {
    if (activeTab === 'eligible' && !d.isEligible) return false;
    if (filterType !== 'ALL' && d.driveType !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchComp = d.companyName?.toLowerCase().includes(q);
      const matchRole = d.role?.toLowerCase().includes(q);
      const matchLoc = d.location?.toLowerCase().includes(q);
      if (!matchComp && !matchRole && !matchLoc) return false;
    }
    return true;
  });

  // STEP 1: If user has NOT completed their profile yet (or is actively editing/registering)
  if (!hasCompleteProfile || isRegistering) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 pb-12">
        <PageHeader
          title="Placement Cell • Student Registration (POD)"
          description="Register your placement profile to unlock Campus & Off-Campus Recruitment Drives matching your academic eligibility."
          eyebrow="Training & Placement"
        />

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm md:p-8">
          <div className="mb-6 flex items-start gap-4 border-b border-line pb-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent ring-1 ring-accent/20">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">Official Placement Eligibility Dossier</h2>
              <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                Companies set strict eligibility criteria (Minimum CGPA, Eligible Branches, Maximum Backlogs, 10th/12th %).
                Fill in your accurate academic details below. Once registered, <strong>only recruitment drives you qualify for</strong> will be unlocked.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* 1. Personal & Contact Details */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white text-[10px]">1</span>
                Personal & College Identity
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Full Name (as in college records)" required>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Alex Student"
                    value={formProfile.fullName}
                    onChange={(e) => setFormProfile({ ...formProfile, fullName: e.target.value })}
                    required
                  />
                </Field>
                <Field label="College Roll Number / USN" required>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. 1MS22CS045"
                    value={formProfile.rollNumber}
                    onChange={(e) => setFormProfile({ ...formProfile, rollNumber: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Contact Phone Number" required>
                  <input
                    type="tel"
                    className="input"
                    placeholder="e.g. +91 98765 43210"
                    value={formProfile.phone}
                    onChange={(e) => setFormProfile({ ...formProfile, phone: e.target.value })}
                    required
                  />
                </Field>
              </div>
            </div>

            {/* 2. Academic Record */}
            <div className="space-y-4 pt-4 border-t border-line">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white text-[10px]">2</span>
                Academic Performance & Eligibility Criteria
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Department / Branch" required>
                  <select
                    className="input"
                    value={formProfile.branch}
                    onChange={(e) => setFormProfile({ ...formProfile, branch: e.target.value })}
                    required
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Current Cumulative CGPA (0.0 - 10.0)" required>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    className="input font-mono font-semibold"
                    placeholder="e.g. 8.75"
                    value={formProfile.cgpa}
                    onChange={(e) => setFormProfile({ ...formProfile, cgpa: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Active Backlogs (Current)" required>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    className="input font-mono"
                    placeholder="0"
                    value={formProfile.activeBacklogs}
                    onChange={(e) => setFormProfile({ ...formProfile, activeBacklogs: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Passing Out Batch Year" required>
                  <select
                    className="input"
                    value={formProfile.graduationYear}
                    onChange={(e) => setFormProfile({ ...formProfile, graduationYear: e.target.value })}
                    required
                  >
                    <option value="2025">2025 Batch</option>
                    <option value="2026">2026 Batch</option>
                    <option value="2027">2027 Batch</option>
                    <option value="2028">2028 Batch</option>
                  </select>
                </Field>

                <Field label="10th Board Percentage (%)">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="input font-mono"
                    placeholder="e.g. 92.4"
                    value={formProfile.tenthPercentage}
                    onChange={(e) => setFormProfile({ ...formProfile, tenthPercentage: e.target.value })}
                  />
                </Field>

                <Field label="12th / Diploma Percentage (%)">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="input font-mono"
                    placeholder="e.g. 89.5"
                    value={formProfile.twelfthPercentage}
                    onChange={(e) => setFormProfile({ ...formProfile, twelfthPercentage: e.target.value })}
                  />
                </Field>
              </div>
            </div>

            {/* 3. Skills & Verification Links */}
            <div className="space-y-4 pt-4 border-t border-line">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white text-[10px]">3</span>
                Skills & Resume Verification
              </h3>

              <div className="space-y-2">
                <label className="text-xs font-medium text-ink">Select Primary Technical Skills:</label>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_SKILLS.map((skill) => {
                    const selected = formProfile.skills
                      .split(',')
                      .map((s) => s.trim())
                      .includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => handleSkillToggle(skill)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                          selected
                            ? 'bg-accent text-white shadow-sm'
                            : 'border border-line bg-canvas text-ink-muted hover:border-accent hover:text-ink'
                        }`}
                      >
                        {selected && <Check className="mr-1 inline-block h-3 w-3" />}
                        {skill}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Field label="Skills (Comma separated)">
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="React, Node.js, TypeScript, SQL, Python, DSA"
                  value={formProfile.skills}
                  onChange={(e) => setFormProfile({ ...formProfile, skills: e.target.value })}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Resume / CV URL (Google Drive / Cloud link)">
                  <input
                    type="url"
                    className="input text-xs"
                    placeholder="https://drive.google.com/..."
                    value={formProfile.resumeUrl}
                    onChange={(e) => setFormProfile({ ...formProfile, resumeUrl: e.target.value })}
                  />
                </Field>
                <Field label="GitHub Profile URL">
                  <input
                    type="url"
                    className="input text-xs"
                    placeholder="https://github.com/username"
                    value={formProfile.githubUrl}
                    onChange={(e) => setFormProfile({ ...formProfile, githubUrl: e.target.value })}
                  />
                </Field>
                <Field label="LinkedIn Profile URL">
                  <input
                    type="url"
                    className="input text-xs"
                    placeholder="https://linkedin.com/in/username"
                    value={formProfile.linkedinUrl}
                    onChange={(e) => setFormProfile({ ...formProfile, linkedinUrl: e.target.value })}
                  />
                </Field>
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-between pt-6 border-t border-line">
              {hasCompleteProfile ? (
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              ) : (
                <span className="text-xs text-ink-subtle flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-positive" />
                  Encrypted & stored in campus placement database
                </span>
              )}

              <button
                type="submit"
                disabled={savingProfile}
                className="btn btn-primary inline-flex items-center gap-2 px-6"
              >
                {savingProfile ? (
                  <>
                    <Spinner size="sm" />
                    <span>Verifying & Saving…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Complete Registration & Unlock Drives</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // STEP 2: Profile is complete! Render full Placement Portal with default to ONLY ELIGIBLE DRIVES
  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Campus & Off-Campus Placements"
        description="Real-time corporate recruitment portal. View company drives matching your eligibility, submit applications, and track selection rounds."
        eyebrow="Placement Cell (POD)"
      />

      {/* Verified Student Header Dossier */}
      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-white font-bold text-lg shadow-sm">
              {profile.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-ink">{profile.fullName}</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-positive-soft px-2 py-0.5 text-[11px] font-semibold text-positive-ink ring-1 ring-positive/30">
                  <CheckCircle2 className="h-3 w-3" /> Verified POD Profile
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                <span>Branch: <strong className="text-ink">{profile.branch}</strong></span>
                <span>•</span>
                <span>CGPA: <strong className="text-ink">{profile.cgpa}</strong></span>
                <span>•</span>
                <span>Backlogs: <strong className="text-ink">{profile.activeBacklogs ?? 0}</strong></span>
                <span>•</span>
                <span>Batch: <strong className="text-ink">{profile.graduationYear ?? 2026}</strong></span>
                {profile.rollNumber && (
                  <>
                    <span>•</span>
                    <span>Roll: <strong className="text-ink">{profile.rollNumber}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {profile.resumeUrl && (
              <a
                href={profile.resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 text-xs"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>View Resume</span>
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            )}
            <button
              onClick={() => setIsRegistering(true)}
              className="btn btn-ghost btn-sm inline-flex items-center gap-1.5 text-xs"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Update Dossier</span>
            </button>
          </div>
        </div>

        {/* Quick Placement Metrics */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <div className="rounded-xl bg-canvas/60 p-3">
            <p className="text-[11px] font-medium text-ink-subtle uppercase tracking-wider">Eligible Companies</p>
            <p className="mt-0.5 text-lg font-bold text-positive-ink flex items-center gap-1.5">
              <span>{eligibleDrives.length}</span>
              <span className="text-xs font-normal text-positive-ink/80">drives</span>
            </p>
          </div>

          <div className="rounded-xl bg-canvas/60 p-3">
            <p className="text-[11px] font-medium text-ink-subtle uppercase tracking-wider">Total Drives</p>
            <p className="mt-0.5 text-lg font-bold text-ink flex items-center gap-1.5">
              <span>{drives.length}</span>
              <span className="text-xs font-normal text-ink-muted">active</span>
            </p>
          </div>

          <div className="rounded-xl bg-canvas/60 p-3">
            <p className="text-[11px] font-medium text-ink-subtle uppercase tracking-wider">My Applications</p>
            <p className="mt-0.5 text-lg font-bold text-accent flex items-center gap-1.5">
              <span>{applications.length}</span>
              <span className="text-xs font-normal text-accent/80">submitted</span>
            </p>
          </div>

          <div className="rounded-xl bg-canvas/60 p-3">
            <p className="text-[11px] font-medium text-ink-subtle uppercase tracking-wider">Eligibility Match</p>
            <p className="mt-0.5 text-lg font-bold text-ink flex items-center gap-1.5">
              <span>{drives.length > 0 ? Math.round((eligibleDrives.length / drives.length) * 100) : 0}%</span>
              <span className="text-xs font-normal text-ink-muted">qualification</span>
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs: DEFAULT TO ELIGIBLE ONLY */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-1">
        <div className="flex gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('eligible')}
            className={`relative pb-3 text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'eligible'
                ? 'text-accent border-b-2 border-accent'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Sparkles className="h-4 w-4 text-positive" />
            <span>Eligible for You</span>
            <span className="rounded-full bg-positive-soft px-2 py-0.2 text-[11px] font-bold text-positive-ink">
              {eligibleDrives.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`relative pb-3 text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'all'
                ? 'text-accent border-b-2 border-accent'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Briefcase className="h-4 w-4" />
            <span>All Drives</span>
            <span className="rounded-full bg-surface-sunken px-2 py-0.2 text-[11px] font-medium text-ink-subtle">
              {drives.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('applications')}
            className={`relative pb-3 text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'applications'
                ? 'text-accent border-b-2 border-accent'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>My Applications</span>
            <span className="rounded-full bg-accent-soft px-2 py-0.2 text-[11px] font-bold text-accent">
              {applications.length}
            </span>
          </button>
        </div>

        {/* Filters for Drives views */}
        {(activeTab === 'eligible' || activeTab === 'all') && (
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-subtle" />
              <input
                type="text"
                placeholder="Search company, role..."
                className="input input-sm pl-8 text-xs w-48 sm:w-56 bg-surface"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex rounded-lg border border-line bg-surface p-0.5">
              {['ALL', 'ON_CAMPUS', 'OFF_CAMPUS'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    filterType === type
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {type === 'ALL' ? 'All' : type === 'ON_CAMPUS' ? 'On-Campus' : 'Off-Campus'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* BANNER NOTIFICATION WHEN VIEWING ONLY ELIGIBLE DRIVES */}
      {activeTab === 'eligible' && (
        <div className="flex items-center justify-between rounded-xl border border-positive/30 bg-positive-soft/40 px-4 py-2.5 text-xs text-positive-ink">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              <strong>Real-Time Filter Active:</strong> Showing only companies matching your CGPA (<strong>{profile.cgpa}</strong>), branch (<strong>{profile.branch}</strong>), backlogs (<strong>{profile.activeBacklogs ?? 0}</strong>), and graduation year (<strong>{profile.graduationYear ?? 2026}</strong>).
            </span>
          </div>
          <button
            onClick={() => setActiveTab('all')}
            className="font-bold underline hover:opacity-80 shrink-0 ml-2"
          >
            View all {drives.length} drives →
          </button>
        </div>
      )}

      {/* TAB: ELIGIBLE OR ALL DRIVES */}
      {(activeTab === 'eligible' || activeTab === 'all') && (
        <div className="space-y-4">
          {displayedDrives.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface-sunken text-ink-subtle">
                <Briefcase className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-base font-bold text-ink">
                {activeTab === 'eligible' ? 'No Eligible Drives Match Your Criteria' : 'No Drives Found'}
              </h3>
              <p className="mt-1 text-xs text-ink-muted max-w-md mx-auto">
                {activeTab === 'eligible'
                  ? 'There are currently no active placement drives matching your current CGPA, branch, or backlogs. Check back soon or switch to All Drives.'
                  : 'No placement drives match your search query.'}
              </p>
              {activeTab === 'eligible' && (
                <button
                  onClick={() => setActiveTab('all')}
                  className="btn btn-secondary btn-sm mt-4"
                >
                  Browse All Drives
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayedDrives.map((drive) => {
                const daysLeft = Math.ceil((new Date(drive.deadline) - new Date()) / (1000 * 3600 * 24));
                const isClosingSoon = daysLeft <= 3 && daysLeft >= 0;

                return (
                  <div
                    key={drive.id}
                    className={`group relative flex flex-col justify-between rounded-2xl border bg-surface p-5 transition-all hover:shadow-md ${
                      drive.hasApplied
                        ? 'border-accent/40 bg-accent-soft/10 ring-1 ring-accent/20'
                        : drive.isEligible
                        ? 'border-line hover:border-accent'
                        : 'border-line/60 bg-surface/60 opacity-80'
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-canvas text-base font-bold text-ink ring-1 ring-line shadow-xs group-hover:ring-accent/40">
                            {drive.companyName.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-ink text-sm group-hover:text-accent transition-colors">
                              {drive.companyName}
                            </h4>
                            <p className="text-xs text-ink-muted line-clamp-1">{drive.role}</p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              drive.driveType === 'ON_CAMPUS'
                                ? 'bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                            }`}
                          >
                            {drive.driveType === 'ON_CAMPUS' ? 'On-Campus' : 'Off-Campus'}
                          </span>
                        </div>
                      </div>

                      {/* Package & Key Info */}
                      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-canvas/70 p-2.5 text-xs">
                        <div>
                          <span className="text-[10px] text-ink-subtle uppercase">Package (CTC)</span>
                          <p className="font-bold text-positive-ink text-sm">
                            {drive.ctcLpa ? `₹${drive.ctcLpa} LPA` : 'Disclosed Soon'}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-ink-subtle uppercase">Min CGPA</span>
                          <p className="font-bold text-ink text-sm">
                            {drive.eligibilityCgpa > 0 ? `${drive.eligibilityCgpa} CGPA` : 'Open to All'}
                          </p>
                        </div>
                      </div>

                      {/* Location & Deadline */}
                      <div className="mt-3 space-y-1.5 text-[11px] text-ink-muted">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-ink-subtle shrink-0" />
                          <span className="truncate">{drive.location || 'Multiple Locations / Remote'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-ink-subtle shrink-0" />
                            <span>Deadline: {new Date(drive.deadline).toLocaleDateString()}</span>
                          </div>
                          {daysLeft >= 0 && (
                            <span className={`text-[10px] font-semibold ${isClosingSoon ? 'text-critical-ink' : 'text-ink-subtle'}`}>
                              ({daysLeft === 0 ? 'Today' : `${daysLeft}d left`})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Real-Time Eligibility Match Badge */}
                      <div className="mt-3 pt-3 border-t border-line/60">
                        {drive.isEligible ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-positive-ink">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span>100% Eligible to Apply</span>
                          </div>
                        ) : (
                          <div className="rounded-lg bg-critical-soft/50 p-2 text-[11px] text-critical-ink">
                            <p className="font-semibold flex items-center gap-1">
                              <XCircle className="h-3.5 w-3.5 shrink-0" /> Not Eligible
                            </p>
                            <p className="mt-0.5 line-clamp-1 opacity-90">{drive.eligibilityReason}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDrive(drive)}
                        className="btn btn-ghost btn-xs text-xs"
                      >
                        Details
                      </button>

                      {drive.hasApplied ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent ring-1 ring-accent/30">
                          <Check className="h-3.5 w-3.5" /> Applied
                        </span>
                      ) : drive.isExpired ? (
                        <span className="rounded-lg bg-surface-sunken px-3 py-1 text-xs text-ink-subtle font-medium">
                          Closed
                        </span>
                      ) : drive.isEligible ? (
                        <button
                          type="button"
                          onClick={() => setApplyModalDrive(drive)}
                          className="btn btn-primary btn-sm inline-flex items-center gap-1 text-xs px-3.5"
                        >
                          <span>Apply Now</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="btn btn-secondary btn-sm opacity-50 cursor-not-allowed text-xs"
                        >
                          Ineligible
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: MY APPLICATIONS */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          {applications.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface-sunken text-ink-subtle">
                <UserCheck className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-base font-bold text-ink">No Applications Submitted Yet</h3>
              <p className="mt-1 text-xs text-ink-muted max-w-md mx-auto">
                Browse through your eligible recruitment drives and click Apply Now to register for campus placement rounds.
              </p>
              <button
                onClick={() => setActiveTab('eligible')}
                className="btn btn-primary btn-sm mt-4"
              >
                Explore Eligible Companies
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent font-bold text-base ring-1 ring-accent/20">
                      {app.drive?.companyName ? app.drive.companyName.charAt(0) : 'C'}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-ink text-sm">{app.drive?.companyName}</h4>
                        <span className="rounded-md bg-canvas px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                          {app.drive?.driveType === 'ON_CAMPUS' ? 'On-Campus' : 'Off-Campus'}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5">{app.drive?.role}</p>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-ink-subtle">
                        <span>Package: <strong className="text-positive-ink">₹{app.drive?.ctcLpa} LPA</strong></span>
                        <span>•</span>
                        <span>Applied on: {new Date(app.appliedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status & Timeline Stepper */}
                  <div className="flex flex-col sm:items-end gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                        app.status === 'SELECTED'
                          ? 'bg-positive-soft text-positive-ink ring-1 ring-positive/30'
                          : app.status === 'REJECTED'
                          ? 'bg-critical-soft text-critical-ink ring-1 ring-critical/30'
                          : app.status === 'INTERVIEWED' || app.status === 'SHORTLISTED'
                          ? 'bg-accent-soft text-accent ring-1 ring-accent/30'
                          : 'bg-canvas text-ink ring-1 ring-line'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {app.status === 'APPLIED' ? 'Applied • Under Review' : app.status}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleWithdraw(app.driveId)}
                      className="text-[11px] text-critical-ink hover:underline"
                    >
                      Withdraw application
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: VIEW DRIVE DETAILS */}
      {selectedDrive && (
        <Modal
          open={Boolean(selectedDrive)}
          onClose={() => setSelectedDrive(null)}
          title={`${selectedDrive.companyName} — ${selectedDrive.role}`}
        >
          <div className="space-y-5 text-sm">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl bg-canvas p-3 text-xs">
              <div>
                <span className="text-[10px] text-ink-subtle uppercase">Package</span>
                <p className="font-bold text-positive-ink text-sm">₹{selectedDrive.ctcLpa} LPA</p>
              </div>
              <div>
                <span className="text-[10px] text-ink-subtle uppercase">Type</span>
                <p className="font-bold text-ink text-sm">
                  {selectedDrive.driveType === 'ON_CAMPUS' ? 'On-Campus' : 'Off-Campus'}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-ink-subtle uppercase">Min CGPA</span>
                <p className="font-bold text-ink text-sm">{selectedDrive.eligibilityCgpa || 'None'}</p>
              </div>
              <div>
                <span className="text-[10px] text-ink-subtle uppercase">Deadline</span>
                <p className="font-bold text-ink text-sm">
                  {new Date(selectedDrive.deadline).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Eligibility Checklist */}
            <div className="rounded-xl border border-line bg-surface p-4">
              <h4 className="font-bold text-ink text-xs uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-accent" />
                Eligibility Criteria Evaluation
              </h4>
              <ul className="space-y-1.5 text-xs">
                <li className="flex items-center justify-between py-1 border-b border-line/60">
                  <span className="text-ink-muted">Minimum CGPA:</span>
                  <span className="font-semibold text-ink">
                    {selectedDrive.eligibilityCgpa} (Your CGPA: {profile.cgpa}) {profile.cgpa >= selectedDrive.eligibilityCgpa ? '✓' : '✕'}
                  </span>
                </li>
                {selectedDrive.eligibleBranches && selectedDrive.eligibleBranches.length > 0 && (
                  <li className="flex items-center justify-between py-1 border-b border-line/60">
                    <span className="text-ink-muted">Eligible Branches:</span>
                    <span className="font-semibold text-ink">
                      {selectedDrive.eligibleBranches.join(', ')}
                    </span>
                  </li>
                )}
                {selectedDrive.maxBacklogs !== undefined && (
                  <li className="flex items-center justify-between py-1 border-b border-line/60">
                    <span className="text-ink-muted">Max Active Backlogs:</span>
                    <span className="font-semibold text-ink">
                      {selectedDrive.maxBacklogs} allowed (You have: {profile.activeBacklogs ?? 0})
                    </span>
                  </li>
                )}
                {selectedDrive.batchYear && (
                  <li className="flex items-center justify-between py-1">
                    <span className="text-ink-muted">Graduation Batch:</span>
                    <span className="font-semibold text-ink">{selectedDrive.batchYear} Batch</span>
                  </li>
                )}
              </ul>
            </div>

            {/* Job Description */}
            <div>
              <h4 className="font-bold text-ink text-xs uppercase tracking-wider mb-1">Role Description</h4>
              <p className="text-xs text-ink-muted leading-relaxed whitespace-pre-wrap">
                {selectedDrive.description || 'No detailed description provided by the recruitment team.'}
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-line">
              <button
                type="button"
                onClick={() => setSelectedDrive(null)}
                className="btn btn-secondary"
              >
                Close
              </button>

              {selectedDrive.hasApplied ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-accent/20 px-4 py-2 text-xs font-bold text-accent">
                  Already Applied
                </span>
              ) : selectedDrive.isEligible ? (
                <button
                  type="button"
                  onClick={() => {
                    setApplyModalDrive(selectedDrive);
                    setSelectedDrive(null);
                  }}
                  className="btn btn-primary"
                >
                  Proceed to Apply
                </button>
              ) : (
                <button type="button" disabled className="btn btn-secondary opacity-50">
                  Not Eligible
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2: 1-CLICK CONFIRM APPLICATION MODAL */}
      {applyModalDrive && (
        <Modal
          open={Boolean(applyModalDrive)}
          onClose={() => setApplyModalDrive(null)}
          title="Confirm Placement Application"
        >
          <div className="space-y-4 text-sm">
            <div className="rounded-xl bg-accent-soft/40 p-4 border border-accent/20">
              <h4 className="font-bold text-accent text-base">
                {applyModalDrive.companyName} — {applyModalDrive.role}
              </h4>
              <p className="text-xs text-ink-muted mt-1">
                CTC: <strong className="text-positive-ink">₹{applyModalDrive.ctcLpa} LPA</strong> • Location: {applyModalDrive.location}
              </p>
            </div>

            <p className="text-xs text-ink-muted leading-relaxed">
              By submitting this application, your verified student profile and resume will be sent to the campus recruitment coordinator:
            </p>

            <div className="rounded-xl border border-line bg-surface p-3 text-xs space-y-1">
              <p><strong>Candidate:</strong> {profile.fullName} ({profile.rollNumber})</p>
              <p><strong>Department & CGPA:</strong> {profile.branch} • {profile.cgpa} CGPA</p>
              <p><strong>Backlogs:</strong> {profile.activeBacklogs ?? 0}</p>
              {profile.resumeUrl && (
                <p className="text-accent flex items-center gap-1 truncate">
                  <strong>Resume:</strong> {profile.resumeUrl}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-line">
              <button
                type="button"
                onClick={() => setApplyModalDrive(null)}
                className="btn btn-secondary"
                disabled={applying}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleApply(applyModalDrive.id)}
                disabled={applying}
                className="btn btn-primary inline-flex items-center gap-1.5"
              >
                {applying ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
                <span>Confirm & Submit Application</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
