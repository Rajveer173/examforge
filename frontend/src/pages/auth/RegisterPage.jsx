import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuthStore } from '../../store/authStore.js';
import { Button, ErrorAlert, Field, Input } from '../../components/ui.jsx';
import { PasswordInput, PasswordStrength, passwordScore } from '../../components/PasswordField.jsx';

const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(120, 'That name is too long'),
    username: z
      .string()
      .trim()
      .min(3, 'At least 3 characters')
      .max(32, 'At most 32 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
    password: z
      .string()
      .min(10, 'Use at least 10 characters')
      .refine((value) => passwordScore(value) >= 3, 'Add a number, a symbol or mixed case'),
    confirmPassword: z.string().min(1, 'Repeat the password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The two passwords do not match',
  });

export function RegisterPage() {
  const registerUser = useAuthStore((state) => state.register);
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(registerSchema), mode: 'onBlur' });

  const password = watch('password') ?? '';

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await registerUser({
        fullName: values.fullName.trim(),
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      navigate('/login', { state: { registered: true }, replace: true });
    } catch (error) {
      // A duplicate account is a field problem, not a page-level failure, so it
      // is attached to the field the user has to change.
      const message = error?.message ?? '';
      if (error?.status === 409 || /already/i.test(message)) {
        const field = /username/i.test(message) ? 'username' : 'email';
        setError(field, { message: 'That is already registered.' });
        return;
      }
      setServerError(error);
    }
  };

  return (
    <div>
      <h1 className="text-display text-ink">Create a student account</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Teacher, proctor and administrator accounts are created by your institution.
      </p>

      <form className="mt-7 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && <ErrorAlert error={serverError} />}

        <Field label="Full name" htmlFor="fullName" required error={errors.fullName?.message}>
          <Input
            id="fullName"
            autoComplete="name"
            autoFocus
            placeholder="As it should appear on certificates"
            invalid={Boolean(errors.fullName)}
            {...register('fullName')}
          />
        </Field>

        <Field
          label="Username"
          htmlFor="username"
          required
          error={errors.username?.message}
          hint="Letters, numbers and underscores. This is visible to your teachers."
        >
          <Input
            id="username"
            autoComplete="username"
            placeholder="jane_doe"
            invalid={Boolean(errors.username)}
            {...register('username')}
          />
        </Field>

        <Field
          label="Email"
          htmlFor="email"
          required
          error={errors.email?.message}
          hint="Verification and result notifications go here."
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@institution.edu"
            invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Field label="Password" htmlFor="password" required error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
          <PasswordStrength value={password} />
        </Field>

        <Field
          label="Confirm password"
          htmlFor="confirmPassword"
          required
          error={errors.confirmPassword?.message}
        >
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </Field>

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="mt-7 rounded-xl bg-surface-sunken/70 px-4 py-3 text-sm leading-relaxed text-ink-muted">
        Already registered?{' '}
        <Link to="/login" className="link">
          Sign in
        </Link>
      </p>
    </div>
  );
}
