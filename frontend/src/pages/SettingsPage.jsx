import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun, Rows3, Trash2, RefreshCw } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { Badge, Button, ConfirmDialog, ErrorAlert, PageHeader, Spinner } from '../components/ui.jsx';
import { useToast } from '../components/toast.jsx';
import { useDensity, useTheme } from '../lib/theme.js';
import { formatDateTime } from '../lib/format.js';

export function SettingsPage() {
  const { user, fetchMe } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const { density, setDensity } = useDensity();
  const toast = useToast();
  const [sessions, setSessions] = useState(null);
  const [sessionsError, setSessionsError] = useState(null);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(null);
  const [revoking, setRevoking] = useState(false);
  const [resending, setResending] = useState(false);

  const loadSessions = async () => {
    try {
      const { data } = await api.get('/auth/sessions');
      setSessions(data.data);
    } catch (err) {
      setSessionsError(err);
    }
  };

  useEffect(() => { loadSessions(); }, []);

  const revokeSession = async (id) => {
    setRevoking(true);
    try {
      await api.delete(`/auth/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success('Session revoked');
    } catch (err) {
      toast.error('Failed to revoke session');
    } finally {
      setRevoking(false);
      setConfirmRevoke(null);
    }
  };

  const revokeAllSessions = async () => {
    setRevoking(true);
    try {
      await api.delete('/auth/sessions');
      setSessions((prev) => prev.filter((s) => s.current));
      toast.success('All other sessions revoked');
    } catch (err) {
      toast.error('Failed to revoke sessions');
    } finally {
      setRevoking(false);
      setConfirmRevokeAll(false);
    }
  };

  const resendVerification = async () => {
    setResending(true);
    try {
      await api.post('/auth/resend-verification');
      toast.success('Verification email sent');
    } catch (err) {
      toast.error(err?.response?.data?.message ?? 'Failed to send verification email');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Customize your experience and manage active sessions." />

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-muted">Appearance</h2>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Theme</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
              ].map((opt) => {
                const Icon = opt.icon;
                const selected = theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                      selected
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line bg-surface hover:border-line-strong text-ink-muted hover:text-ink'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Density</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'comfortable', label: 'Comfortable', icon: Monitor },
                { value: 'compact', label: 'Compact', icon: Rows3 },
              ].map((opt) => {
                const Icon = opt.icon;
                const selected = density === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setDensity(opt.value)}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                      selected
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line bg-surface hover:border-line-strong text-ink-muted hover:text-ink'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {!user?.emailVerified && (
        <section className="card p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">Email Verification</h2>
          <p className="mb-3 text-sm text-ink-muted">Your email address has not been verified yet.</p>
          <Button onClick={resendVerification} loading={resending} icon={RefreshCw}>
            Resend verification email
          </Button>
        </section>
      )}

      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Active Sessions</h2>
          {sessions && sessions.length > 1 && (
            <Button variant="danger" size="sm" icon={Trash2} onClick={() => setConfirmRevokeAll(true)}>
              Revoke all others
            </Button>
          )}
        </div>

        {sessionsError && <ErrorAlert error={sessionsError} className="mb-4" />}
        {!sessions && !sessionsError && <Spinner label="Loading sessions…" />}
        {sessions && sessions.length === 0 && (
          <p className="text-sm text-ink-subtle">No active sessions found.</p>
        )}
        {sessions && sessions.length > 0 && (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg bg-canvas px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {s.userAgent || 'Unknown device'}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
                    <span>{s.ipAddress || 'Unknown IP'}</span>
                    {s.createdAt && <span>{formatDateTime(s.createdAt)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.current && <Badge tone="positive">Current</Badge>}
                  {!s.current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmRevoke(s)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(confirmRevoke)}
        onClose={() => setConfirmRevoke(null)}
        onConfirm={() => revokeSession(confirmRevoke.id)}
        loading={revoking}
        title="Revoke session?"
        description="This session will be immediately signed out."
        confirmLabel="Revoke"
      />

      <ConfirmDialog
        open={confirmRevokeAll}
        onClose={() => setConfirmRevokeAll(false)}
        onConfirm={revokeAllSessions}
        loading={revoking}
        title="Revoke all other sessions?"
        description="All other devices will be signed out immediately."
        confirmLabel="Revoke all"
      />
    </div>
  );
}
