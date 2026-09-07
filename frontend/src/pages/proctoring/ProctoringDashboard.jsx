import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorAlert, Field, Modal, PageHeader, Spinner, statusTone } from '../../components/ui.jsx';
import { useToast } from '../../components/toast.jsx';

const PROCTORING_TONES = {
  ACTIVE: 'positive',
  ENDED: 'neutral',
  FLAGGED: 'critical',
};

export function ProctoringDashboard() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [tests, setTests] = useState([]);
  const [students, setStudents] = useState([]);
  const [createForm, setCreateForm] = useState({ testId: '', studentId: '' });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = () =>
    api.get('/proctoring/sessions/active')
      .then((r) => setSessions(r.data.data.sessions))
      .catch(setError);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadFormData = async () => {
    try {
      const [testRes, studentRes] = await Promise.all([
        api.get('/tests?limit=100'),
        api.get('/tests/students/list'),
      ]);
      setTests(testRes.data.data.items ?? []);
      setStudents(studentRes.data.data.students ?? []);
    } catch (err) {
      setError(err);
    }
  };

  const openCreate = async () => {
    await loadFormData();
    setCreateForm({ testId: '', studentId: '' });
    setShowCreate(true);
  };

  const createSession = async () => {
    if (!createForm.testId || !createForm.studentId) return;
    setBusy(true);
    try {
      await api.post('/proctoring/sessions', {
        testId: createForm.testId,
        studentId: createForm.studentId,
      });
      setShowCreate(false);
      toast.success('Proctoring session created');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message ?? 'Failed to create session');
    } finally {
      setBusy(false);
    }
  };

  const endSession = async (s) => {
    try {
      await api.post(`/proctoring/sessions/${s.id}/end`);
      await load();
    } catch (err) {
      setError(err);
    }
  };

  const alertStudent = async (s) => {
    try {
      await api.post(`/proctoring/sessions/${s.id}/alert`, { message: 'Proctor alert' });
      await load();
    } catch (err) {
      setError(err);
    }
  };

  const recomputeSuspicion = async () => {
    try {
      await api.post('/proctoring/sessions/recompute-suspicion');
      await load();
      toast.success('Suspicion scores recalculated');
    } catch (err) {
      toast.error('Failed to recompute suspicion scores');
    }
  };

  if (error) return <ErrorAlert error={error} />;
  if (!sessions) return <Spinner label="Loading proctoring sessions…" />;

  const highReported = sessions.filter((s) => s.eventCount > 0);
  const flagged = sessions.filter((s) => s.suspicionScore >= 40);

  return (
    <div>
      <PageHeader
        title="Proctoring Dashboard"
        description="Monitor active exam sessions for suspicious activity in real time."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={recomputeSuspicion}>
              Recalculate Scores
            </Button>
            <Button onClick={openCreate}>
              Create Session
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active Sessions" value={sessions.length} />
        <StatCard label="Flagged for Review" value={flagged.length} tone="red" />
        <StatCard label="Sessions with Events" value={highReported.length} tone="amber" />
      </div>

      {sessions.length === 0 && (
        <EmptyState title="No active proctoring sessions" description="Sessions appear here when students begin a proctored exam." />
      )}

      <div className="space-y-3">
        {sessions.map((s) => (
          <div key={s.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{s.student?.fullName || s.studentId}</p>
                <p className="text-sm text-ink-muted">
                  {s.test?.title || 'Unknown test'} · Started {new Date(s.startedAt).toLocaleTimeString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={PROCTORING_TONES[s.status] ?? 'neutral'}>{s.status}</Badge>
                <Badge tone={s.suspicionScore >= 40 ? 'critical' : s.suspicionScore > 0 ? 'caution' : 'positive'}>
                  Suspicion: {Math.round(s.suspicionScore)}%
                </Badge>
              </div>
            </div>

            {s.lastEvent && (
              <div className="mt-3 rounded-lg bg-canvas p-3 text-sm text-ink-muted">
                <span className="font-medium text-ink">Last event: </span>
                {s.lastEvent.type}
                <span className="text-ink-subtle"> — {new Date(s.lastEvent.createdAt).toLocaleTimeString()}</span>
                {s.lastEvent.details && <span className="block text-xs text-ink-muted">{JSON.stringify(s.lastEvent.details)}</span>}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => alertStudent(s)}>
                Alert Student
              </Button>
              <Button variant="danger" size="sm" onClick={() => endSession(s)}>
                End Session
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Proctoring Session">
        <div className="space-y-4">
          <Field label="Test" required>
            <select
              className="input"
              value={createForm.testId}
              onChange={(e) => setCreateForm({ ...createForm, testId: e.target.value })}
            >
              <option value="">Select a test</option>
              {tests.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Student" required>
            <select
              className="input"
              value={createForm.studentId}
              onChange={(e) => setCreateForm({ ...createForm, studentId: e.target.value })}
            >
              <option value="">Select a student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.fullName || s.username}</option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)} disabled={busy}>Cancel</Button>
            <Button onClick={createSession} loading={busy} disabled={!createForm.testId || !createForm.studentId}>
              Create Session
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StatCard({ label, value, tone = 'neutral' }) {
  const tones = {
    neutral: 'text-ink',
    red: 'text-critical-ink',
    amber: 'text-caution-ink',
  };
  return (
    <div className="card p-5">
      <p className={`text-3xl font-bold ${tones[tone]}`}>{value}</p>
      <p className="mt-1 text-sm text-ink-muted">{label}</p>
    </div>
  );
}
