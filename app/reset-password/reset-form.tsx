'use client';
import Link from 'next/link';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
export default function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  return (
    <main className="auth-page">
      <h1>Choose a new password</h1>
      {!token ? (
        <p>
          This reset link is unavailable. Request another from the sign-in page.
        </p>
      ) : (
        <form
          className="edit-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const result = await authClient.resetPassword({
                newPassword: password,
                token,
              });
              setMessage(
                result.error
                  ? 'This reset link is invalid or expired. Request another.'
                  : 'Password updated. Sign in with your new password.',
              );
            } catch {
              setMessage('Unable to reset your password. Try again.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="primary-button" disabled={busy}>
            Reset password
          </button>
        </form>
      )}
      <output>{message}</output>
      <Link className="text-button" href="/login">
        Back to sign in
      </Link>
    </main>
  );
}
