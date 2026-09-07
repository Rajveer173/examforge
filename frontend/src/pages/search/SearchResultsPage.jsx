import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Badge, ErrorAlert, EmptyState, PageHeader } from '../../components/ui.jsx';

export function SearchResultsPage() {
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = (query) => {
    const val = query ?? q;
    if (!val.trim()) { setData(null); return; }
    setLoading(true);
    api.get('/search', { params: { q: val } })
      .then((r) => setData(r.data.data))
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const initial = params.get('q') || '';
    if (initial) {
      setQ(initial);
      search(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const total = data?.count ?? 0;

  return (
    <div>
      <PageHeader title="Search" description="Find courses, tests, questions, users, and lessons across ExamForge." />

      <form className="mb-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); search(); }}>
        <input
          className="input"
          placeholder="Search the platform…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn btn-primary shrink-0">{loading ? 'Searching…' : 'Search'}</button>
      </form>

      {error && <ErrorAlert error={error} />}

      {data && total === 0 && q.trim() && (
        <EmptyState title="No results found" description={`Nothing matched "${q}". Try different keywords.`} />
      )}

      {data && total > 0 && (
        <>
          <p className="mb-6 text-sm text-ink-muted">{total} result{total === 1 ? '' : 's'} for "{q}"</p>
          <div className="space-y-8">
            {data.courses?.length > 0 && (
              <Section title="Courses">
                {data.courses.map((r) => (
                  <Link to={`/courses/${r.id}`} key={r.id} className="card p-4 hover:border-accent/30">
                    <p className="font-medium text-ink">{r.name}</p>
                    <p className="text-sm text-ink-muted">{r.code}{r.category ? ` · ${r.category}` : ''}</p>
                    {r.description && <p className="mt-1 text-sm text-ink-muted line-clamp-2">{r.description}</p>}
                  </Link>
                ))}
              </Section>
            )}
            {data.tests?.length > 0 && (
              <Section title="Tests">
                {data.tests.map((r) => (
                  <div key={r.id} className="card p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-ink">{r.title}</p>
                      <Badge tone={r.status === 'PUBLISHED' ? 'positive' : 'neutral'}>{r.status}</Badge>
                    </div>
                    {r.description && <p className="mt-1 text-sm text-ink-muted line-clamp-2">{r.description}</p>}
                  </div>
                ))}
              </Section>
            )}
            {data.questions?.length > 0 && (
              <Section title="Questions">
                {data.questions.map((r) => (
                  <div key={r.id} className="card p-4">
                    <p className="font-medium text-ink">{r.text}</p>
                    <div className="mt-2 flex gap-2">
                      <Badge>{r.type}</Badge>
                      <Badge tone="caution">{r.difficulty}</Badge>
                      {r.topic && <Badge tone="info">{r.topic}</Badge>}
                    </div>
                  </div>
                ))}
              </Section>
            )}
            {data.assignments?.length > 0 && (
              <Section title="Assignments">
                {data.assignments.map((r) => (
                  <div key={r.id} className="card p-4">
                    <p className="font-medium text-ink">{r.title}</p>
                    {r.dueAt && <p className="text-sm text-ink-muted">Due {new Date(r.dueAt).toLocaleDateString()}</p>}
                  </div>
                ))}
              </Section>
            )}
            {data.users?.length > 0 && (
              <Section title="Users">
                {data.users.map((r) => (
                  <div key={r.id} className="card flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-ink">{r.fullName || r.username}</p>
                      <p className="text-sm text-ink-muted">{r.email}</p>
                    </div>
                    <Badge>{r.role}</Badge>
                  </div>
                ))}
              </Section>
            )}
            {data.lessons?.length > 0 && (
              <Section title="Lessons">
                {data.lessons.map((r) => (
                  <div key={r.id} className="card flex items-center justify-between p-4">
                    <p className="font-medium text-ink">{r.title}</p>
                    <Badge tone="caution">{r.type}</Badge>
                  </div>
                ))}
              </Section>
            )}
          </div>
        </>
      )}

      {!data && !q.trim() && (
        <EmptyState title="Enter a search term" description="Search for courses, tests, questions, assignments, users, and lessons." />
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}