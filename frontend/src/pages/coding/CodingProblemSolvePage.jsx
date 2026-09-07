import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Badge, ErrorAlert, Spinner } from '../../components/ui.jsx';

const defaultCode = '# Write your solution here\ndef solve():\n    pass\n';
const editorLanguage = { python: 'python', javascript: 'javascript', java: 'java', cpp: 'cpp', c: 'c' };

export function CodingProblemSolvePage() {
  const { problemId } = useParams();
  const [problem, setProblem] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [error, setError] = useState(null);
  const [code, setCode] = useState(defaultCode);
  const [language, setLanguage] = useState('python');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const load = () =>
    Promise.all([
      api.get(`/coding-problems/${problemId}`).then((r) => setProblem(r.data.data.problem)),
      api.get(`/coding-problems/${problemId}/submissions`).then((r) => setSubmissions(r.data.data.submissions || [])),
    ]).catch(setError);

  useEffect(() => { load(); }, [problemId]);

  const runCode = async () => {
    setRunning(true);
    setResult(null);
    try {
      const { data } = await api.post(`/coding-problems/${problemId}/execute`, { code, language });
      setResult(data.data);
      await Promise.all([
        api.get(`/coding-problems/${problemId}/submissions`).then((r) => setSubmissions(r.data.data.submissions || [])),
      ]);
    } catch (err) {
      setError(err);
    } finally {
      setRunning(false);
    }
  };

  if (error) return <ErrorAlert error={error} />;
  if (!problem) return <Spinner label="Loading problem…" />;

  const allowed = Array.isArray(problem.allowedLanguages)
    ? problem.allowedLanguages
    : (JSON.parse(problem.allowedLanguages || '[]'));
  const sample = Array.isArray(problem.testCases) ? problem.testCases[0] : null;
  const passed = result?.status === 'ACCEPTED';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{problem.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={problem.difficulty === 'EASY' ? 'positive' : problem.difficulty === 'MEDIUM' ? 'caution' : 'critical'}>{problem.difficulty}</Badge>
            <Badge tone="info">{language}</Badge>
            <span className="text-xs text-ink-subtle">{(problem.timeLimitMs / 1000).toFixed(1)}s limit</span>
          </div>
        </div>
        <select className="input w-40" value={language} onChange={(e) => setLanguage(e.target.value)}>
          {(allowed || []).map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <p className="text-ink-muted">{problem.description}</p>

      {sample && (
        <div className="rounded-lg border border-line p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Sample Test Case</p>
          <pre className="mt-2 rounded bg-canvas p-3 text-sm whitespace-pre-wrap"><code>{`Input:\n${sample.input || ''}\nExpected output:\n${sample.expectedOutput}`}</code></pre>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Solution</p>
            <div className="flex gap-2">
              <button onClick={() => setCode(defaultCode)} disabled={running} className="btn btn-secondary px-3 py-1.5">Reset</button>
              <button onClick={runCode} disabled={running} className="btn btn-primary px-3 py-1.5">
                {running ? 'Running…' : 'Run Code'}
              </button>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-line-strong bg-ink">
            <Editor
              height="420px"
              language={editorLanguage[language] ?? language}
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value ?? '')}
              options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 16 }, automaticLayout: true, scrollBeyondLastLine: false }}
            />
          </div>
          {result && (
            <div className={`mt-3 rounded-lg border p-4 ${passed ? 'border-positive/30 bg-positive-soft' : 'border-critical/30 bg-critical-soft'}`}>
              <p className={`text-sm font-semibold ${passed ? 'text-positive-ink' : 'text-critical-ink'}`}>
                {result.status} — {result.passedCount}/{result.totalCount} passed
              </p>
              {result.executionTime != null && (
                <p className="mt-1 text-xs text-ink-muted">Execution time: {result.executionTime}ms</p>
              )}
              {result.error && <pre className="mt-2 text-xs whitespace-pre-wrap text-critical-ink">{result.error}</pre>}
              {Array.isArray(result.results) && result.results.length > 0 && (
                <div className="mt-3 space-y-2">
                  {result.results.map((r, i) => (
                    <div key={i} className={`rounded px-3 py-2 text-xs ${r.passed ? 'bg-positive-soft text-positive-ink' : 'bg-critical-soft text-critical-ink'}`}>
                      <span className="font-semibold">Case #{i + 1}: {r.passed ? 'Passed' : 'Failed'}</span>
                      {!r.passed && (
                        <pre className="mt-1 whitespace-pre-wrap"><code>expected: {r.expected}\nactual:   {r.actual}</code></pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink">Submission History</p>
          {submissions.length === 0 ? (
            <p className="text-sm text-ink-subtle">No submissions yet.</p>
          ) : (
            <div className="space-y-2">
              {submissions.map((s) => (
                <div key={s.id} className="card flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-ink">{s.language}</p>
                    <p className="text-xs text-ink-subtle">{new Date(s.createdAt).toLocaleString()}</p>
                  </div>
                  <Badge tone={s.status === 'ACCEPTED' ? 'positive' : s.status === 'ERROR' ? 'critical' : 'caution'}>
                    {s.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}