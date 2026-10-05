import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CircleCheck, ShieldCheck } from 'lucide-react';
import { z } from 'zod';
import { roleHome } from '../../routes/paths.js';
import { useAuthStore } from '../../store/authStore.js';
import { Button, ErrorAlert, Field, Input } from '../../components/ui.jsx';
import { PasswordInput } from '../../components/PasswordField.jsx';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const codeSchema = z.object({
  code: z
    .string()
    .min(6, 'Enter all six digits')
    .max(6, 'The code is six digits')
    .regex(/^\d{6}$/, 'The code is six digits'),
});

export function LoginPage() {
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const location = useLocation();

  const [serverError, setServerError] = useState(null);
  const [stage, setStage] = useState('credentials');
  const credentialsRef = useRef(null);

  const justRegistered = location.state?.registered === true;
  const sessionExpired = location.state?.expired === true;

  const credentialsForm = useForm({ resolver: zodResolver(loginSchema) });
  const codeForm = useForm({ resolver: zodResolver(codeSchema), defaultValues: { code: '' } });

  // Someone who is already signed in has no business on this screen.
  useEffect(() => {
    const role = useAuthStore.getState().user?.role;
    if (role) navigate(roleHome[role] ?? '/', { replace: true });
  }, [navigate]);

  const finish = (user) => {
    const destination = location.state?.from ?? roleHome[user.role] ?? '/';
    navigate(destination, { replace: true });
  };

  const submitCredentials = async (values) => {
    setServerError(null);
    credentialsRef.current = values;
    try {
      finish(await login(values.email, values.password));
    } catch (error) {
      if (error.status === 428) {
        setStage('twoFactor');
        return;
      }
      if (error.status === 429) {
        setServerError('Too many sign-in attempts. Wait a few minutes before trying again.');
        return;
      }
      setServerError(error.status === 401 ? 'Email or password is incorrect.' : error);
    }
  };

  const submitCode = async ({ code }) => {
    setServerError(null);
    const credentials = credentialsRef.current;
    if (!credentials) {
      setStage('credentials');
      return;
    }
    try {
      finish(await login(credentials.email, credentials.password, code));
    } catch (error) {
      if (error.status === 401 || error.status === 428) {
        codeForm.setError('code', { message: 'That code was not accepted. Try the current one.' });
        return;
      }
      setServerError(error);
    }
  };

  if (stage === 'twoFactor') {
    return (
      <div>
        {/* The icon chip is the one visual cue that this is a second, distinct
            stage rather than a re-render of the sign-in form. */}
        <span className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent ring-1 ring-inset ring-accent/15">
          <ShieldCheck className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
        </span>
        <h1 className="text-display text-ink">Two-factor verification</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Enter the six-digit code from your authenticator app for{' '}
          <span className="font-medium text-ink">{credentialsRef.current?.email}</span>.
        </p>

        <form className="mt-7 space-y-4" onSubmit={codeForm.handleSubmit(submitCode)} noValidate>
          {serverError && <ErrorAlert error={serverError} />}

          <Field
            label="Authentication code"
            htmlFor="code"
            error={codeForm.formState.errors.code?.message}
            hint="Codes rotate every 30 seconds."
          >
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              className="text-center text-lg font-semibold tracking-[0.5em]"
              placeholder="000000"
              invalid={Boolean(codeForm.formState.errors.code)}
              {...codeForm.register('code')}
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={codeForm.formState.isSubmitting}
          >
            Verify and sign in
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setStage('credentials');
            setServerError(null);
            codeForm.reset();
          }}
          className="link mt-6 inline-flex items-center gap-1.5 text-[0.8125rem]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Use a different account
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-display text-ink">Sign in</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Use the account issued by your institution.
      </p>

      {justRegistered && (
        <p className="mt-6 flex items-start gap-2.5 rounded-xl bg-positive-soft px-4 py-3 text-sm leading-relaxed text-positive-ink ring-1 ring-inset ring-positive/25">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Account created. Check your inbox for the verification link, then sign in.
        </p>
      )}
      {sessionExpired && (
        <p className="mt-6 rounded-xl bg-caution-soft px-4 py-3 text-sm leading-relaxed text-caution-ink ring-1 ring-inset ring-caution/25">
          Your session expired. Sign in again to continue where you left off.
        </p>
      )}

      <form
        className="mt-7 space-y-4"
        onSubmit={credentialsForm.handleSubmit(submitCredentials)}
        noValidate
      >
        {serverError && <ErrorAlert error={serverError} />}

        <Field label="Email" htmlFor="email" error={credentialsForm.formState.errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@institution.edu"
            invalid={Boolean(credentialsForm.formState.errors.email)}
            {...credentialsForm.register('email')}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={credentialsForm.formState.errors.password?.message}
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="Your password"
            aria-invalid={Boolean(credentialsForm.formState.errors.password)}
            {...credentialsForm.register('password')}
          />
        </Field>

        <div className="flex justify-end">
          <Link to="/forgot-password" className="link text-[0.8125rem]">
            Forgot your password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={credentialsForm.formState.isSubmitting}
        >
          Sign in
        </Button>
      </form>

      {/* Sits in its own sunken tray so the secondary route out of this screen
          is separated from the form without a divider rule. */}
      <p className="mt-7 rounded-xl bg-surface-sunken/70 px-4 py-3 text-sm leading-relaxed text-ink-muted">
        Studying here and have no account yet?{' '}
        <Link to="/register" className="link">
          Register as a student
        </Link>
      </p>
    </div>
  );
}
