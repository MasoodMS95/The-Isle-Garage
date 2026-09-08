'use client';
import { useEffect, useState } from 'react';
import type { GarageProfile } from '@/lib/garage-types';
export default function ShareManager({
  saved,
  onSave,
}: {
  saved: boolean;
  onSave: () => void;
}) {
  const [profile, setProfile] = useState<GarageProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [base, setBase] = useState('');
  async function refresh() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/profile', { cache: 'no-store' });
      if (!response.ok)
        throw new Error('Could not load visibility. Try again.');
      setProfile(await response.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    queueMicrotask(() => {
      setBase(window.location.origin);
      void refresh();
    });
  }, []);
  async function toggle() {
    if (!profile) return;
    setBusy(true);
    setError('');
    setCopied(false);
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visibility: profile.visibility === 'public' ? 'private' : 'public',
          version: profile.version,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Visibility was not saved. Try again.');
      setProfile(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const isPublic = profile?.visibility === 'public';
  const url = profile ? base + '/s/' + profile.id : '';
  return (
    <div className="share-settings">
      <p id="visibility-details" className="share-hint">
        Public shares your entire garage: every game-account label, server
        record, dinosaur status, growth, Prime status and skin code. Future
        records and saved edits appear automatically. Your sign-in email and
        password are never included.
      </p>
      {profile?.legacyLinksRevoked && (
        <p className="migration-notice">
          Your previous selected-record links have been retired. They no longer
          open. This new garage link starts private; choose Public only if you
          want to share the entire garage.
        </p>
      )}
      {profile && (
        <>
          <div className="visibility-setting">
            <div>
              <strong>{isPublic ? 'Public' : 'Private'}</strong>
              <p>
                {isPublic
                  ? 'Anyone with your link can view your whole garage.'
                  : 'Your garage link is unavailable to other people.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              aria-label="Public garage"
              aria-describedby="visibility-details"
              className="primary-button"
              disabled={busy || (!saved && !isPublic)}
              onClick={() => void toggle()}
            >
              {busy ? 'Saving…' : isPublic ? 'Make private' : 'Make public'}
            </button>
          </div>
          {!saved && (
            <p className="share-hint">
              Save your latest garage edits before publishing.
              <button className="text-button" onClick={onSave}>
                Save garage
              </button>
            </p>
          )}
          <label>
            Your stable garage link
            <input readOnly value={url} />
          </label>
          <div className="share-actions">
            <button
              className="text-button"
              disabled={!base}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                } catch {
                  setError('Select the link and copy it.');
                }
              }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
            {isPublic && (
              <a
                className="text-button"
                href={'/s/' + profile.id}
                target="_blank"
                rel="noreferrer"
              >
                Preview public garage ↗
              </a>
            )}
          </div>
          {!isPublic && (
            <p className="share-hint">
              Preview private records in My Servers. The public link stays
              unavailable, even when you are signed in. Your link will stay the
              same when you change visibility.
            </p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="share-errors">
          {error}
        </p>
      )}
      {(!profile || error) && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void refresh()}
        >
          {busy ? 'Loading…' : 'Reload visibility settings'}
        </button>
      )}
      <p className="share-hint">
        Making the garage private blocks future page, API and image access.
        Discord and other services may retain previews they already cached;
        those copies cannot be recalled.
      </p>
    </div>
  );
}
