import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Badge, EmptyState, ErrorAlert, PageHeader, Spinner } from '../../components/ui.jsx';

export function MyCoursesPage() {
  const [enrollments, setEnrollments] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/my-courses')
      .then((res) => setEnrollments(res.data.data.enrollments))
      .catch(setError);
  }, []);

  if (error) return <ErrorAlert error={error} />;
  if (enrollments === null) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader title="My Courses" description="Courses you are enrolled in" />

      {enrollments.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="Browse the course catalog to enroll."
          action={<Link to="/courses" className="btn-primary mt-2 inline-block">Browse Courses</Link>}
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {enrollments.map((e) => {
            const c = e.course;
            return (
              <div key={e.id} className="card flex flex-col">
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-ink">{c.name}</h3>
                    <Badge tone="info">{c.code}</Badge>
                  </div>
                  <div className="mt-2 flex gap-3 text-xs text-ink-muted">
                    <span>{c._count?.modules ?? 0} modules</span>
                    <span>{c._count?.tests ?? 0} tests</span>
                    <span>{c._count?.assignments ?? 0} assignments</span>
                  </div>
                </div>
                <div className="mt-4">
                  <Link to={`/courses/${c.id}`} className="btn-primary w-full text-center">Open Course</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
