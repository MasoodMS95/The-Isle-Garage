'use client';
/* oxlint-disable next/no-img-element -- Public share images are access-checked owned uploads. */
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
        <p>This link has been revoked or removed.</p>
      </main>
    );
  return (
    <main className="public-share">
      <header>
        <span className="eyebrow moss">THE ISLE GARAGE / PUBLIC PROFILE</span>
        <h1>{data.title}</h1>
        <p>Dinosaurs &amp; servers</p>
      </header>
      {stale && (
        <p role="alert">
          Connection interrupted. Showing the last received records.
        </p>
      )}
      {data.records.length === 0 && (
        <p className="public-empty">
          No dinosaurs or servers are currently shared.
        </p>
      )}
      <div className="public-records">
        {data.records.map((r, i) => (
          <article key={r.server + '-' + i}>
            <div className="public-dino">
              <h2>
                {r.state === 'No dinosaur'
                  ? 'No dinosaur'
                  : r.species || 'Unknown dinosaur'}
              </h2>
              <span className="public-status" data-state={r.state}>
                {r.state === 'Living' ? 'Parked · Living' : r.state}
              </span>
            </div>
            <dl className="public-facts">
              <div>
                <dt>Server</dt>
                <dd>{r.server}</dd>
              </div>
              <div>
                <dt>Growth</dt>
                <dd>
                  {r.state === 'No dinosaur' || r.state === 'Unknown'
                    ? '—'
                    : `${r.growth}%`}
                </dd>
              </div>
            </dl>
            <p className="updated">
              Updated:{' '}
              {r.updatedAt
                ? new Date(r.updatedAt).toLocaleString()
                : 'Not recorded'}
            </p>
            {(r.photo || r.code) && (
              <details className="public-details">
                <summary>Skin &amp; screenshot</summary>
                {r.photo && (
                  <img
                    src={`${r.photo}?v=${data.revision}`}
                    alt={`${r.species || 'Dinosaur'} screenshot shared by owner`}
                  />
                )}{' '}
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
