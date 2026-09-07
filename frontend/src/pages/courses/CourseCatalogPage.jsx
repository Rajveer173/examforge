import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Badge, EmptyState, ErrorAlert, PageHeader, Spinner } from '../../components/ui.jsx';
import { useAuthStore } from '../../store/authStore.js';

export function CourseCatalogPage() {
  const { user } = useAuthStore();
  const [courses, setCourses] = useState(null);
  const [enrolledIds, setEnrolledIds] = useState(new Set());
  const [error, setError] = useState(null);
  const [enrolling, setEnrolling] = useState(null);

  const load = async () => {
    try {
      const [courseRes, enrollmentRes] = await Promise.all([
        api.get('/courses'),
        api.get('/my-courses').catch(() => ({ data: { data: { enrollments: [] } } })),
      ]);
      const courseList = courseRes.data.data?.courses ?? courseRes.data.data?.items ?? courseRes.data.items ?? [];
      setCourses(courseList);
      const enrolled = enrollmentRes.data.data?.enrollments?.map((e) => e.courseId) ?? [];
      setEnrolledIds(new Set(enrolled));
    } catch (err) { setError(err); }
  };

  useEffect(() => { load(); }, []);

  const handleEnroll = async (courseId) => {
    setEnrolling(courseId);
    try {
      await api.post(`/courses/${courseId}/enroll`);
      setEnrolledIds((prev) => new Set([...prev, courseId]));
    } catch (err) { setError(err); }
    setEnrolling(null);
  };

  if (error) return <ErrorAlert error={error} />;
  if (courses === null) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader title="Course Catalog" description="Browse and enroll in courses" />

      {courses.length === 0 ? (
        <EmptyState title="No courses available" description="Courses will appear here once created." />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <div key={c.id} className="card flex flex-col">
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-ink">{c.name}</h3>
                  <Badge tone="info">{c.code}</Badge>
                </div>
                {c.description && <p className="mt-2 text-sm text-ink-muted line-clamp-3">{c.description}</p>}
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-muted">
                  {c.category && <span className="rounded-full bg-canvas px-2 py-0.5">{c.category}</span>}
                  {c._count && (
                    <>
                      <span>{c._count.modules ?? 0} modules</span>
                      <span>·</span>
                      <span>{c._count.tests ?? 0} tests</span>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {enrolledIds.has(c.id) ? (
                  <Link to={`/courses/${c.id}`} className="btn-primary flex-1 text-center">
                    Continue Learning
                  </Link>
                ) : (
                  <button
                    onClick={() => handleEnroll(c.id)}
                    disabled={enrolling === c.id}
                    className="btn-primary flex-1"
                  >
                    {enrolling === c.id ? 'Enrolling…' : 'Enroll'}
                  </button>
                )}
                <Link to={`/courses/${c.id}`} className="btn-secondary">Details</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
