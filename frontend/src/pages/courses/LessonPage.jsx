import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Badge, ErrorAlert, Spinner } from '../../components/ui.jsx';
import { useAuthStore } from '../../store/authStore.js';

export function LessonPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [lesson, setLesson] = useState(null);
  const [progress, setProgress] = useState({ completed: false });
  const [error, setError] = useState(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    api.get(`/lessons/${lessonId}`)
      .then((res) => setLesson(res.data.data.lesson))
      .catch(setError);
  }, [lessonId]);

  const markComplete = async () => {
    setMarking(true);
    try {
      await api.post(`/lessons/${lessonId}/complete`);
      setProgress({ completed: true });
    } catch (err) { setError(err); }
    setMarking(false);
  };

  if (error) return <ErrorAlert error={error} />;
  if (!lesson) return <Spinner />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <button onClick={() => navigate(-1)} className="mb-3 text-sm text-accent hover:underline">&larr; Back</button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-ink">{lesson.title}</h1>
          <Badge tone={lesson.type === 'video' ? 'accent' : lesson.type === 'pdf' ? 'critical' : 'neutral'}>{lesson.type}</Badge>
          {lesson.durationMin && <span className="text-sm text-ink-muted">{lesson.durationMin} min</span>}
        </div>
        {lesson.module && <p className="mt-1 text-sm text-ink-muted">{lesson.module.title}</p>}
      </div>

      {lesson.type === 'video' && lesson.videoUrl && (
        <div className="card overflow-hidden p-0">
          <div className="aspect-video bg-ink flex items-center justify-center">
            <video src={lesson.videoUrl} controls className="h-full w-full" />
          </div>
        </div>
      )}

      {lesson.type === 'pdf' && lesson.videoUrl && (
        <div className="card">
          <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
            Open PDF Document
          </a>
        </div>
      )}

      {lesson.type === 'external' && lesson.videoUrl && (
        <div className="card">
          <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
            Open External Resource
          </a>
        </div>
      )}

      {lesson.content && (
        <div className="card">
          <div className="prose prose-slate max-w-none whitespace-pre-wrap text-sm text-ink">{lesson.content}</div>
        </div>
      )}

      {lesson.resources?.length > 0 && (
        <div className="card">
          <h3 className="mb-3 font-semibold text-ink">Resources</h3>
          <div className="space-y-2">
            {lesson.resources.map((r) => (
              <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-accent hover:underline">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {r.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {user?.role === 'STUDENT' && (
        <div className="flex justify-center">
          {progress.completed ? (
            <div className="rounded-lg bg-positive-soft px-6 py-3 text-sm font-medium text-positive-ink">
              Completed
            </div>
          ) : (
            <button onClick={markComplete} disabled={marking} className="btn-primary">
              {marking ? 'Marking…' : 'Mark as Complete'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
