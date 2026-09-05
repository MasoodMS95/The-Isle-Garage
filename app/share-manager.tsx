'use client';
import { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import type { Server, Share } from '@/lib/garage-types';
export default function ShareManager({
  servers,
  saved,
  onSave,
}: {
  servers: Server[];
  saved: boolean;
  onSave: () => void;
}) {
  const [shares, setShares] = useState<Share[]>([]);
  const [title, setTitle] = useState('My Evrima garage');
  const [selected, setSelected] = useState(
    servers.filter((s) => s.favorite).map((s) => s.id),
  );
  const [codes, setCodes] = useState(false);
  const [photos, setPhotos] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [base, setBase] = useState('');
  const [botReady, setBotReady] = useState(false);
  const [bot, setBot] = useState(
    'Discord bot not configured. Existing Discord previews may be cached.',
  );
  async function refresh() {
    const response = await fetch('/api/shares', { cache: 'no-store' });
    const data = (await response.json()) as { error?: string; shares: Share[] };
    if (!response.ok) throw new Error(data.error || 'Could not load links');
    setShares(data.shares);
  }
  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) {
        setBase(window.location.origin);
        void refresh().catch((e) => setError(String(e.message)));
        void fetch('/api/discord')
          .then(
            async (r) =>
              (await r.json()) as {
                description?: string;
                configured?: boolean;
              },
          )
          .then((d: { description?: string; configured?: boolean }) => {
            if (mounted && d.description) {
              setBot(d.description);
              setBotReady(!!d.configured);
            }
          })
          .catch(() => {});
      }
    });
    return () => {
      mounted = false;
    };
  }, []);
  async function publish() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        editing ? `/api/shares/${editing}` : '/api/shares',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            selectedIds: selected,
            includeCodes: codes,
            includePhotos: photos,
          }),
        },
      );
      const data = (await response.json()) as {
        error?: string;
        shares: Share[];
      };
      if (!response.ok) throw new Error(data.error || 'Could not publish');
      await refresh();
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish');
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/shares/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error('Could not revoke link');
      await refresh();
      if (editing === id) setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not revoke');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="share-settings">
      <p className="share-hint">
        Anyone with a link can view its selected records. The same page follows
        your saved edits and refreshes every 15 seconds.
      </p>
      {!saved && (
        <div className="migration-notice">
          Save your current garage before publishing.
          <button onClick={onSave}>Save garage privately</button>
        </div>
      )}
      <label>
        List title
        <input
          type="text"
          maxLength={80}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <fieldset className="share-selection">
        <legend>Servers to include</legend>
        {servers.map((s) => (
          <label className="share-choice" key={s.id} htmlFor={'share-' + s.id}>
            <Checkbox
              id={'share-' + s.id}
              checked={selected.includes(s.id)}
              onCheckedChange={(v) =>
                setSelected((ids) =>
                  v ? [...ids, s.id] : ids.filter((id) => id !== s.id),
                )
              }
            />
            <span>{s.name}</span>
          </label>
        ))}
      </fieldset>
      <label className="share-choice" htmlFor="share-codes">
        <Checkbox
          id="share-codes"
          checked={codes}
          onCheckedChange={(v) => setCodes(!!v)}
        />
        Include skin codes
      </label>
      <label className="share-choice" htmlFor="share-photos">
        <Checkbox
          id="share-photos"
          checked={photos}
          onCheckedChange={(v) => setPhotos(!!v)}
        />
        Include screenshots
      </label>
      <button
        className="primary-button"
        disabled={busy || !saved || !selected.length || !title.trim()}
        onClick={publish}
      >
        {busy
          ? 'Working…'
          : editing
            ? 'Update shared selection'
            : 'Create public link'}
      </button>
      {editing && (
        <button className="text-button" onClick={() => setEditing(null)}>
          Cancel selection edit
        </button>
      )}
      {error && (
        <p className="share-errors" role="alert">
          {error}
        </p>
      )}
      {botReady && (
        <div className="share-hint">
          Discord edits run after saves. Failed or rate-limited edits need a
          retry.
          <button
            className="text-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await fetch('/api/discord', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: '{}',
                });
                const d = (await r.json()) as { status: string };
                setError(
                  d.status === 'synced'
                    ? 'Discord card updated.'
                    : `Discord status: ${d.status}. Try again after the rate limit or configuration issue is resolved.`,
                );
                await refresh();
              } catch {
                setError('Discord retry failed.');
              } finally {
                setBusy(false);
              }
            }}
          >
            Retry Discord sync
          </button>
        </div>
      )}
      {shares.map((s) => (
        <section className="published-share" key={s.id}>
          <h3>
            {s.title}
            {!s.active ? ' · revoked' : ''}
          </h3>
          {s.active && (
            <>
              <input
                aria-label={`Share link for ${s.title}`}
                readOnly
                value={`${base}/s/${s.id}`}
              />
              <div className="share-actions">
                <button
                  className="text-button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(`${base}/s/${s.id}`);
                      setCopied(s.id);
                    } catch {
                      setError('Select the link above and copy it.');
                    }
                  }}
                >
                  {copied === s.id ? 'Copied' : 'Copy link'}
                </button>
                <a
                  className="text-button"
                  href={`/s/${s.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open live page ↗
                </a>
                <a
                  className="text-button"
                  href={`/s/${s.id}/image`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Discord image ↗
                </a>
                <button
                  className="text-button"
                  onClick={() => {
                    setEditing(s.id);
                    setTitle(s.title);
                    setSelected(s.selectedIds);
                    setCodes(s.includeCodes);
                    setPhotos(s.includePhotos);
                  }}
                >
                  Edit selection
                </button>
                <button
                  className="text-button subdued"
                  disabled={busy}
                  onClick={() => void revoke(s.id)}
                >
                  Revoke
                </button>
              </div>
            </>
          )}
        </section>
      ))}
      <p className="share-hint">
        {bot} A bot-owned message is required for a Discord card that updates in
        place. No Discord message is sent when you create a link.
      </p>
      <p className="share-hint">
        Revocation blocks future access. Discord may retain a previously cached
        preview.
      </p>
    </div>
  );
}
