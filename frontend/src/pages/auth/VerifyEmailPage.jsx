import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CircleCheck, MailWarning } from 'lucide-react';
import { api } from '../../api/client.js';
import { Button, errorMessage, Skeleton } from '../../components/ui.jsx';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [state, setState] = useState(token ? 'verifying' : 'missing');
  const [message, setMessage] = useState('');
  const attempted = useRef(false);

  // Verification is a one-shot side effect. The previous implementation called
  // it from the render body, so React's double-invoke burned the single-use
  // token before the success state could ever be shown.
  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    api
      .post('/auth/verify-email', { token })
      .then(() => setState('verified'))
      .catch((error) => {
        setMessage(errorMessage(error));
        setState('failed');
      });
  }, [token]);

  if (state === 'verifying') {
    return (
      <div>
        <h1 className="text-display text-ink">Verifying your email</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">This takes a moment.</p>
        <div className="mt-7 space-y-2" role="status" aria-label="Verifying">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (state === 'verified') {
    return (
      <div>
        <span className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-positive-soft text-positive-ink ring-1 ring-inset ring-positive/25">
          <CircleCheck className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
        </span>
        <h1 className="text-display text-ink">Email verified</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Your address is confirmed. Result notifications and password resets will reach you.
        </p>
        <Button as={Link} to="/login" variant="primary" size="lg" className="mt-7 w-full">
          Sign in
        </Button>
      </div>
    );
  }

  return (
    <div>
      <span className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-caution-soft text-caution-ink ring-1 ring-inset ring-caution/25">
        <MailWarning className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
      </span>
      <h1 className="text-display text-ink">
        {state === 'missing' ? 'This link is incomplete' : 'Verification failed'}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        {state === 'missing'
          ? 'The verification link is missing its token. Open the link directly from the email rather than copying it.'
          : message}
      </p>
      <p className="mt-4 rounded-xl bg-surface-sunken/70 px-4 py-3 text-sm leading-relaxed text-ink-muted">
        Verification links expire. Sign in and request a new one from Settings, or ask your
        administrator to resend it.
      </p>
      <Button as={Link} to="/login" variant="primary" size="lg" className="mt-7 w-full">
        Go to sign in
      </Button>
    </div>
  );
}
