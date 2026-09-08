'use client';
import { speciesArtwork } from '@/lib/species-art';
import { growthText } from '@/lib/garage-model';
/* oxlint-disable next/no-img-element -- Images are bundled species illustrations. */
import { useEffect, useState } from 'react';

import type { PublicShare } from '@/lib/garage-types';
export default function SharedView({ initial }: { initial: PublicShare }) {
  const [data, setData] = useState(initial);
  const [unavailable, setUnavailable] = useState(false);
  const [stale, setStale] = useState(false);
  const [copied, setCopied] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/shared/${initial.id}`, {
          cache: 'no-store',
        });
        if (!active) return;
        if (response.status === 404) {
          setUnavailable(true);
          return;
        }
        if (!response.ok) throw new Error();
        const next = (await response.json()) as PublicShare;
        if (active) {
          setData(next);
          setStale(false);
        }
      } catch {
        if (active) setStale(true);
      }
    };
    const timer = setInterval(() => void refresh(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [initial.id]);
  if (unavailable)
    return (
      <main className="public-share">
        <h1>Share unavailable</h1>
        <p>This garage is private or unavailable.</p>
      </main>
    );
  return (
    <main className="public-share">
      <header>
        <span className="eyebrow moss">THE ISLE GARAGE / PUBLIC PROFILE</span>
        <h1>{data.title}</h1>
        <p>All game accounts, dinosaurs &amp; servers</p>
        <p>Game accounts: {data.accountLabels.join(' · ')}</p>
      </header>
      {stale && (
        <p role="alert">
          Connection interrupted. Showing the last received records.
        </p>
      )}
      {data.records.length === 0 && (
        <p className="public-empty">This garage has no server records yet.</p>
      )}
      <div className="public-records">
        {data.records.map((r, i) => (
          <article key={r.server + '-' + i}>
            {r.state !== 'No dinosaur' && (
              <img
                className="species-preview"
                src={speciesArtwork(r.species).src}
                alt={speciesArtwork(r.species).alt}
                width={320}
                height={200}
              />
            )}
            <div className="public-dino">
              <h2 className={r.prime ? 'prime-species' : undefined}>
                {r.state === 'No dinosaur'
                  ? 'No dinosaur'
                  : r.species || 'Unknown dinosaur'}
                {r.prime && <span className="prime-badge">PRIME</span>}
              </h2>
              <span className="public-status" data-state={r.state}>
                {r.state === 'Living' ? 'Parked · Living' : r.state}
              </span>
            </div>
            <dl className="public-facts">
              <div>
                <dt>Server</dt>
                <dd>
                  {r.server}
                  {r.accountLabel && (
                    <span className="public-account-label">
                      {r.accountLabel}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Growth</dt>
                <dd>{r.state === 'No dinosaur' ? '—' : growthText(r)}</dd>
              </div>
            </dl>
            <p className="updated">
              Updated:{' '}
              {r.updatedAt
                ? new Date(r.updatedAt).toLocaleString()
                : 'Not recorded'}
            </p>
            {r.code && (
              <details className="public-details">
                <summary>Skin code</summary>
                {r.code && (
                  <div className="public-code">
                    <label>
                      Skin code
                      <textarea readOnly value={r.code} />
                    </label>
                    <button
                      className="text-button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(r.code!);
                          setCopied(r.server);
                        } catch {
                          setCopied('Select the text to copy');
                        }
                      }}
                    >
                      {copied === r.server ? 'Copied' : 'Copy skin code'}
                    </button>
                  </div>
                )}
              </details>
            )}
          </article>
        ))}
      </div>
      <footer>
        <span>
          No live game connection. Records are updated by their owner.
        </span>
        <span> This profile refreshes every 15 seconds.</span>
      </footer>
    </main>
  );
}
