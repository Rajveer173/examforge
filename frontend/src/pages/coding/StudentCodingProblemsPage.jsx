import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Badge, EmptyState, ErrorAlert, PageHeader, Spinner } from '../../components/ui.jsx';

export function StudentCodingProblemsPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/coding-problems')
      .then((r) => setItems(r.data.data.items))
      .catch(setError);
  }, []);

  if (error) return <ErrorAlert error={error} />;
  if (!items) return <Spinner label="Loading coding problems…" />;

  return (
    <div>
      <PageHeader
        title="Coding Problems"
        description="Practice coding challenges to sharpen your programming skills."
      />

      {items.length === 0 && (
        <EmptyState title="No coding problems available" description="Your instructor hasn't added any coding problems yet." />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <Link key={p.id} to={`/student/coding-problems/${p.id}`} className="card p-5 transition-colors hover:border-accent/30">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-ink">{p.title}</h3>
              <Badge tone={p.difficulty === 'EASY' ? 'positive' : p.difficulty === 'MEDIUM' ? 'caution' : 'critical'}>
                {p.difficulty}
              </Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{p.description}</p>
            <div className="mt-4 flex items-center justify-between text-xs text-ink-subtle">
              <span>{(p.timeLimitMs / 1000).toFixed(1)}s limit</span>
              <span className="font-medium text-accent">Solve →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}