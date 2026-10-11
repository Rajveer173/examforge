import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp, MessagesSquare, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { api } from '../../api/client.js';
import { ConfirmDialog, ErrorAlert, Spinner, cx, errorMessage } from '../../components/ui.jsx';
import { Markdown } from '../../components/Markdown.jsx';
import { useAuthStore } from '../../store/authStore.js';

// The tutor model can take well over the client's default 30 s on a long answer.
const SEND_TIMEOUT_MS = 120_000;
const MAX_INPUT_HEIGHT = 200;

const PROMPTS = {
  STUDENT: [
    'What assignments and tests are pending for me?',
    'How many coding problems do I have left, and what type?',
    'Explain recursion with a simple Python example',
    'Make me a 7-day revision plan for my upcoming exams',
    'Compare TCP and UDP in a table',
    'Give me 5 practice MCQs on SQL joins with answers',
    'How should I manage time during a timed online test?',
    'Summarise the key ideas of Big-O notation',
  ],
  TEACHER: [
    'How many assignments are waiting for grading?',
    'Draft 5 MCQs on photosynthesis with an answer key',
    'Create a rubric for a short-answer question on Newton’s laws',
    'Suggest ways to help students who are failing algebra',
    'Write a lesson outline on binary search for 45 minutes',
    'Turn this topic into easy / medium / hard questions: linked lists',
    'How can I design tests that discourage cheating?',
  ],
  ADMIN: [
    'How many students do we have, and how many graduate this year?',
    'Give me a live platform overview',
    'Suggest a policy for proctored online exams',
    'How should we structure courses and batches for a new semester?',
    'Draft an announcement about the exam schedule',
    'What metrics should I track to measure student performance?',
    'Write onboarding steps for new teachers on the platform',
  ],
  PROCTOR: [
    'What are common signs of cheating in online exams?',
    'Draft a message warning a candidate about tab switching',
    'Write a checklist for monitoring a live test session',
    'How should I log and report a proctoring incident?',
  ],
};

const SUBTITLES = {
  STUDENT: 'Ask about a concept, get practice questions, or plan your revision.',
  TEACHER: 'Draft questions, rubrics and lesson plans, or get teaching ideas.',
  ADMIN: 'Get help with policies, announcements and running the platform.',
  PROCTOR: 'Get help monitoring exams and handling incidents.',
};

const isUserMessage = (m) => m.role === 'student' || m.role === 'user';

function TypingIndicator() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex justify-start" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-2xl rounded-bl-md bg-canvas px-4 py-3 ring-1 ring-inset ring-line">
        <span className="flex items-center gap-1" aria-hidden="true">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/70"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
        <span className="text-xs text-ink-subtle">
          {seconds < 5 ? 'Thinking…' : `Thinking… ${seconds}s`}
          {seconds >= 15 && ' — long answers can take up to a minute'}
        </span>
      </div>
    </div>
  );
}

