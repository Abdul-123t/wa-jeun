import React, { FormEvent, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { validateAuthInput } from '../auth/authRules';

type AuthMode = 'signin' | 'signup' | 'reset' | 'recovery';

export const AuthPage: React.FC = () => {
  const { client, user, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedMode = searchParams.get('mode');
  const mode = useMemo<AuthMode>(() => {
    if (requestedMode === 'signup' || requestedMode === 'reset' || requestedMode === 'recovery') return requestedMode;
    return 'signin';
  }, [requestedMode]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);

  const returnTo = (location.state as { from?: string } | null)?.from || '/account';

  if (!authLoading && user && mode !== 'recovery') return <Navigate to="/account" replace />;

  const changeMode = (next: AuthMode) => {
    setErrors({});
    setError('');
    setMessage('');
    setPasswordUpdated(false);
    setSearchParams(next === 'signin' ? {} : { mode: next });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!client) {
      setError('Account access is not configured yet. Please contact the wá jẹun team.');
      return;
    }

    if (mode === 'reset') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setErrors({ email: 'Enter a valid email address.' });
        return;
      }
      setErrors({});
      setSubmitting(true);
      try {
        const { error: resetError } = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth?mode=recovery`
        });
        if (resetError) setError('We could not send a reset link. Check the email address and try again.');
        else setMessage('If an account exists for that email, a password reset link is on its way.');
      } catch {
        setError('We could not send a reset link. Check your connection and try again.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === 'recovery') {
      const nextErrors = validateAuthInput(email || 'reset@example.com', password, confirmPassword);
      delete nextErrors.email;
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length) return;

      setSubmitting(true);
      try {
        const { error: updateError } = await client.auth.updateUser({ password });
        if (updateError) setError('We could not update your password. Request a new reset link and try again.');
        else {
          setMessage('Your password has been updated. You can continue to your account.');
          setPassword('');
          setConfirmPassword('');
          setPasswordUpdated(true);
        }
      } catch {
        setError('We could not update your password. Check your connection and try again.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const nextErrors = validateAuthInput(email, password, mode === 'signup' ? confirmPassword : undefined);
    if (mode === 'signup' && fullName.trim().length < 2) nextErrors.fullName = 'Enter your name.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/account`,
            data: { full_name: fullName.trim() }
          }
        });
        if (signUpError) setError('We could not create your account. Check your details and try again.');
        else if (!data.session) setMessage('Account created. Check your email to confirm your address, then sign in.');
        else setMessage('Your account is ready. Taking you to your account…');
        return;
      }

      const { error: signInError } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) setError('Email or password is incorrect. Please try again.');
      else navigate(returnTo, { replace: true });
    } catch {
      setError(mode === 'signup' ? 'We could not create your account. Check your connection and try again.' : 'Unable to sign in. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === 'signup' ? 'Create your account'
    : mode === 'reset' ? 'Reset your password'
      : mode === 'recovery' ? 'Choose a new password'
        : 'Welcome back';

  return (
    <main className="min-h-[70vh] bg-[#FFF8E9] px-4 py-12 sm:px-6 sm:py-16">
      <section className="mx-auto max-w-md rounded-2xl border border-[#123B2A]/10 bg-white p-6 shadow-sm sm:p-9" aria-labelledby="auth-heading">
        <Link to="/" className="inline-flex items-center gap-1 text-xs font-semibold text-[#123B2A]/65 hover:text-[#123B2A]">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to wá jẹun
        </Link>
        <img src="/brand/wa-jeun-logo.webp" alt="wá jẹun official logo" className="mx-auto mt-5 h-24 w-auto object-contain" />
        <div className="mt-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#B8D94B]/25 text-[#123B2A]">
            {mode === 'reset' ? <Mail className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
          </div>
          <h1 id="auth-heading" className="mt-4 font-display text-2xl font-bold text-[#123B2A]">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-[#20231F]/70">
            {mode === 'signup' ? 'Create a wá jẹun account to keep your account details together.'
              : mode === 'reset' ? 'Enter your account email and we’ll send a reset link if it matches an account.'
                : mode === 'recovery' ? 'Use a new password with at least 8 characters.'
                  : 'Sign in to manage your wá jẹun account.'}
          </p>
        </div>

        {!client && <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Account sign-in is not configured. The public website and interest forms remain available.</p>}
        {error && <div role="alert" className="mt-5 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        {message && <p role="status" className="mt-5 rounded-xl border border-[#123B2A]/15 bg-[#123B2A]/5 p-3 text-sm leading-5 text-[#123B2A]">{message}</p>}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
            {mode === 'signup' && <Field label="Full name" error={errors.fullName}>
              <input autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} />
            </Field>}
            {mode !== 'recovery' && <Field label="Email address" error={errors.email}>
              <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
            </Field>}
            {mode !== 'reset' && <Field label={mode === 'recovery' ? 'New password' : 'Password'} error={errors.password}>
              <input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
            </Field>}
            {(mode === 'signup' || mode === 'recovery') && <Field label="Confirm password" error={errors.confirmPassword}>
              <input type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClass} />
            </Field>}
            <button type="submit" disabled={submitting || !client} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#B8D94B] px-5 py-3 font-bold text-[#123B2A] transition-colors hover:bg-[#a7c93e] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B2A] focus-visible:ring-offset-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : mode === 'recovery' ? 'Update password' : 'Sign in'}
            </button>
        </form>

        {mode === 'recovery' && passwordUpdated && <Link to="/account" className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-[#123B2A] px-4 text-sm font-semibold text-white hover:bg-[#174c36]">Continue to your account</Link>}

        <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
          {mode === 'signin' && <>
            <button type="button" onClick={() => changeMode('signup')} className="font-semibold text-[#123B2A] underline underline-offset-2">Create account</button>
            <button type="button" onClick={() => changeMode('reset')} className="text-[#123B2A]/70 underline underline-offset-2">Forgot password?</button>
          </>}
          {mode === 'signup' && <button type="button" onClick={() => changeMode('signin')} className="font-semibold text-[#123B2A] underline underline-offset-2">Already have an account? Sign in</button>}
          {(mode === 'reset' || mode === 'recovery') && <button type="button" onClick={() => changeMode('signin')} className="font-semibold text-[#123B2A] underline underline-offset-2">Return to sign in</button>}
        </div>
        <p className="mt-6 border-t border-[#123B2A]/10 pt-4 text-center text-xs leading-5 text-[#20231F]/60">
          Vendor application forms remain available without an account. Sign in before submitting to link an application to your account.
        </p>
      </section>
    </main>
  );
};

const inputClass = 'mt-1.5 min-h-11 w-full rounded-lg border border-[#123B2A]/20 bg-white px-3 py-2 text-sm text-[#20231F] outline-none focus:border-[#123B2A] focus:ring-2 focus:ring-[#B8D94B]/60';

const Field: React.FC<React.PropsWithChildren<{ label: string; error?: string }>> = ({ label, error, children }) => (
  <label className="block text-sm font-semibold text-[#123B2A]">{label}{children}{error && <span className="mt-1 block text-xs font-normal text-red-700">{error}</span>}</label>
);
