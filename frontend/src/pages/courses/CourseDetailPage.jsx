import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorAlert, Modal, PageHeader, Spinner, Field } from '../../components/ui.jsx';
import { useAuthStore } from '../../store/authStore.js';
import { useToast } from '../../components/toast.jsx';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const moduleSchema = z.object({ title: z.string().min(1), description: z.string().optional() });
const lessonSchema = z.object({ title: z.string().min(1), content: z.string().optional(), type: z.enum(['text', 'video', 'pdf', 'external']).default('text'), videoUrl: z.string().url().optional().nullable() });

export function CourseDetailPage() {
  const { courseId } = useParams();
  const { user } = useAuthStore();
  const isStaff = user?.role === 'ADMIN' || user?.role === 'TEACHER';
  const toast = useToast();

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [showModule, setShowModule] = useState(false);
  const [showLesson, setShowLesson] = useState(null);
  const [enrolled, setEnrolled] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [editingLesson, setEditingLesson] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const modForm = useForm({ resolver: zodResolver(moduleSchema) });
  const lessonForm = useForm({ resolver: zodResolver(lessonSchema) });
  const editModForm = useForm({ resolver: zodResolver(moduleSchema) });
  const editLessonForm = useForm({ resolver: zodResolver(lessonSchema) });

  const load = async () => {
    try {
      const [modRes, progRes] = await Promise.all([
        api.get(`/courses/${courseId}/modules`),
        api.get(`/courses/${courseId}/progress`).catch(() => ({ data: { data: { progress: null } } })),
      ]);
      setModules(modRes.data.data.modules);
      setProgress(progRes.data.data.progress);
      setEnrolled(true);
    } catch (err) {
      if (err?.response?.status === 404) {
        try {
          const res = await api.get('/courses');
          const list = res.data.data?.courses ?? res.data.data?.items ?? res.data.items ?? [];
          const found = list.find((c) => c.id === courseId);
          if (found) { setCourse(found); setModules([]); setEnrolled(false); return; }
        } catch (_) {}
      }
      setError(err);
    }
  };

  useEffect(() => { load(); }, [courseId]);

  const onCreateModule = async (data) => {
    try {
      await api.post(`/courses/${courseId}/modules`, data);
      setShowModule(false);
      modForm.reset();
      load();
      toast.success('Module created');
    } catch (err) { setError(err); }
  };

  const onUpdateModule = async (data) => {
    if (!editingModule) return;
    setBusy(true);
    try {
      await api.put(`/modules/${editingModule.id}`, data);
      setEditingModule(null);
      editModForm.reset();
      load();
      toast.success('Module updated');
    } catch (err) { setError(err); }
    setBusy(false);
  };

  const onCreateLesson = async (data) => {
    if (!showLesson) return;
    try {
      await api.post(`/modules/${showLesson}/lessons`, data);
      setShowLesson(null);
      lessonForm.reset();
      load();
      toast.success('Lesson created');
    } catch (err) { setError(err); }
  };

  const onUpdateLesson = async (data) => {
    if (!editingLesson) return;
    setBusy(true);
    try {
      await api.put(`/lessons/${editingLesson.id}`, data);
      setEditingLesson(null);
      editLessonForm.reset();
      load();
      toast.success('Lesson updated');
    } catch (err) { setError(err); }
    setBusy(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      if (confirmDelete.type === 'module') {
        await api.delete(`/modules/${confirmDelete.id}`);
        toast.success('Module deleted');
      } else {
        await api.delete(`/lessons/${confirmDelete.id}`);
        toast.success('Lesson deleted');
      }
      load();
    } catch (err) { setError(err); }
    setBusy(false);
    setConfirmDelete(null);
  };

  const handleEnroll = async () => {
    try { await api.post(`/courses/${courseId}/enroll`); setEnrolled(true); load(); } catch (err) { setError(err); }
  };

  const openEditModule = (mod) => {
    editModForm.reset({ title: mod.title, description: mod.description || '' });
    setEditingModule(mod);
  };

  const openEditLesson = (lesson) => {
    editLessonForm.reset({
      title: lesson.title,
      content: lesson.content || '',
      type: lesson.type || 'text',
      videoUrl: lesson.videoUrl || '',
    });
    setEditingLesson(lesson);
  };

  if (error) return <ErrorAlert error={error} />;
  if (modules === null && !course) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader title={course?.name ?? 'Course'} description={course?.description || 'Course modules and lessons'}>
        {isStaff && <button onClick={() => setShowModule(true)} className="btn-primary">Add Module</button>}
        {!isStaff && !enrolled && <button onClick={handleEnroll} className="btn-primary">Enroll in Course</button>}
      </PageHeader>

      {progress && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-ink">Your Progress</span>
            <span className="text-sm font-bold text-accent">{progress.percentage}%</span>
          </div>
          <div className="h-2 rounded-full bg-line">
            <div className="h-2 rounded-full bg-accent transition-all" style={{ width: `${progress.percentage}%` }} />
          </div>
          <p className="mt-1 text-xs text-ink-muted">{progress.completedLessons} of {progress.totalLessons} lessons completed</p>
        </div>
      )}

      {modules.length === 0 ? (
        <EmptyState title="No modules yet" description={isStaff ? "Create the first module to get started." : "Course content will appear here."} />
      ) : (
        <div className="space-y-4">
          {modules.map((mod, idx) => (
            <div key={mod.id} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-ink">
                    <span className="mr-2 text-xs text-ink-subtle">Module {idx + 1}</span>
                    {mod.title}
                  </h3>
                  {mod.description && <p className="mt-1 text-sm text-ink-muted">{mod.description}</p>}
                </div>
                {isStaff && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setShowLesson(mod.id)}>
                      + Lesson
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEditModule(mod)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete({ type: 'module', id: mod.id })}>
                      Delete
                    </Button>
                  </div>
                )}
              </div>
              <div className="mt-3 divide-y divide-line">
                {(mod.lessons ?? []).length === 0 ? (
                  <p className="py-2 text-sm text-ink-subtle">No lessons in this module</p>
                ) : (
                  (mod.lessons ?? []).map((lesson) => (
                    <div key={lesson.id} className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded hover:bg-canvas">
                      <Link to={`/lessons/${lesson.id}`} className="flex items-center gap-2 flex-1 min-w-0">
                        <Badge tone={lesson.type === 'video' ? 'accent' : lesson.type === 'pdf' ? 'critical' : 'neutral'}>{lesson.type}</Badge>
                        <span className="text-sm text-ink truncate">{lesson.title}</span>
                        {lesson.durationMin && <span className="text-xs text-ink-subtle shrink-0">{lesson.durationMin} min</span>}
                      </Link>
                      {isStaff && (
                        <div className="flex gap-1 shrink-0 ml-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditLesson(lesson)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete({ type: 'lesson', id: lesson.id })}>
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!showModule} onClose={() => setShowModule(false)} title="Create Module">
        <form onSubmit={modForm.handleSubmit(onCreateModule)} className="space-y-4">
          <Field label="Title" error={modForm.formState.errors.title?.message}>
            <input {...modForm.register('title')} className="input" placeholder="Module title" />
          </Field>
          <Field label="Description">
            <textarea {...modForm.register('description')} className="input" rows={3} placeholder="Optional description" />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowModule(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!showLesson} onClose={() => setShowLesson(null)} title="Add Lesson">
        <form onSubmit={lessonForm.handleSubmit(onCreateLesson)} className="space-y-4">
          <Field label="Title" error={lessonForm.formState.errors.title?.message}>
            <input {...lessonForm.register('title')} className="input" placeholder="Lesson title" />
          </Field>
          <Field label="Type">
            <select {...lessonForm.register('type')} className="input">
              <option value="text">Text</option>
              <option value="video">Video</option>
              <option value="pdf">PDF</option>
              <option value="external">External Link</option>
            </select>
          </Field>
          <Field label="Content">
            <textarea {...lessonForm.register('content')} className="input" rows={6} placeholder="Lesson content (markdown supported)" />
          </Field>
          <Field label="Video URL">
            <input {...lessonForm.register('videoUrl')} className="input" placeholder="https://..." />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowLesson(null)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editingModule} onClose={() => setEditingModule(null)} title="Edit Module">
        <form onSubmit={editModForm.handleSubmit(onUpdateModule)} className="space-y-4">
          <Field label="Title" error={editModForm.formState.errors.title?.message}>
            <input {...editModForm.register('title')} className="input" placeholder="Module title" />
          </Field>
          <Field label="Description">
            <textarea {...editModForm.register('description')} className="input" rows={3} placeholder="Optional description" />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditingModule(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editingLesson} onClose={() => setEditingLesson(null)} title="Edit Lesson">
        <form onSubmit={editLessonForm.handleSubmit(onUpdateLesson)} className="space-y-4">
          <Field label="Title" error={editLessonForm.formState.errors.title?.message}>
            <input {...editLessonForm.register('title')} className="input" placeholder="Lesson title" />
          </Field>
          <Field label="Type">
            <select {...editLessonForm.register('type')} className="input">
              <option value="text">Text</option>
              <option value="video">Video</option>
              <option value="pdf">PDF</option>
              <option value="external">External Link</option>
            </select>
          </Field>
          <Field label="Content">
            <textarea {...editLessonForm.register('content')} className="input" rows={6} placeholder="Lesson content (markdown supported)" />
          </Field>
          <Field label="Video URL">
            <input {...editLessonForm.register('videoUrl')} className="input" placeholder="https://..." />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditingLesson(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={busy}
        title={`Delete ${confirmDelete?.type === 'module' ? 'module' : 'lesson'}?`}
        description={confirmDelete?.type === 'module' ? 'All lessons in this module will also be deleted.' : 'This action cannot be undone.'}
        confirmLabel="Delete"
      />
    </div>
  );
}
