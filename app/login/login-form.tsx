'use client';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
export default function LoginForm({
  mailAvailable,
}: {
  mailAvailable: boolean;
}) {
  const [mode, setMode] = useState<'login' | 'signup' | 'recovery'>('login'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [name, setName] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  return (
    <main className="auth-page">
      <span className="eyebrow moss">THE ISLE GARAGE</span>
      <h1>
        {mode === 'login'
          ? 'Welcome back'
          : mode === 'signup'
            ? 'Create your garage'
            : 'Reset your password'}
      </h1>
      <p>
        Your game accounts and dinosaur records stay private until you choose to
        share them.
      </p>
      {!mailAvailable && (
        <output>
          Email delivery is not configured. Registration and password recovery
          are unavailable.
        </output>
      )}
      <form
        className="edit-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage('');
          try {
            if (mode === 'recovery') {
              await authClient.requestPasswordReset({
                email,
                redirectTo: window.location.origin + '/reset-password',
              });
              setMessage(
                'If this address has an account, a reset email will arrive shortly.',
              );
            } else if (mode === 'signup') {
              const result = await authClient.signUp.email({
                email,
                password,
                name,
                callbackURL: window.location.origin + '/login',
              });
              setMessage(
                result.error
                  ? 'Unable to complete registration. Please try again later.'
                  : 'Check your email to verify your account, then sign in.',
              );
            } else {
              const result = await authClient.signIn.email({ email, password });
              if (result.error)
                setMessage(
                  'Unable to sign in. Check your details and verify your email first.',
                );
              else window.location.assign('/');
            }
          } catch {
            setMessage('The request could not be completed. Please try again.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {mode === 'signup' && (
          <label>
            Display name
            <input
              required
              maxLength={80}
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        <label>
          Email
          <input
            required
            type="email"
            maxLength={254}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {mode !== 'recovery' && (
          <label>
            Password
            <input
              required
              type="password"
              minLength={mode === 'signup' ? 12 : 1}
              maxLength={128}
              autoComplete={
                mode === 'signup' ? 'new-password' : 'current-password'
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === 'signup' && <small>At least 12 characters.</small>}
          </label>
        )}
        <button
          className="primary-button"
          disabled={busy || (mode !== 'login' && !mailAvailable)}
        >
          {busy
            ? 'Please wait…'
            : mode === 'login'
              ? 'Sign in'
              : mode === 'signup'
                ? 'Create account'
                : 'Send reset email'}
        </button>
      </form>
      <output>{message}</output>
      <div className="auth-actions">
        {(['login', 'signup', 'recovery'] as const)
          .filter((v) => v !== mode)
          .map((v) => (
            <button
              className="text-button"
              key={v}
              onClick={() => {
                setMode(v);
                setMessage('');
                setPassword('');
              }}
            >
              {v === 'login'
                ? 'Sign in'
                : v === 'signup'
                  ? 'Create account'
                  : 'Forgot password?'}
            </button>
          ))}
      </div>
    </main>
  );
}