function EmptyState({ role, name, onPick, disabled }) {
  const prompts = PROMPTS[role] ?? PROMPTS.STUDENT;
  const firstName = name ? String(name).split(' ')[0] : null;
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">
        <Sparkles className="h-6 w-6" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-ink">
        {firstName ? `How can I help, ${firstName}?` : 'How can I help?'}
      </h2>
      <p className="mt-1 max-w-md text-sm text-ink-muted">{SUBTITLES[role] ?? SUBTITLES.STUDENT}</p>
      <ul className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Example prompts">
        {prompts.map((p) => (
          <li key={p}>
            <button
              type="button"
              onClick={() => onPick(p)}
              disabled={disabled}
              className="h-full w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-left text-sm text-ink-muted transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/15 disabled:opacity-50"
            >
              {p}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AiAssistantPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? 'STUDENT';

  const [conversations, setConversations] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const activeIdRef = useRef(null);
  // A conversation created by send() already has its optimistic message on
  // screen; fetching it would race that and blank the chat for a moment.
  const skipFetchRef = useRef(null);
  const loadedRef = useRef(false);

  activeIdRef.current = active?.id ?? null;

  const loadConversations = useCallback(
    () =>
      api
        .get('/ai/conversations')
        .then((r) => {
          loadedRef.current = true;
          setConversations(r.data.data.conversations);
          setLoadError(null);
        })
        .catch((err) => {
          // Only a failure on first load replaces the page; later refreshes are best-effort.
          if (!loadedRef.current) setLoadError(err);
        }),
    [],
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const id = active?.id;
    if (!id) return undefined;
    if (skipFetchRef.current === id) {
      skipFetchRef.current = null;
      return undefined;
    }
    let cancelled = false;
    setLoadingMessages(true);
    api
      .get(`/ai/conversations/${id}`)
      .then((r) => !cancelled && setMessages(r.data.data.conversation.messages || []))
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoadingMessages(false));
    return () => {
      cancelled = true;
    };
  }, [active?.id]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  // Grow the composer with its content, up to a cap.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_INPUT_HEIGHT ? 'auto' : 'hidden';
  }, [input]);

  const selectConversation = (c) => {
    if (c.id !== active?.id) {
      setMessages([]);
      setActive(c);
    }
    setError(null);
    setListOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const startNewChat = () => {
    // A conversation is created lazily on the first message, so empty chats
    // never pile up in the list.
    setActive(null);
    setMessages([]);
    setError(null);
    setListOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const send = async (override) => {
    const content = (typeof override === 'string' ? override : input).trim();
    if (!content || busy) return;
    setBusy(true);
    setError(null);
    setInput('');
    const pendingId = `pending-${Date.now()}`;

    let convId = active?.id;
    // Show the question straight away; the model can take several seconds to reply.
    setMessages((prev) => [...(convId ? prev : []), { id: pendingId, role: 'user', content }]);

    try {
      if (!convId) {
        const title = content.length > 60 ? `${content.slice(0, 57).trimEnd()}…` : content;
        const { data } = await api.post('/ai/conversations', { title });
        const conv = data.data.conversation;
        convId = conv.id;
        skipFetchRef.current = conv.id;
        setActive(conv);
        setConversations((prev) => [conv, ...(prev ?? [])]);
      }
      const { data: sent } = await api.post(
        `/ai/conversations/${convId}/messages`,
        { content },
        { timeout: SEND_TIMEOUT_MS },
      );
      if (activeIdRef.current !== convId) return; // user switched chats meanwhile
      try {
        const { data } = await api.get(`/ai/conversations/${convId}`);
        if (activeIdRef.current === convId) setMessages(data.data.conversation.messages || []);
      } catch {
        // The reply was saved; show it even if the refresh failed.
        const reply = sent?.data?.message;
        if (reply) setMessages((prev) => [...prev, reply]);
      }
      loadConversations();
    } catch (err) {
      if (activeIdRef.current === convId || !convId) {
        setMessages((prev) => prev.filter((m) => m.id !== pendingId));
        setInput(content);
      }
      setError(err);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const deleteConversation = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/ai/conversations/${confirmDelete.id}`);
      if (active?.id === confirmDelete.id) {
        setActive(null);
        setMessages([]);
      }
      await loadConversations();
    } catch (err) {
      setError(err);
    } finally {
      setConfirmDelete(null);
    }
  };

  if (loadError) {
    return (
      <ErrorAlert
        error={loadError}
        onRetry={() => {
          setLoadError(null);
          loadConversations();
        }}
      />
    );
  }
  if (!conversations) return <Spinner label="Loading AI assistant…" />;

  const showEmpty = !loadingMessages && messages.length === 0 && !busy;

  return (
    <div className="flex h-[calc(100dvh-14.5rem)] min-h-[30rem] flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">{role === 'STUDENT' ? 'AI Study Assistant' : 'AI Assistant'}</h1>
          <p className="mt-1 hidden text-sm text-ink-muted sm:block">
            Ask questions, clarify concepts, and get study and teaching help.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            className="btn btn-secondary btn-md lg:hidden"
            aria-expanded={listOpen}
            aria-controls="ai-conversation-list"
          >
            <MessagesSquare className="h-4 w-4" aria-hidden="true" />
            <span>Chats</span>
          </button>
          <button type="button" onClick={startNewChat} disabled={busy} className="btn btn-primary btn-md">
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>New chat</span>
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <nav
          id="ai-conversation-list"
          aria-label="Conversations"
          className={cx(
            'min-h-0 flex-col overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-card lg:flex',
            listOpen ? 'flex' : 'hidden',
          )}
        >
          <div className="mb-1 flex items-center justify-between px-2 py-1 lg:hidden">
            <span className="text-sm font-semibold text-ink">Conversations</span>
            <button
              type="button"
              onClick={() => setListOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-canvas"
              aria-label="Close conversation list"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {conversations.length === 0 && <p className="p-2 text-sm text-ink-subtle">No conversations yet.</p>}
          <ul className="space-y-1">
            {conversations.map((c) => {
              const selected = active?.id === c.id;
              return (
                <li key={c.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => selectConversation(c)}
                    aria-current={selected ? 'true' : undefined}
                    className={cx(
                      'w-full rounded-xl px-3 py-2 pr-9 text-left text-sm transition-colors',
                      selected ? 'bg-accent-soft text-accent-ink' : 'text-ink-muted hover:bg-canvas',
                    )}
                  >
                    <p className="line-clamp-1 font-medium">{c.title || 'Untitled'}</p>
                    <p className="text-xs text-ink-subtle">{new Date(c.updatedAt).toLocaleDateString()}</p>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(c);
                    }}
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle hover:bg-critical-soft hover:text-critical-ink focus:outline-none focus-visible:flex focus-visible:ring-2 focus-visible:ring-critical/30 lg:hidden lg:group-focus-within:flex lg:group-hover:flex"
                    aria-label={`Delete ${c.title || 'conversation'}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section
          aria-label={active?.title || 'New chat'}
          className={cx(
            'min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card lg:flex',
            listOpen ? 'hidden' : 'flex',
          )}
        >
          <div
            ref={scrollRef}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4 sm:px-5"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-busy={busy || loadingMessages}
          >
            {loadingMessages && messages.length === 0 ? (
              <Spinner label="Loading conversation…" />
            ) : showEmpty ? (
              <EmptyState role={role} name={user?.fullName} onPick={send} disabled={busy} />
            ) : (
              <div className="mx-auto w-full max-w-3xl space-y-4">
                {messages.map((m) => {
                  const mine = isUserMessage(m);
                  return (
                    <div key={m.id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
                      {mine ? (
                        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-accent-on sm:max-w-[75%]">
                          <span className="sr-only">You said: </span>
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        </div>
                      ) : (
                        <div className="min-w-0 max-w-full rounded-2xl rounded-bl-md bg-canvas px-4 py-3 ring-1 ring-inset ring-line sm:max-w-[90%]">
                          <span className="sr-only">Assistant said: </span>
                          <Markdown>{m.content}</Markdown>
                        </div>
                      )}
                    </div>
                  );
                })}
                {busy && <TypingIndicator />}
              </div>
            )}
          </div>

          <div className="border-t border-line p-3">
            {error && (
              <div
                role="alert"
                className="mb-2 flex items-start gap-2 rounded-xl bg-critical-soft px-3 py-2 text-sm text-critical-ink ring-1 ring-inset ring-critical/20"
              >
                <span className="min-w-0 flex-1 pt-0.5">{errorMessage(error)}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-critical/10"
                  aria-label="Dismiss error"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
            <form
              className="mx-auto flex max-w-3xl items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <label htmlFor="ai-composer" className="sr-only">
                Message the AI assistant
              </label>
              <textarea
                id="ai-composer"
                ref={textareaRef}
                rows={1}
                className="input !min-h-0 resize-none py-2.5 leading-relaxed"
                placeholder={
                  role === 'STUDENT'
                    ? 'Ask about a lesson, concept, or get exam tips…'
                    : 'Ask anything, or describe what you need drafted…'
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                maxLength={10000}
                aria-describedby="ai-composer-hint"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="btn btn-primary h-[var(--control-md)] w-[var(--control-md)] shrink-0 !px-0"
                aria-label="Send message"
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
            <p id="ai-composer-hint" className="mx-auto mt-1.5 hidden max-w-3xl px-1 text-xs text-ink-subtle sm:block">
              Enter to send · Shift+Enter for a new line · AI answers can be wrong — check important facts.
            </p>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={deleteConversation}
        title="Delete conversation?"
        description="This conversation and all its messages will be permanently removed."
        confirmLabel="Delete"
      />
    </div>
  );
}
