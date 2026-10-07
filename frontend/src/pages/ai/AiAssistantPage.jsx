import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../../api/client.js';
import { ConfirmDialog, ErrorAlert, Spinner } from '../../components/ui.jsx';

export function AiAssistantPage() {
  const [conversations, setConversations] = useState(null);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const bottomRef = useRef(null);

  const loadConversations = () =>
    api.get('/ai/conversations')
      .then((r) => setConversations(r.data.data.conversations))
      .catch(setError);

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    if (active) {
      api.get(`/ai/conversations/${active.id}`)
        .then((r) => setMessages(r.data.data.conversation.messages || []))
        .catch(setError);
    }
  }, [active?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const newConversation = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/ai/conversations', { title: 'New chat' });
      await loadConversations();
      setActive(data.data.conversation);
      setMessages([]);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const content = input.trim();
    if (!content || busy) return;
    setBusy(true);
    setInput('');
    // Show the question straight away; the model can take several seconds to reply.
    setMessages((prev) => [...prev, { id: `pending-${Date.now()}`, role: 'user', content }]);
    try {
      await api.post(`/ai/conversations/${active.id}/messages`, { content });
      const { data } = await api.get(`/ai/conversations/${active.id}`);
      setMessages(data.data.conversation.messages || []);
      loadConversations();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => !String(m.id).startsWith('pending-')));
      setInput(content);
      setError(err);
    } finally {
      setBusy(false);
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

  if (error) return <ErrorAlert error={error} />;
  if (!conversations) return <Spinner label="Loading AI assistant…" />;

  return (
    <div className="h-[calc(100vh-8rem)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">AI Study Assistant</h1>
          <p className="mt-1 text-sm text-ink-muted">Ask questions, clarify concepts, and get study help.</p>
        </div>
        <button onClick={newConversation} disabled={busy} className="btn btn-primary">New Chat</button>
      </div>

      <div className="grid h-[calc(100%-4rem)] grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        <div className="hidden space-y-1 overflow-y-auto rounded-xl border border-line bg-surface p-2 lg:block">
          {conversations.length === 0 && <p className="p-2 text-sm text-ink-subtle">No conversations yet.</p>}
          {conversations.map((c) => (
            <div key={c.id} className="group relative">
              <button
                onClick={() => setActive(c)}
                className={`w-full rounded-lg px-3 py-2 pr-8 text-left text-sm ${
                  active?.id === c.id ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-canvas'
                }`}
              >
                <p className="line-clamp-1 font-medium">{c.title || 'Untitled'}</p>
                <p className="text-xs text-ink-subtle">{new Date(c.updatedAt).toLocaleDateString()}</p>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(c); }}
                className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded text-ink-subtle hover:bg-critical-soft hover:text-critical-ink group-hover:flex"
                aria-label={`Delete ${c.title || 'conversation'}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-col rounded-xl border border-line bg-surface">
          {!active ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="p-8 text-center text-ink-subtle">
                Start a new conversation to ask the AI study assistant a question.
              </p>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {messages.map((m) => {
                  const isUser = m.role === 'student' || m.role === 'user';
                  return (
                    <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-xl px-4 py-2 text-sm ${
                          isUser ? 'bg-accent text-white' : 'bg-canvas text-ink'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                    </div>
                  );
                })}
                {busy && <div className="text-sm text-ink-subtle">Thinking…</div>}
                <div ref={bottomRef} />
              </div>
              <div className="border-t border-line p-3">
                <div className="flex gap-2">
                  <input
                    className="input"
                    placeholder="Ask about a lesson, concept, or get exam tips…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && send()}
                  />
                  <button onClick={send} disabled={busy || !input.trim()} className="btn btn-primary shrink-0">
                    Send
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
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
