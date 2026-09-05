import type { Server, Share, PublicShare } from '../garage-types';
import { db, files, HttpError, obj, str } from './runtime';
export type GarageRow = {
  owner_id: string;
  records: string;
  version: number;
  updated_at: string;
};
export type ShareRow = {
  id: string;
  owner_id: string;
  title: string;
  selected_ids: string;
  include_codes: number;
  include_photos: number;
  active: number;
  updated_at: string;
  discord_status: string;
  next_attempt: number;
};
export async function getGarage(ownerId: string) {
  return db()
    .prepare('SELECT * FROM garages WHERE owner_id=?')
    .bind(ownerId)
    .first<GarageRow>();
}
export function clientRecords(row: GarageRow | null): Server[] | null {
  return row ? (JSON.parse(row.records) as Server[]) : null;
}
export function shareView(s: ShareRow): Share {
  return {
    id: s.id,
    title: s.title,
    selectedIds: JSON.parse(s.selected_ids),
    includeCodes: !!s.include_codes,
    includePhotos: !!s.include_photos,
    active: !!s.active,
    updatedAt: s.updated_at,
    discordStatus: s.discord_status,
  };
}
export async function ownedShare(id: string, ownerId: string) {
  const s = await db()
    .prepare('SELECT * FROM shares WHERE id=? AND owner_id=?')
    .bind(id, ownerId)
    .first<ShareRow>();
  if (!s) throw new HttpError(404, 'Share not found');
  return s;
}
export async function publicData(id: string): Promise<PublicShare | null> {
  if (!/^[a-f0-9]{32}$/.test(id)) return null;
  const s = await db()
    .prepare('SELECT * FROM shares WHERE id=? AND active=1')
    .bind(id)
    .first<ShareRow>();
  if (!s) return null;
  const g = await getGarage(s.owner_id);
  if (!g) return null;
  const ids = new Set(JSON.parse(s.selected_ids) as string[]);
  const records = (JSON.parse(g.records) as Server[])
    .filter((r) => ids.has(r.id))
    .map((r) => ({
      server: r.name,
      kind: r.kind,
      state: r.state,
      species: r.species,
      growth: r.growth,
      updatedAt: r.updated || null,
      ...(s.include_codes && r.code ? { code: r.code } : {}),
      ...(s.include_photos && r.photo
        ? { photo: `/s/${id}/photo/${encodeURIComponent(r.id)}` }
        : {}),
    }));
  return {
    id,
    title: s.title,
    records,
    updatedAt: g.updated_at > s.updated_at ? g.updated_at : s.updated_at,
    revision: `${g.version}-${Date.parse(s.updated_at)}`,
    source: 'Manual website records',
  };
}
export async function publicPhoto(id: string, recordId: string) {
  const s = await db()
    .prepare(
      'SELECT * FROM shares WHERE id=? AND active=1 AND include_photos=1',
    )
    .bind(id)
    .first<ShareRow>();
  if (!s || !(JSON.parse(s.selected_ids) as string[]).includes(recordId))
    return null;
  const g = await getGarage(s.owner_id);
  const r =
    g && (JSON.parse(g.records) as Server[]).find((r) => r.id === recordId);
  if (!r?.photo.startsWith('/api/photos/')) return null;
  return files().get(`${s.owner_id}/${r.photo.slice('/api/photos/'.length)}`);
}
export async function validateRecords(
  input: unknown,
  ownerId: string,
  old: Server[],
): Promise<Server[]> {
  if (!Array.isArray(input) || input.length > 100)
    throw new HttpError(400, 'At most 100 records are supported');
  const seen = new Set<string>();
  const result: Server[] = [];
  for (const raw of input) {
    const r = obj(raw);
    const id = str(r.id, 100);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || seen.has(id))
      throw new HttpError(400, 'Invalid or duplicate record ID');
    seen.add(id);
    const state = str(r.state, 20) as Server['state'];
    if (
      !['Living', 'Dead', 'Unknown', 'No dinosaur'].includes(state) ||
      typeof r.favorite !== 'boolean' ||
      typeof r.growth !== 'number' ||
      !Number.isFinite(r.growth) ||
      r.growth < 0 ||
      r.growth > 100
    )
      throw new HttpError(400, 'Invalid record');
    let photo = str(r.photo, 1400000);
    if (photo.startsWith('data:')) {
      const match =
        /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(photo);
      if (!match) throw new HttpError(400, 'Use PNG, JPEG, or WebP');
      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
      } catch {
        throw new HttpError(400, 'Invalid image');
      }
      if (bytes.length > 1000000)
        throw new HttpError(400, 'Image must be under 1 MB');
      const valid =
        match[1] === 'png'
          ? bytes[0] === 137 &&
            bytes[1] === 80 &&
            bytes[2] === 78 &&
            bytes[3] === 71
          : match[1] === 'jpeg'
            ? bytes[0] === 255 && bytes[1] === 216
            : bytes[0] === 82 &&
              bytes[1] === 73 &&
              bytes[2] === 70 &&
              bytes[3] === 70 &&
              bytes[8] === 87 &&
              bytes[9] === 69 &&
              bytes[10] === 66 &&
              bytes[11] === 80;
      if (!valid)
        throw new HttpError(400, 'Image content does not match its type');
      const key = crypto.randomUUID();
      await files().put(`${ownerId}/${key}`, bytes, {
        httpMetadata: { contentType: `image/${match[1]}` },
      });
      photo = `/api/photos/${key}`;
    } else if (photo && !old.some((v) => v.id === id && v.photo === photo))
      throw new HttpError(400, 'Unknown screenshot');
    const previous = old.find((v) => v.id === id);
    const next: Server = {
      id,
      name: str(r.name, 100).trim(),
      community: str(r.community, 100),
      kind: str(r.kind, 30),
      favorite: r.favorite,
      state,
      species: str(r.species, 100),
      growth: r.growth,
      code: str(r.code, 2000),
      photo,
    };
    if (!next.name) throw new HttpError(400, 'Server name required');
    if (state === 'No dinosaur') {
      next.species = '';
      next.growth = 0;
      next.code = '';
      next.photo = '';
    }
    const changed =
      !previous ||
      ['state', 'species', 'growth', 'code', 'photo'].some(
        (k) => previous[k as keyof Server] !== next[k as keyof Server],
      );
    next.updated = changed ? new Date().toISOString() : previous.updated;
    result.push(next);
  }
  return result;
}
export function shareInput(input: unknown, records: Server[]) {
  const r = obj(input);
  const title = str(r.title, 80).trim();
  if (!title) throw new HttpError(400, 'Title required');
  if (
    !Array.isArray(r.selectedIds) ||
    r.selectedIds.length < 1 ||
    r.selectedIds.length > 100 ||
    !r.selectedIds.every(
      (id) => typeof id === 'string' && records.some((s) => s.id === id),
    )
  )
    throw new HttpError(400, 'Choose existing servers to share');
  if (
    typeof r.includeCodes !== 'boolean' ||
    typeof r.includePhotos !== 'boolean'
  )
    throw new HttpError(400, 'Choose sharing options');
  return {
    title,
    selectedIds: [...new Set(r.selectedIds)],
    includeCodes: r.includeCodes ? 1 : 0,
    includePhotos: r.includePhotos ? 1 : 0,
  };
}
