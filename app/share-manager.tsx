'use client';
import { useEffect, useRef, useState } from 'react';
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
  const [copyStatus, setCopyStatus] = useState('');
  const linkInput = useRef<HTMLInputElement>(null);
  const [base, setBase] = useState('');
  const [username, setUsername] = useState('');
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
    setCopyStatus('');
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
  async function chooseUsername() {
    if (!profile) return;
    setBusy(true);
    setError('');
    setCopyStatus('');
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: username, version: profile.version }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'Username was not saved. Try again.');
      setProfile(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const isPublic = profile?.visibility === 'public';
  const url = profile ? base + '/parked/' + profile.handle : '';
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
          {!profile.handleChosen ? (
            <div className="public-username-setting">
              <label htmlFor="public-username">
                Choose your public username
              </label>
              <input
                id="public-username"
                type="text"
                value={username}
                maxLength={30}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-describedby="public-username-help"
                onChange={(event) => setUsername(event.target.value)}
              />
              <p id="public-username-help" className="share-hint">
                This name appears in your public link. Choose once; it cannot be
                changed. Use 3–30 letters or numbers with optional hyphens or
                underscores. Your sign-in name stays private.
              </p>
              <p className="share-hint">
                {base}/parked/{username.trim().toLowerCase() || 'your-username'}
              </p>
              <button
                type="button"
                className="primary-button"
                disabled={busy || !username.trim()}
                onClick={() => void chooseUsername()}
              >
                Save permanent username
              </button>
            </div>
          ) : (
            <p className="share-hint">
              Public username: <strong>{profile.handle}</strong>. This username
              and link are permanent.
            </p>
          )}
          <label>
            Your stable garage link
            <input
              ref={linkInput}
              type="text"
              readOnly
              value={url}
              aria-describedby="copy-status"
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <div className="share-actions">
            <button
              type="button"
              className="primary-button copy-link-button"
              disabled={!base}
              onClick={async () => {
                setCopyStatus('');
                try {
                  if (!navigator.clipboard?.writeText) throw new Error();
                  await navigator.clipboard.writeText(url);
                  setCopyStatus(
                    'Link copied. If pasting does not work, select the link and copy it manually.',
                  );
                } catch {
                  linkInput.current?.focus();
                  linkInput.current?.select();
                  setCopyStatus(
                    'Automatic copying is unavailable. The link is selected: press Ctrl+C or Command+C, or touch and hold the link and choose Copy.',
                  );
                }
              }}
            >
              Copy link
            </button>
            <button
              type="button"
              className="text-button select-link-button"
              onClick={() => {
                linkInput.current?.focus();
                linkInput.current?.select();
                setCopyStatus(
                  'Link selected. Press Ctrl+C or Command+C, or touch and hold the link and choose Copy.',
                );
              }}
            >
              Select link to copy manually
            </button>
            {isPublic && (
              <a
                className="text-button"
                href={'/parked/' + profile.handle}
                target="_blank"
                rel="noreferrer"
              >
                Preview public garage ↗
              </a>
            )}
          </div>
          <output id="copy-status" aria-live="polite" className="share-hint">
            {copyStatus}
          </output>
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
