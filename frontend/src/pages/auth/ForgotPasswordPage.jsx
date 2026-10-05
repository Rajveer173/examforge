import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { z } from 'zod';
import { api } from '../../api/client.js';
import { Button, ErrorAlert, Field, Input } from '../../components/ui.jsx';

const forgotSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
});

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState(null);
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await api.post('/auth/forgot-password', values);
      setSentTo(values.email);
    } catch (error) {
      // Rate limiting is the one failure worth naming; anything else would leak
      // whether the address is registered.
      setServerError(
        error?.status === 429
          ? 'Too many requests. Wait a few minutes before asking for another link.'
          : error,
      );
    }
  };

  if (sentTo) {
    return (
      <div>
        <span className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-positive-soft text-positive-ink ring-1 ring-inset ring-positive/25">
          <MailCheck className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
        </span>
        <h1 className="text-display text-ink">Check your inbox</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          If an account exists for <span className="font-medium text-ink">{sentTo}</span>, a reset
          link is on its way. The link is valid for one hour and can be used once.
        </p>

        <div className="mt-7 space-y-3">
          <Button as={Link} to="/login" variant="primary" size="lg" className="w-full">
            Back to sign in
          </Button>
          <button
            type="button"
            onClick={() => onSubmit(getValues())}
            className="link text-[0.8125rem]"
          >
            Send the link again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-display text-ink">Reset your password</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Enter the email on your account and we will send a one-time reset link.
      </p>

      <form className="mt-7 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && <ErrorAlert error={serverError} />}

        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@institution.edu"
            invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting}>
          Send reset link
        </Button>
      </form>

      <Link to="/login" className="link mt-7 inline-flex items-center gap-1.5 text-[0.8125rem]">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to sign in
      </Link>
    </div>
  );
}
