import type { Dinosaur, Server, GameAccount } from './garage-types';
export const mainAccounts: GameAccount[] = [{ id: 'main', label: 'Main' }];
export const emptyDino: Dinosaur = {
  state: 'No dinosaur',
  species: '',
  growth: 0,
  growthMode: 'unknown',
  growthStage: '',
  prime: false,
  code: '',
  photo: '',
};
export function dino(r: Dinosaur): Dinosaur {
  return {
    state: r.state,
    species: r.species,
    growth: r.growth,
    growthMode: r.growthMode || (r.growth > 0 ? 'percent' : 'unknown'),
    growthStage: r.growthStage || '',
    prime: !!r.prime,
    code: r.code,
    photo: r.photo,
    updated: r.updated,
  };
}
export function forAccount(s: Server, id: string): Server {
  return { ...s, ...dino(id === 'main' ? s : s.dinosaurs?.[id] || emptyDino) };
}
export function saveAccountView(
  old: Server[],
  next: Server[],
  accountId: string,
): Server[] {
  return next.map((v) => {
    const existing = old.find((s) => s.id === v.id);
    const base = existing || { ...v, ...emptyDino, dinosaurs: {} };
    const metadata = {
      id: v.id,
      name: v.name,
      community: v.community,
      kind: v.kind,
      favorite: v.favorite,
    };
    return accountId === 'main'
      ? { ...base, ...metadata, ...dino(v) }
      : {
          ...base,
          ...metadata,
          dinosaurs: { ...base.dinosaurs, [accountId]: dino(v) },
        };
  });
}
export function selectionKey(accountId: string, serverId: string) {
  return accountId === 'main' ? serverId : accountId + ':' + serverId;
}
export function selectedRecord(
  records: Server[],
  accounts: GameAccount[],
  key: string,
) {
  const colon = key.indexOf(':');
  const accountId = colon < 0 ? 'main' : key.slice(0, colon);
  const serverId = colon < 0 ? key : key.slice(colon + 1);
  const account = accounts.find((a) => a.id === accountId);
  const server = records.find((s) => s.id === serverId);
  return account && server
    ? { record: forAccount(server, accountId), account }
    : null;
}
export function growthText(
  r: Pick<Dinosaur, 'growth' | 'growthMode' | 'growthStage'>,
) {
  const mode = r.growthMode || (r.growth > 0 ? 'percent' : 'unknown');
  return mode === 'stage'
    ? r.growthStage || 'Unknown'
    : mode === 'percent' && r.growth >= 1
      ? r.growth + '%'
      : 'Unknown';
}
export function recordSummary(r: import('./garage-types').PublicRecord) {
  return (
    (r.accountLabel ? r.accountLabel + ' · ' : '') +
    r.server +
    ': ' +
    (r.species ||
      (r.state === 'Unknown' ? 'Unknown dinosaur' : 'No dinosaur')) +
    (r.prime ? ' · PRIME' : '') +
    ' · ' +
    r.state +
    (r.state === 'No dinosaur' ? '' : ' · ' + growthText(r))
  );
}
