import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../api/client.js';
import { Badge, Button, ConfirmDialog, Drawer, EmptyState, ErrorAlert, Field, Modal, PageHeader, Spinner } from '../../components/ui.jsx';
import { useToast } from '../../components/toast.jsx';

const difficulties = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'];

export function CodingProblemsPage() {
  const [items, setItems] = useState(null);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    courseId: '',
    difficulty: 'EASY',
    timeLimitMs: 2000,
    memoryLimitMB: 256,
    allowedLanguages: ['python', 'javascript', 'java'],
    testCases: [{ input: '', expectedOutput: '', isPublic: true }],
  });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const [testCaseProblem, setTestCaseProblem] = useState(null);
  const [testCases, setTestCases] = useState([]);
  const [tcBusy, setTcBusy] = useState(false);
  const [newTestCase, setNewTestCase] = useState({ input: '', expectedOutput: '', isPublic: true });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const toast = useToast();

  const load = () =>
    Promise.all([
      api.get('/coding-problems').then((r) => setItems(r.data.data.items)),
      api.get('/courses').then((r) => setCourses(r.data.data.items)),
    ]).catch(setError);

  useEffect(() => { load(); }, []);

  const setTestCase = (i, patch) => {
    setForm((f) => {
      const tc = [...f.testCases];
      tc[i] = { ...tc[i], ...patch };
      return { ...f, testCases: tc };
    });
  };

  const openCreate = () => {
    setForm({ title: '', description: '', courseId: '', difficulty: 'EASY', timeLimitMs: 2000, memoryLimitMB: 256, allowedLanguages: ['python', 'javascript', 'java'], testCases: [{ input: '', expectedOutput: '', isPublic: true }] });
    setFormError(null);
    setModal('create');
  };

  const openEdit = (problem) => {
    setForm({
      title: problem.title,
      description: problem.description,
      courseId: problem.courseId ?? '',
      difficulty: problem.difficulty,
      timeLimitMs: problem.timeLimitMs,
      memoryLimitMB: problem.memoryLimitMB,
      allowedLanguages: Array.isArray(problem.allowedLanguages) ? problem.allowedLanguages : JSON.parse(problem.allowedLanguages || '[]'),
      testCases: [],
    });
    setFormError(null);
    setModal(problem.id);
  };

  const save = async () => {
    setBusy(true);
    setFormError(null);
    try {
      if (modal === 'create') {
        await api.post('/coding-problems', form);
      } else {
        await api.put(`/coding-problems/${modal}`, {
          title: form.title,
          description: form.description,
          courseId: form.courseId || undefined,
          difficulty: form.difficulty,
          timeLimitMs: Number(form.timeLimitMs),
          memoryLimitMB: Number(form.memoryLimitMB),
          allowedLanguages: form.allowedLanguages,
        });
      }
      setModal(null);
      await load();
    } catch (err) {
      setFormError(err?.response?.data?.message ?? 'Failed to create problem');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p) => {
    setConfirmDelete(p);
  };

  const confirmRemove = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/coding-problems/${confirmDelete.id}`);
      await load();
      toast.success('Problem deleted');
    } catch (err) {
      setError(err);
    }
    setConfirmDelete(null);
  };

  const openTestCases = async (problem) => {
    setTestCaseProblem(problem);
    try {
      const { data } = await api.get(`/coding-problems/${problem.id}`);
      setTestCases(data.data.problem.testCases || []);
      setNewTestCase({ input: '', expectedOutput: '', isPublic: true });
    } catch (err) {
      setError(err);
    }
  };

  const addTestCase = async () => {
    if (!testCaseProblem || !newTestCase.input) return;
    setTcBusy(true);
    try {
      const { data } = await api.post(`/coding-problems/${testCaseProblem.id}/testcases`, newTestCase);
      setTestCases((prev) => [...prev, data.data.testCase]);
      setNewTestCase({ input: '', expectedOutput: '', isPublic: true });
      toast.success('Test case added');
    } catch (err) {
      toast.error(err?.response?.data?.message ?? 'Failed to add test case');
    }
    setTcBusy(false);
  };

  const removeTestCase = async (testCaseId) => {
    if (!testCaseProblem) return;
    try {
      await api.delete(`/coding-problems/${testCaseProblem.id}/testcases/${testCaseId}`);
      setTestCases((prev) => prev.filter((tc) => tc.id !== testCaseId));
      toast.success('Test case removed');
    } catch (err) {
      toast.error('Failed to remove test case');
    }
  };

  if (error) return <ErrorAlert error={error} />;
  if (!items) return <Spinner label="Loading coding problems…" />;

  return (
    <div>
      <PageHeader
        title="Coding Problems"
        description="Create and manage programming exercises with automated test cases."
        actions={
          <button onClick={openCreate} className="btn btn-primary">
            New Problem
          </button>
        }
      />

      {items.length === 0 && (
        <EmptyState title="No coding problems yet" description="Create your first problem to get started." />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <div key={p.id} className="card p-5">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-ink">{p.title}</h3>
              <Badge tone={p.difficulty === 'EASY' ? 'positive' : p.difficulty === 'MEDIUM' ? 'caution' : 'critical'}>
                {p.difficulty}
              </Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{p.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(Array.isArray(p.allowedLanguages) ? p.allowedLanguages : JSON.parse(p.allowedLanguages || '[]')).map((l) => (
                <span key={l} className="rounded bg-canvas px-1.5 py-0.5 text-xs text-ink-muted">{l}</span>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-ink-subtle">
              <span>{p.testCases?.length ?? 0} test cases</span>
              <span>{(p.timeLimitMs / 1000).toFixed(1)}s limit</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => openTestCases(p)}>
                Test Cases
              </Button>
              <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                Edit
              </Button>
              <Button variant="danger" size="sm" onClick={() => remove(p)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={Boolean(modal)} onClose={() => setModal(null)} title={modal === 'create' ? 'New Coding Problem' : 'Edit Coding Problem'} width="lg">
        <div className="space-y-4">
          {formError && <div className="rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical-ink">{formError}</div>}
          <Field label="Title">
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Description">
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Course">
              <select className="input" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
                <option value="">No course</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Difficulty">
              <select className="input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                {difficulties.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Time limit (ms)">
              <input type="number" className="input" value={form.timeLimitMs} onChange={(e) => setForm({ ...form, timeLimitMs: +e.target.value })} />
            </Field>
            <Field label="Memory limit (MB)">
              <input type="number" className="input" value={form.memoryLimitMB} onChange={(e) => setForm({ ...form, memoryLimitMB: +e.target.value })} />
            </Field>
          </div>

          {modal === 'create' && (
            <div>
              <p className="label">Test Cases</p>
              <div className="space-y-2">
                {form.testCases.map((tc, i) => (
                  <div key={i} className="rounded-lg border border-line p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-ink-muted">Case #{i + 1}</span>
                      <label className="flex items-center gap-1 text-xs text-ink-muted">
                        <input type="checkbox" checked={tc.isPublic} onChange={(e) => setTestCase(i, { isPublic: e.target.checked })} />
                        Public
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input className="input" placeholder="Input" value={tc.input} onChange={(e) => setTestCase(i, { input: e.target.value })} />
                      <input className="input" placeholder="Expected output" value={tc.expectedOutput} onChange={(e) => setTestCase(i, { expectedOutput: e.target.value })} />
                    </div>
                    <button className="mt-2 text-xs text-critical-ink hover:underline" onClick={() => setForm((f) => ({ ...f, testCases: f.testCases.filter((_, j) => j !== i) }))}>
                      Remove
                    </button>
                  </div>
                ))}
                <button className="btn btn-ghost w-full" onClick={() => setForm((f) => ({ ...f, testCases: [...f.testCases, { input: '', expectedOutput: '', isPublic: true }] }))}>
                  + Add Test Case
                </button>
              </div>
            </div>
          )}

          <button onClick={save} disabled={busy || !form.title || !form.description} className="btn btn-primary w-full">
            {busy ? 'Saving…' : modal === 'create' ? 'Create Problem' : 'Save Changes'}
          </button>
        </div>
      </Modal>

      <Drawer
        open={Boolean(testCaseProblem)}
        onClose={() => setTestCaseProblem(null)}
        title={`Test Cases — ${testCaseProblem?.title ?? ''}`}
        description="Manage test cases for this coding problem."
        width="lg"
      >
        <div className="space-y-4">
          <div className="space-y-3">
            {testCases.length === 0 && <p className="text-sm text-ink-subtle">No test cases yet. Add one below.</p>}
            {testCases.map((tc) => (
              <div key={tc.id} className="rounded-lg border border-line p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-ink-muted">
                    Case #{testCases.indexOf(tc) + 1} {tc.isPublic ? '(Public)' : '(Hidden)'}
                  </span>
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => removeTestCase(tc.id)}>
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-medium text-ink-subtle">Input:</span>
                    <pre className="mt-1 rounded bg-canvas p-2 whitespace-pre-wrap">{tc.input}</pre>
                  </div>
                  <div>
                    <span className="font-medium text-ink-subtle">Expected:</span>
                    <pre className="mt-1 rounded bg-canvas p-2 whitespace-pre-wrap">{tc.expectedOutput}</pre>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-dashed border-line-strong p-4">
            <p className="mb-3 text-sm font-medium text-ink">Add Test Case</p>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Input">
                  <textarea className="input" rows={3} value={newTestCase.input} onChange={(e) => setNewTestCase({ ...newTestCase, input: e.target.value })} placeholder="Test input" />
                </Field>
                <Field label="Expected Output">
                  <textarea className="input" rows={3} value={newTestCase.expectedOutput} onChange={(e) => setNewTestCase({ ...newTestCase, expectedOutput: e.target.value })} placeholder="Expected output" />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                <input type="checkbox" checked={newTestCase.isPublic} onChange={(e) => setNewTestCase({ ...newTestCase, isPublic: e.target.checked })} />
                Public (visible to students)
              </label>
              <Button onClick={addTestCase} loading={tcBusy} disabled={!newTestCase.input} icon={Plus}>
                Add Test Case
              </Button>
            </div>
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmRemove}
        title={`Delete "${confirmDelete?.title}"?`}
        description="This will permanently remove the problem and all its test cases."
        confirmLabel="Delete"
      />
    </div>
  );
}
