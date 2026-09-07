import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { Badge, Button, ConfirmDialog, ErrorAlert, Field, PageHeader, Spinner } from '../components/ui.jsx';
import { useToast } from '../components/toast.jsx';
import { formatDateTime } from '../lib/format.js';

export function ProfilePage() {
  const { user, fetchMe } = useAuthStore();
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();

  // 2FA state
  const [twoFactorState, setTwoFactorState] = useState({
    loading: false,
    setup: null,
    verifyPassword: '',
    verifyCode: '',
    disablePassword: '',
    disableCode: '',
  });
  const [loginHistory, setLoginHistory] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [confirmRevoke, setConfirmRevoke] = useState(null);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [revoking, setRevoking] = useState(false);

  if (!user) return <Spinner />;

  const changePassword = async () => {
    setError(null);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError(new Error('Passwords do not match'));
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setError(new Error('New password must be at least 8 characters'));
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed successfully');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const startTwoFactor = async () => {
    setError(null);
    if (!twoFactorState.verifyPassword) { setError(new Error('Enter your password')); return; }
    setTwoFactorState((s) => ({ ...s, loading: true }));
    try {
      const { data } = await api.post('/auth/enable-2fa', { password: twoFactorState.verifyPassword });
      setTwoFactorState((s) => ({ ...s, setup: data.data, loading: false }));
    } catch (err) {
      setError(err);
      setTwoFactorState((s) => ({ ...s, loading: false }));
    }
  };

  const verifyTwoFactor = async () => {
    setError(null);
    setTwoFactorState((s) => ({ ...s, loading: true }));
    try {
      await api.post('/auth/verify-2fa-setup', { code: twoFactorState.verifyCode });
      await fetchMe();
      setTwoFactorState((s) => ({ ...s, loading: false, verifyCode: '', setup: null }));
      toast.success('Two-factor authentication enabled');
    } catch (err) {
      setError(err);
      setTwoFactorState((s) => ({ ...s, loading: false }));
    }
  };

  const disableTwoFactor = async () => {
    setError(null);
    setTwoFactorState((s) => ({ ...s, loading: true }));
    try {
      await api.post('/auth/disable-2fa', {
        password: twoFactorState.disablePassword,
        code: twoFactorState.disableCode,
      });
      await fetchMe();
      setTwoFactorState((s) => ({ ...s, loading: false, disablePassword: '', disableCode: '' }));
      toast.success('Two-factor authentication disabled');
    } catch (err) {
      setError(err);
      setTwoFactorState((s) => ({ ...s, loading: false }));
    }
  };

  const loadLoginHistory = async () => {
    try {
      const { data } = await api.get('/auth/login-history');
      setLoginHistory(data.data.history);
    } catch (err) {
      setError(err);
    }
  };

  const loadSessions = async () => {
    try {
      const { data } = await api.get('/auth/sessions');
      setSessions(data.data);
    } catch (err) {
      setError(err);
    }
  };

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

  return (
    <div className="max-w-2xl">
      <PageHeader title="Profile" description="Manage your account settings." />

      <div className="card mb-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-muted">Account info</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-ink-subtle">Full name</dt>
            <dd className="font-medium text-ink">{user.fullName || '—'}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Username</dt>
            <dd className="font-medium text-ink">{user.username}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Email</dt>
            <dd className="font-medium text-ink">{user.email}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Role</dt>
            <dd className="font-medium text-ink">{user.role}</dd>
          </div>
        </dl>
      </div>

      <div className="card mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Two-factor authentication</h2>
          <Badge tone={user.twoFactorEnabled ? 'positive' : 'neutral'}>
            {user.twoFactorEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>

        {!user.twoFactorEnabled && !twoFactorState.setup && (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">
              Add an extra layer of security to your account using an authenticator app.
            </p>
            <Field label="Your password">
              <input
                type="password"
                className="input"
                value={twoFactorState.verifyPassword}
                onChange={(e) => setTwoFactorState((s) => ({ ...s, verifyPassword: e.target.value }))}
              />
            </Field>
            <button onClick={startTwoFactor} disabled={twoFactorState.loading} className="btn btn-primary">
              {twoFactorState.loading ? 'Setting up…' : 'Set up 2FA'}
            </button>
          </div>
        )}

        {!user.twoFactorEnabled && twoFactorState.setup && (
          <div className="space-y-3">
            <textarea
              readOnly
              className="input h-16 font-mono text-xs"
              value={twoFactorState.setup.otpauthUrl}
              placeholder="Scan this otpauth URL with your authenticator app"
            />
            <p className="text-xs text-ink-muted">Or enter this secret manually: <code>{twoFactorState.setup.secret}</code></p>
            <Field label="Verification code">
              <input
                className="input"
                maxLength={6}
                placeholder="6-digit code"
                value={twoFactorState.verifyCode}
                onChange={(e) => setTwoFactorState((s) => ({ ...s, verifyCode: e.target.value }))}
              />
            </Field>
            <button onClick={verifyTwoFactor} disabled={twoFactorState.loading || twoFactorState.verifyCode.length !== 6} className="btn btn-primary">
              {twoFactorState.loading ? 'Verifying…' : 'Verify & enable'}
            </button>
          </div>
        )}

        {user.twoFactorEnabled && (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">Two-factor authentication is active on your account.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Password">
                <input type="password" className="input" value={twoFactorState.disablePassword} onChange={(e) => setTwoFactorState((s) => ({ ...s, disablePassword: e.target.value }))} />
              </Field>
              <Field label="Authenticator code">
                <input className="input" maxLength={6} placeholder="6-digit code" value={twoFactorState.disableCode} onChange={(e) => setTwoFactorState((s) => ({ ...s, disableCode: e.target.value }))} />
              </Field>
            </div>
            <button onClick={disableTwoFactor} disabled={twoFactorState.loading} className="btn btn-danger">
              {twoFactorState.loading ? 'Disabling…' : 'Disable 2FA'}
            </button>
          </div>
        )}
      </div>

      <div className="card mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Login history</h2>
          <Button variant="ghost" size="sm" onClick={loadLoginHistory}>View history</Button>
        </div>
        {loginHistory === null ? (
          <p className="text-sm text-ink-muted">Click "View history" to see your recent sign-ins.</p>
        ) : loginHistory.length === 0 ? (
          <p className="text-sm text-ink-subtle">No login history available.</p>
        ) : (
          <div className="space-y-2">
            {loginHistory.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-ink">{h.ipAddress} · {h.userAgent || 'Unknown device'}</p>
                  <p className="text-xs text-ink-muted">{new Date(h.createdAt).toLocaleString()}</p>
                </div>
                <Badge tone={h.success ? 'positive' : 'critical'}>{h.success ? 'Success' : 'Failed'}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Active Sessions</h2>
          {sessions && sessions.length > 1 && (
            <Button variant="danger" size="sm" onClick={() => setConfirmRevokeAll(true)}>
              Revoke all others
            </Button>
          )}
        </div>
        {!sessions && (
          <Button variant="ghost" size="sm" onClick={loadSessions}>View sessions</Button>
        )}
        {sessions && sessions.length === 0 && (
          <p className="text-sm text-ink-subtle">No active sessions found.</p>
        )}
        {sessions && sessions.length > 0 && (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{s.userAgent || 'Unknown device'}</p>
                  <p className="text-xs text-ink-muted">{s.ipAddress || 'Unknown IP'} · {s.createdAt ? formatDateTime(s.createdAt) : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  {s.current && <Badge tone="positive">Current</Badge>}
                  {!s.current && (
                    <Button variant="ghost" size="sm" onClick={() => setConfirmRevoke(s)}>
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-muted">Change password</h2>
        {error && <ErrorAlert error={error} />}
        <div className="space-y-4">
          <Field label="Current password">
            <input
              type="password"
              className="input"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
            />
          </Field>
          <Field label="New password">
            <input
              type="password"
              className="input"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              placeholder="At least 8 characters"
            />
          </Field>
          <Field label="Confirm new password">
            <input
              type="password"
              className="input"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            />
          </Field>
          <div className="flex justify-end">
            <button
              onClick={changePassword}
              disabled={busy || !passwordForm.currentPassword || !passwordForm.newPassword}
              className="btn-primary"
            >
              {busy ? 'Changing…' : 'Change password'}
            </button>
          </div>
        </div>
      </div>

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
        description="All other devices will be signed out."
        confirmLabel="Revoke all"
      />
    </div>
  );
}
