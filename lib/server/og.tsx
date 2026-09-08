import { growthText } from '../garage-model';
/* oxlint-disable next/no-img-element -- ImageResponse consumes raster data directly, not Next image components. */
import { ImageResponse } from 'next/og';
import { publicData } from './garage';
import { speciesArtwork } from '../species-art';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { json, noStore } from './runtime';
export async function garageImage(id: string) {
  const data = await publicData(id);
  if (!data) return json({ error: 'Share unavailable' }, 404);
  const imageRecord = data.records.find((r) => r.state !== 'No dinosaur');
  const artwork = imageRecord ? speciesArtwork(imageRecord.species) : undefined;
  const photo = artwork
    ? 'data:image/svg+xml;base64,' +
      (
        await readFile(path.join(process.cwd(), 'public', artwork.src))
      ).toString('base64')
    : undefined;
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: '#0b1710',
        color: '#bed7b8',
        fontFamily: 'sans-serif',
        padding: 48,
        flexDirection: 'column',
        border: '8px solid #435440',
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: 21,
          letterSpacing: 4,
          color: '#8cbb8b',
        }}
      >
        THE ISLE GARAGE / SHARED RECORDS
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 44,
          marginTop: 24,
          marginBottom: 24,
          fontWeight: 700,
        }}
      >
        {data.title.slice(0, 60)}
      </div>
      <div style={{ display: 'flex', flex: 1, gap: 32 }}>
        <div
          style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 18 }}
        >
          {data.records.slice(0, 3).map((r, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                paddingBottom: 15,
                borderBottom: '1px solid #354c36',
              }}
            >
              <span style={{ fontSize: 21, color: '#9daf95' }}>
                {(r.accountLabel ? r.accountLabel + ' · ' : '') +
                  r.server.slice(0, 45)}
              </span>
              <span
                style={{
                  fontSize: 25,
                  marginTop: 5,
                  color: r.prime ? '#e3c26a' : '#bed7b8',
                }}
              >
                {(r.species || 'No dinosaur').slice(0, 35)}
                {r.prime ? ' · PRIME' : ''}
                {' · ' + r.state}
                {r.state !== 'No dinosaur' ? ' · ' + growthText(r) : ''}
              </span>
            </div>
          ))}
        </div>
        {photo && (
          <img
            src={photo}
            alt={artwork?.alt}
            width={320}
            height={265}
            style={{ objectFit: 'contain' }}
          />
        )}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 17,
          color: '#94a88c',
          marginTop: 18,
        }}
      >
        <span>
          {data.records.length} account/server records · manual records
        </span>
        <span>
          {new Date(data.updatedAt)
            .toISOString()
            .slice(0, 16)
            .replace('T', ' ')}{' '}
          UTC
        </span>
      </div>
    </div>,
    { width: 1200, height: 630, headers: noStore },
  );
}
