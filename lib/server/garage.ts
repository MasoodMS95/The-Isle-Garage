import {
  mainAccounts,
  dino,
  selectedRecord,
  forAccount,
} from '../garage-model';
import { stages } from '../garage-types';
import type { Server, PublicShare, GameAccount } from '../garage-types';
import { db, HttpError, obj, str } from './runtime';
export type GarageRow = {
  owner_id: string;
  records: string;
  version: number;
  updated_at: string;
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
export async function publicData(
  id: string,
  byHandle = false,
): Promise<PublicShare | null> {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  id = id.toLowerCase();
  if (
    byHandle
      ? !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(id) || id.length > 39
      : !/^[a-f0-9]{32}$/.test(id)
  )
    return null;
  const row = await db()
    .prepare(
      'SELECT p.public_id,p.handle,p.initial_handle,p.updated_at AS profile_updated_at,p.version AS profile_version,g.records,g.version,g.updated_at FROM garage_profiles p LEFT JOIN garages g ON g.owner_id=p.owner_id WHERE ' +
        (byHandle ? '(p.handle=? OR p.initial_handle=?)' : 'p.public_id=?') +
        ' AND p.is_public=true',
    )
    .bind(...(byHandle ? [id, id] : [id]))
    .first<
      GarageRow & {
        public_id: string;
        handle: string | null;
        initial_handle: string;
        profile_updated_at: Date;
        profile_version: number;
      }
    >();
  if (!row) return null;
  const garage = row.records ? row : null;
  const servers = clientRecords(garage) || [];
  const accounts = clientAccounts(garage);
  const records = accounts.flatMap((account) =>
    servers.map((server) => {
      const r = forAccount(server, account.id);
      return {
        server: r.name,
        kind: r.kind,
        state: r.state,
        species: r.species,
        growth: r.growth,
        growthMode: r.growthMode,
        growthStage: r.growthStage,
        prime: !!r.prime,
        accountLabel: account.label,
        code: r.code,
        updatedAt: r.updated || null,
      };
    }),
  );
  const updatedAt = new Date(
    Math.max(
      new Date(row.profile_updated_at).getTime(),
      row.updated_at ? Date.parse(row.updated_at) : 0,
    ),
  ).toISOString();
  return {
    id: row.public_id,
    handle: row.handle || row.initial_handle,
    title: 'Garage profile',
    accountLabels: accounts.map((account) => account.label),
    records,
    updatedAt,
    revision: `${row.version || 0}-${row.profile_version}`,
    source: 'Manual website records',
  };
}
export async function validateRecords(
  input: unknown,
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
    // Accept an old stored reference only to discard it. New uploads/URLs are retired.
    if (
      r.photo &&
      (typeof r.photo !== 'string' ||
        !/^\/api\/photos\/[a-f0-9-]{36}$/.test(r.photo))
    )
      throw new HttpError(400, 'Screenshot uploads are no longer supported');
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
      photo: '',
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
  if (typeof r.includeCodes !== 'boolean')
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
    includePhotos: 0, // Retain the legacy SQL column without enabling old uploads.
  };
}
