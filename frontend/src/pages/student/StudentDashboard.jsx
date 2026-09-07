import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BookOpen, Code2, FileText, Trophy } from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  ErrorAlert,
  PageHeader,
  Panel,
  ProgressBar,
  StatTile,
  Table,
} from '../../components/ui.jsx';
import { formatDate, formatNumber, formatPercent, formatRelative } from '../../lib/format.js';
import { StatSkeleton } from '../_shared/Async.jsx';
import { getData, getDataOptional, retryUnlessDenied } from '../_shared/request.js';
import { axisProps, tooltipProps, useChartColors } from '../_shared/chart.js';

export function StudentDashboard() {
  const colors = useChartColors();

  const [assigned, results, assignments, myCourses, coding] = useQueries({
    queries: [
      { queryKey: ['tests', 'assigned'], queryFn: () => getData('/tests/assigned'), retry: retryUnlessDenied },
      { queryKey: ['results', 'my'], queryFn: () => getData('/results/my?limit=50'), retry: retryUnlessDenied },
      { queryKey: ['assignments', 'student'], queryFn: () => getData('/assignments?limit=20'), retry: retryUnlessDenied },
      { queryKey: ['my-courses'], queryFn: () => getData('/my-courses'), retry: retryUnlessDenied },
      { queryKey: ['coding', 'problems'], queryFn: () => getData('/coding-problems'), retry: retryUnlessDenied },
    ],
  });

  const progress = useQuery({
    queryKey: ['analytics', 'me'],
    queryFn: () => getDataOptional('/analytics/me'),
    retry: retryUnlessDenied,
    staleTime: 60_000,
  });

  const loading = [assigned, results, assignments, myCourses, coding].some((q) => q.isPending);
  const failed = [assigned, results, assignments, myCourses, coding].find((q) => q.isError);

  if (failed) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Learning" title="Dashboard" />
        <ErrorAlert
          error={failed.error}
          onRetry={() => [assigned, results, assignments, myCourses, coding].forEach((q) => q.refetch())}
        />
      </div>
    );
  }

  const tests = assigned.data?.items ?? [];
  const resultItems = results.data?.items ?? [];
  const assignmentItems = assignments.data?.items ?? [];
  const enrollments = myCourses.data?.enrollments ?? [];
  const codingItems = coding.data?.items ?? [];

  const openNow = tests.filter((t) => t.canAttempt);
  const scored = resultItems.filter((r) => r.percentage !== null);
  const avgPercentage = scored.length
    ? scored.reduce((sum, r) => sum + Number(r.percentage), 0) / scored.length
    : null;
  const passed = resultItems.filter((r) => r.passed).length;

  // Fall back to deriving the trend from the results list when the analytics
  // endpoint is unavailable, so the chart is never blank for an active candidate.
  const series =
    progress.data?.series?.length
      ? progress.data.series
      : scored
          .slice()
          .reverse()
          .map((r) => ({
            date: new Date(r.submittedAt).toISOString().slice(0, 10),
            avgScore: Number(r.percentage),
          }));

  const progressByCourse = new Map(
    (progress.data?.byCourse ?? []).map((course) => [course.courseId, course.progress ?? 0]),
  );

  const upcomingAssignments = assignmentItems
    .filter((a) => a.dueAt && new Date(a.dueAt) > new Date())
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Learning"
        title="Dashboard"
        description="Tests open to you now, your recent scores and where you left off."
        actions={
          <div className="flex gap-2">
            <Button as={Link} to="/student/coding-problems" variant="secondary">
              Coding problems
            </Button>
            <Button as={Link} to="/student/progress" variant="secondary">
              My progress
            </Button>
            <Button as={Link} to="/student/tests">
              My tests
            </Button>
          </div>
        }
      />

      {loading ? (
        <StatSkeleton count={4} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Open now"
            value={formatNumber(openNow.length)}
            hint={`${formatNumber(tests.length)} assigned in total`}
            tone={openNow.length > 0 ? 'accent' : 'neutral'}
            icon={FileText}
          />
          <StatTile
            label="Attempts"
            value={formatNumber(resultItems.length)}
            hint={`${formatNumber(passed)} passed`}
            icon={Trophy}
          />
          <StatTile
            label="Average score"
            value={avgPercentage === null ? 'No results' : formatPercent(avgPercentage)}
            hint="Across evaluated attempts"
          />
          <StatTile
            label="Courses"
            value={formatNumber(enrollments.length)}
            hint={`${formatNumber(assignmentItems.length)} assignments`}
            icon={BookOpen}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel
          title="Open tests"
          description="Start when you are ready; the timer runs from the moment you begin."
          action={
            <Link className="link text-sm" to="/student/tests">
              All tests
            </Link>
          }
        >
          {openNow.length === 0 ? (
            <EmptyState
              title="Nothing open right now"
              description={
                tests.length > 0
                  ? 'Your assigned tests are outside their window or you have used every attempt.'
                  : 'Once a teacher assigns you a test it appears here.'
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {openNow.slice(0, 5).map((test) => (
                <li key={test.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{test.title}</p>
                    <p className="tabular text-xs text-ink-muted">
                      {test.durationMinutes} min · {test.questionCount} questions · {test.totalMarks} marks
                      {test.endAt ? ` · closes ${formatRelative(test.endAt)}` : ''}
                    </p>
                  </div>
                  <Button as={Link} to={`/student/tests/${test.id}/exam`} size="sm">
                    {test.attemptsUsed > 0 ? 'Retake' : 'Start'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Score trend"
          action={
            <Link className="link text-sm" to="/student/progress">
              Details
            </Link>
          }
        >
          {series.length === 0 ? (
            <EmptyState title="No scores yet" description="Submit a test to start the trend." />
          ) : (
            <div className="h-56" role="img" aria-label="Score percentage over time">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke={colors.line} vertical={false} />
                  <XAxis dataKey="date" {...axisProps(colors)} />
                  <YAxis {...axisProps(colors)} width={40} domain={[0, 100]} />
                  <Tooltip {...tooltipProps(colors)} />
                  <Line
                    type="monotone"
                    dataKey="avgScore"
                    name="Score"
                    stroke={colors.accent}
                    strokeWidth={2}
                    dot={{ r: 3, fill: colors.accent, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Recent results"
          action={
            <Link className="link text-sm" to="/student/results">
              All results
            </Link>
          }
        >
          {resultItems.length === 0 ? (
            <EmptyState title="No results yet" />
          ) : (
            <Table
              dense
              head={[
                { key: 'test', label: 'Test' },
                { key: 'score', label: 'Score', align: 'right' },
                { key: 'outcome', label: 'Outcome' },
                { key: 'when', label: 'Submitted' },
              ]}
            >
              {resultItems.slice(0, 6).map((result) => (
                <tr key={result.id}>
                  <td>
                    <Link className="link" to={`/student/results/${result.id}`}>
                      {result.test.title}
                    </Link>
                  </td>
                  <td className="tabular text-right">
                    {result.score === null ? '—' : `${result.score}/${result.test.totalMarks}`}
                  </td>
                  <td>
                    {result.passed === null ? (
                      <Badge tone="caution">Pending</Badge>
                    ) : (
                      <Badge tone={result.passed ? 'positive' : 'critical'}>
                        {result.passed ? 'Passed' : 'Failed'}
                      </Badge>
                    )}
                  </td>
                  <td className="text-ink-muted">{formatDate(result.submittedAt)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>

        <Panel
          title="Course progress"
          action={
            <Link className="link text-sm" to="/my-courses">
              My courses
            </Link>
          }
        >
          {enrollments.length === 0 ? (
            <EmptyState
              title="Not enrolled in anything yet"
              description="Browse the catalogue to enrol in a course."
              action={
                <Button as={Link} to="/courses">
                  Browse courses
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {enrollments.slice(0, 5).map((enrollment) => {
                // The enrolment payload carries no completion figure, so use the
                // analytics breakdown when it is available and fall back to counts.
                const percentage = progressByCourse.get(enrollment.courseId);
                const name = enrollment.course?.name ?? 'Course';
                return (
                  <li key={enrollment.id} className="py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link className="link truncate text-sm font-medium" to={`/courses/${enrollment.courseId}`}>
                        {name}
                      </Link>
                      <span className="tabular shrink-0 text-xs text-ink-muted">
                        {percentage === undefined
                          ? `${formatNumber(enrollment.course?._count?.modules ?? 0)} modules`
                          : formatPercent(percentage)}
                      </span>
                    </div>
                    {percentage === undefined ? (
                      <p className="text-xs text-ink-subtle">
                        {formatNumber(enrollment.course?._count?.tests ?? 0)} tests ·{' '}
                        {formatNumber(enrollment.course?._count?.assignments ?? 0)} assignments
                      </p>
                    ) : (
                      <ProgressBar value={percentage} max={100} tone="accent" label={`${name} progress`} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Coding challenges"
        description={
          codingItems.length > 0
            ? `${formatNumber(codingItems.length)} problems available for practice`
            : 'Practice problems published by your instructors'
        }
        action={
          <Link className="link text-sm" to="/student/coding-problems">
            All problems
          </Link>
        }
      >
        {codingItems.length === 0 ? (
          <EmptyState
            title="No coding problems yet"
            description="Once an instructor publishes a coding problem, it appears here to solve."
          />
        ) : (
          <Table
            dense
            head={[
              { key: 'title', label: 'Problem' },
              { key: 'difficulty', label: 'Difficulty' },
              { key: 'limit', label: 'Time limit', align: 'right' },
              { key: 'action', label: '', align: 'right' },
            ]}
          >
            {codingItems.slice(0, 5).map((problem) => (
              <tr key={problem.id}>
                <td>
                  <Link className="link font-medium" to={`/student/coding-problems/${problem.id}`}>
                    {problem.title}
                  </Link>
                  <p className="max-w-md truncate text-xs text-ink-subtle">{problem.description}</p>
                </td>
                <td>
                  <Badge
                    tone={
                      problem.difficulty === 'EASY'
                        ? 'positive'
                        : problem.difficulty === 'MEDIUM'
                          ? 'caution'
                          : 'critical'
                    }
                  >
                    {problem.difficulty}
                  </Badge>
                </td>
                <td className="tabular text-right text-ink-muted">
                  {(Number(problem.timeLimitMs ?? 0) / 1000).toFixed(1)}s
                </td>
                <td className="text-right">
                  <Button as={Link} to={`/student/coding-problems/${problem.id}`} size="sm" variant="secondary">
                    <Code2 className="size-4" /> Solve
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      {upcomingAssignments.length > 0 && (
        <Panel
          title="Assignments due soon"
          action={
            <Link className="link text-sm" to="/student/assignments">
              All assignments
            </Link>
          }
        >
          <Table
            dense
            head={[
              { key: 'title', label: 'Assignment' },
              { key: 'course', label: 'Course' },
              { key: 'marks', label: 'Marks', align: 'right' },
              { key: 'due', label: 'Due' },
            ]}
          >
            {upcomingAssignments.map((assignment) => (
              <tr key={assignment.id}>
                <td className="font-medium text-ink">{assignment.title}</td>
                <td className="text-ink-muted">{assignment.course?.name ?? '—'}</td>
                <td className="tabular text-right">{formatNumber(assignment.maxMarks ?? 0)}</td>
                <td className="text-ink-muted">{formatRelative(assignment.dueAt)}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}
    </div>
  );
}
