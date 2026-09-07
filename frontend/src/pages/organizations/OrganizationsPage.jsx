import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Badge, EmptyState, ErrorAlert, Field, Modal, PageHeader, Spinner } from '../../components/ui.jsx';

export function OrganizationsPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', description: '', brandColor: '#2563eb' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = () =>
    api.get('/organizations')
      .then((r) => setItems(r.data.data.organizations))
      .catch(setError);

  useEffect(() => { load(); }, []);

  const selectOrg = async (org) => {
    try {
      const { data } = await api.get(`/organizations/${org.id}`);
      setActive(data.data.organization);
    } catch (err) {
      setError(err);
    }
  };

  const create = async () => {
    setBusy(true);
    setFormError(null);
    try {
      const { data } = await api.post('/organizations', form);
      await load();
      setCreateOpen(false);
      setActive(data.data.organization);
    } catch (err) {
      setFormError(err?.response?.data?.message ?? 'Failed to create organization');
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorAlert error={error} />;
  if (!items) return <Spinner label="Loading organizations…" />;

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Manage your organization, departments, academic years, semesters, and batches."
        actions={
          <button onClick={() => setCreateOpen(true)} className="btn btn-primary">New Organization</button>
        }
      />

      {items.length === 0 && (
        <EmptyState title="No organizations" description="Create your first organization to get started." />
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          {items.map((o) => (
            <button
              key={o.id}
              onClick={() => selectOrg(o)}
              className={`w-full rounded-lg border p-4 text-left transition-colors ${
                active?.id === o.id ? 'border-accent/30 bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'
              }`}
            >
              <p className="font-semibold text-ink">{o.name}</p>
              <p className="text-xs text-ink-muted">@{o.slug}</p>
              {o._count?.members != null && <Badge tone="accent">{o._count.members} members</Badge>}
            </button>
          ))}
        </div>

        <div>
          {!active ? (
            <EmptyState title="Select an organization" description="Choose an organization from the left to manage its structure." />
          ) : (
            <OrgDetail org={active} onChanged={() => selectOrg(active)} />
          )}
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Organization">
        <div className="space-y-4">
          {formError && <div className="rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical-ink">{formError}</div>}
          <Field label="Name">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Slug">
            <input className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="my-org" />
          </Field>
          <Field label="Description">
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Brand color">
            <input type="color" className="h-10 w-16 rounded border border-line" value={form.brandColor} onChange={(e) => setForm({ ...form, brandColor: e.target.value })} />
          </Field>
          <button onClick={create} disabled={busy} className="btn btn-primary w-full">
            {busy ? 'Creating…' : 'Create Organization'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function OrgDetail({ org, onChanged }) {
  const [tab, setTab] = useState('departments');
  const [departments, setDepartments] = useState(null);
  const [academicYears, setAcademicYears] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (tab === 'departments') {
      api.get(`/organizations/${org.id}/departments`).then((r) => setDepartments(r.data.data.departments)).catch(setError);
    } else if (tab === 'academic-years') {
      api.get(`/organizations/${org.id}/academic-years`).then((r) => setAcademicYears(r.data.data.academicYears)).catch(setError);
    }
  }, [org.id, tab]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-ink">{org.name}</h2>
        <p className="text-sm text-ink-muted">{org.description}</p>
      </div>

      <div className="flex gap-1 border-b border-line">
        {['departments', 'academic-years'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 pb-2 text-sm font-medium ${tab === t ? 'border-accent text-accent' : 'border-transparent text-ink-muted hover:text-ink'}`}
          >
            {t === 'departments' ? 'Departments' : 'Academic Years'}
          </button>
        ))}
      </div>

      {error && <ErrorAlert error={error} />}

      {tab === 'departments' && (
        <DepList org={org} departments={departments} />
      )}

      {tab === 'academic-years' && (
        <AcademicYearList org={org} academicYears={academicYears} />
      )}
    </div>
  );
}

function DepList({ org, departments }) {
  const [batchesMap, setBatchesMap] = useState({});
  const [depOpen, setDepOpen] = useState(null);

  if (!departments) return <Spinner label="Loading departments…" />;

  const toggleDep = async (dep) => {
    if (depOpen?.id === dep.id) { setDepOpen(null); return; }
    setDepOpen(dep);
    if (!batchesMap[dep.id]) {
      try {
        const { data } = await api.get(`/departments/${dep.id}/batches`);
        setBatchesMap((m) => ({ ...m, [dep.id]: data.data.batches }));
      } catch {}
    }
  };

  return (
    <div className="space-y-2">
      {departments.length === 0 && <EmptyState title="No departments" description="Add a department within this organization." />}
      {departments.map((dep) => (
        <div key={dep.id} className="rounded-lg border border-line">
          <button onClick={() => toggleDep(dep)} className="flex w-full items-center justify-between p-4 text-left">
            <div>
              <p className="font-medium text-ink">{dep.name}</p>
              <p className="text-xs text-ink-muted">Code: {dep.code}</p>
            </div>
            <span className="text-sm text-ink-subtle">{depOpen?.id === dep.id ? '▾' : '▸'}</span>
          </button>
          {depOpen?.id === dep.id && (
            <div className="border-t border-line p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Batches</p>
              {(batchesMap[dep.id] || []).map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded bg-canvas px-3 py-2 text-sm">
                  <span className="font-medium text-ink">{b.name}</span>
                  <Badge>{b.code}</Badge>
                </div>
              ))}
              {(batchesMap[dep.id] || []).length === 0 && <p className="text-sm text-ink-subtle">No batches yet.</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AcademicYearList({ org, academicYears }) {
  if (!academicYears) return <Spinner label="Loading academic years…" />;
  return (
    <div className="space-y-2">
      {academicYears.length === 0 && <EmptyState title="No academic years" description="Add academic years to organize semesters." />}
      {academicYears.map((ay) => (
        <div key={ay.id} className="rounded-lg border border-line p-4">
          <p className="font-medium text-ink">{ay.name}</p>
          <p className="text-xs text-ink-muted">
            {new Date(ay.startDate).toLocaleDateString()} – {new Date(ay.endDate).toLocaleDateString()}
          </p>
        </div>
      ))}
    </div>
  );
}