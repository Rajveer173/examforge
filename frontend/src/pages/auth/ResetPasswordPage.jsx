import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { z } from 'zod';
import { api } from '../../api/client.js';
import { Button, ErrorAlert, Field } from '../../components/ui.jsx';
import { PasswordInput, PasswordStrength, passwordScore } from '../../components/PasswordField.jsx';

const resetSchema = z
  .object({
    newPassword: z
      .string()
      .min(10, 'Use at least 10 characters')
      .refine((value) => passwordScore(value) >= 3, 'Add a number, a symbol or mixed case'),
    confirm: z.string().min(1, 'Repeat the password'),
  })
  .refine((data) => data.newPassword === data.confirm, {
    path: ['confirm'],
    message: 'The two passwords do not match',
  });

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [serverError, setServerError] = useState(null);
  const [done, setDone] = useState(false);

  const token = params.get('token') || '';

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(resetSchema), mode: 'onBlur' });

  const password = watch('newPassword') ?? '';

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await api.post('/auth/reset-password', { token, newPassword: values.newPassword });
      setDone(true);
    } catch (error) {
      setServerError(
        error?.status === 400 || error?.status === 410
          ? 'This link has expired or has already been used. Request a new one.'
          : error,
      );
    }
  };

  if (!token) {
    return (
      <div>
        <span className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-caution-soft text-caution-ink ring-1 ring-inset ring-caution/25">
          <TriangleAlert className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
        </span>
        <h1 className="text-display text-ink">This link is incomplete</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          The reset link is missing its token. Mail clients sometimes truncate long links; request a
          fresh one and open it directly from the message.
        </p>
        <Button as={Link} to="/forgot-password" variant="primary" size="lg" className="mt-7 w-full">
          Request a new link
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <span className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-positive-soft text-positive-ink ring-1 ring-inset ring-positive/25">
          <CircleCheck className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
        </span>
        <h1 className="text-display text-ink">Password updated</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Every other session has been signed out. Use the new password from here on.
        </p>
        <Button as={Link} to="/login" variant="primary" size="lg" className="mt-7 w-full">
          Sign in
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-display text-ink">Choose a new password</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Signing in with the new password ends every other active session.
      </p>

      <form className="mt-7 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && <ErrorAlert error={serverError} />}

        <Field label="New password" htmlFor="newPassword" required error={errors.newPassword?.message}>
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            autoFocus
            aria-invalid={Boolean(errors.newPassword)}
            {...register('newPassword')}
          />
          <PasswordStrength value={password} />
        </Field>

        <Field label="Confirm new password" htmlFor="confirm" required error={errors.confirm?.message}>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirm)}
            {...register('confirm')}
          />
        </Field>

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting}>
          Set new password
        </Button>
      </form>

      <Link to="/login" className="link mt-7 inline-block text-[0.8125rem]">
        Back to sign in
      </Link>
    </div>
  );
}
