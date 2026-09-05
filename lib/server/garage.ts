import { mainAccounts, dino, selectedRecord } from '../garage-model';
import { stages } from '../garage-types';
import type { Server, Share, PublicShare, GameAccount } from '../garage-types';
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
  if (!row) return null;
  const data = JSON.parse(row.records);
  const records = (Array.isArray(data) ? data : data.servers) as Server[];
  return records.map((s) => ({
    ...s,
    ...dino(s),
    dinosaurs: Object.fromEntries(
      Object.entries(s.dinosaurs || {}).map(([id, r]) => [id, dino(r)]),
    ),
  }));
}
export function clientAccounts(row: GarageRow | null): GameAccount[] {
  if (!row) return mainAccounts;
  const data = JSON.parse(row.records);
  return Array.isArray(data) ? mainAccounts : data.accounts;
}
export function validateAccounts(
  input: unknown,
  old: GameAccount[],
): GameAccount[] {
  if (input === undefined) return old;
  if (!Array.isArray(input) || !input.length || input.length > 20)
    throw new HttpError(400, 'Use 1 to 20 game accounts');
  const seen = new Set<string>();
  const labels = new Set<string>();
  const accounts = input.map((raw) => {
    const a = obj(raw),
      id = str(a.id, 80),
      label = str(a.label, 40).trim();
    if (
      !/^[a-zA-Z0-9_-]+$/.test(id) ||
      ['__proto__', 'constructor', 'prototype'].includes(id) ||
      seen.has(id) ||
      !label ||
      labels.has(label.toLowerCase())
    )
      throw new HttpError(400, 'Use unique account names and IDs');
    seen.add(id);
    labels.add(label.toLowerCase());
    return { id, label };
  });
  if (!seen.has('main') || old.some((a) => !seen.has(a.id)))
    throw new HttpError(400, 'Existing game accounts must be retained');
  return accounts;
}
function selection(s: ShareRow): {
  ids: string[];
  includeAccountLabels: boolean;
} {
  const data = JSON.parse(s.selected_ids);
  return Array.isArray(data)
    ? { ids: data, includeAccountLabels: false }
    : data;
}
export function shareView(s: ShareRow): Share {
  return {
    id: s.id,
    title: s.title,
    selectedIds: selection(s).ids,
    includeAccountLabels: !!selection(s).includeAccountLabels,
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
  const chosen = selection(s);
  const saved = clientRecords(g) || [];
  const accounts = clientAccounts(g);
  const records = chosen.ids.flatMap((key) => {
    const item = selectedRecord(saved, accounts, key);
    if (!item) return [];
    const r = item.record;
    return [
      {
        server: r.name,
        kind: r.kind,
        state: r.state,
        species: r.species,
        growth: r.growth,
        growthMode: r.growthMode,
        growthStage: r.growthStage,
        prime: !!r.prime,
        updatedAt: r.updated || null,
        ...(chosen.includeAccountLabels
          ? { accountLabel: item.account.label }
          : {}),
        ...(s.include_codes && r.code ? { code: r.code } : {}),
        ...(s.include_photos && r.photo
          ? { photo: '/s/' + id + '/photo/' + encodeURIComponent(key) }
          : {}),
      },
    ];
  });
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
  if (!s || !selection(s).ids.includes(recordId)) return null;
  const g = await getGarage(s.owner_id);
  const r =
    g &&
    selectedRecord(clientRecords(g) || [], clientAccounts(g), recordId)?.record;
  if (!r?.photo.startsWith('/api/photos/')) return null;
  return files().get(`${s.owner_id}/${r.photo.slice('/api/photos/'.length)}`);
}
export async function validateRecords(
  input: unknown,
  ownerId: string,
  old: Server[],
  accounts: GameAccount[] = mainAccounts,
): Promise<Server[]> {
  if (!Array.isArray(input) || input.length > 100)
    throw new HttpError(400, 'At most 100 records are supported');
  const seen = new Set<string>();
  const result: Server[] = [];
  for (const raw of input) {
    const r = obj(raw);
    const id = str(r.id, 100);
    if (
      !/^[a-zA-Z0-9_-]+$/.test(id) ||
      ['__proto__', 'constructor', 'prototype'].includes(id) ||
      seen.has(id)
    )
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
    const growthMode =
      r.growthMode === undefined
        ? r.growth > 0
          ? 'percent'
          : 'unknown'
        : r.growthMode;
    if (
      typeof growthMode !== 'string' ||
      !['percent', 'stage', 'unknown'].includes(growthMode)
    )
      throw new HttpError(400, 'Invalid growth mode');
    if (growthMode === 'percent' && (r.growth < 1 || r.growth > 100))
      throw new HttpError(400, 'Percentage growth must be 1 to 100');
    if (
      growthMode === 'stage' &&
      !stages.includes(r.growthStage as (typeof stages)[number])
    )
      throw new HttpError(400, 'Choose a growth stage');
    if (r.prime !== undefined && typeof r.prime !== 'boolean')
      throw new HttpError(400, 'Invalid Prime status');
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
      growth: growthMode === 'percent' ? r.growth : 0,
      growthMode: growthMode as Server['growthMode'],
      growthStage:
        growthMode === 'stage' ? (r.growthStage as Server['growthStage']) : '',
      prime: !!r.prime,
      code: str(r.code, 2000),
      photo,
    };
    if (!next.name) throw new HttpError(400, 'Server name required');
    if (state === 'No dinosaur') {
      next.species = '';
      next.growth = 0;
      next.growthMode = 'unknown';
      next.growthStage = '';
      next.prime = false;
      next.code = '';
      next.photo = '';
    }
    const changed =
      !previous ||
      [
        'state',
        'species',
        'growth',
        'growthMode',
        'growthStage',
        'prime',
        'code',
        'photo',
      ].some((k) => previous[k as keyof Server] !== next[k as keyof Server]);
    next.updated = changed ? new Date().toISOString() : previous.updated;
    const nested =
      r.dinosaurs === undefined ? previous?.dinosaurs || {} : obj(r.dinosaurs);
    next.dinosaurs = {};
    for (const [accountId, value] of Object.entries(nested)) {
      if (accountId === 'main' || !accounts.some((a) => a.id === accountId))
        throw new HttpError(400, 'Unknown game account');
      const inputDino = obj(value);
      const priorDino = previous?.dinosaurs?.[accountId];
      const validated = await validateRecords(
        [
          {
            ...inputDino,
            dinosaurs: {},
            id,
            name: next.name,
            community: next.community,
            kind: next.kind,
            favorite: next.favorite,
          },
        ],
        ownerId,
        priorDino ? [{ ...previous!, ...priorDino, dinosaurs: {} }] : [],
        accounts,
      );
      next.dinosaurs[accountId] = dino(validated[0]);
    }
    result.push(next);
  }
  return result;
}
export function shareInput(
  input: unknown,
  records: Server[],
  accounts: GameAccount[] = mainAccounts,
) {
  const r = obj(input);
  const title = str(r.title, 80).trim();
  if (!title) throw new HttpError(400, 'Title required');
  if (
    !Array.isArray(r.selectedIds) ||
    r.selectedIds.length < 1 ||
    r.selectedIds.length > 100 ||
    !r.selectedIds.every(
      (id) => typeof id === 'string' && !!selectedRecord(records, accounts, id),
    )
  )
    throw new HttpError(400, 'Choose existing servers to share');
  if (
    typeof r.includeCodes !== 'boolean' ||
    typeof r.includePhotos !== 'boolean'
  )
    throw new HttpError(400, 'Choose sharing options');
  if (
    r.includeAccountLabels !== undefined &&
    typeof r.includeAccountLabels !== 'boolean'
  )
    throw new HttpError(400, 'Choose account label visibility');
  return {
    title,
    includeAccountLabels: !!r.includeAccountLabels,
    selectedIds: [...new Set(r.selectedIds)],
    includeCodes: r.includeCodes ? 1 : 0,
    includePhotos: r.includePhotos ? 1 : 0,
  };
}
