import { emptyDino } from './garage-model';
import type { Server } from './garage-types';
// User-supplied in-game screenshots, received 2026-09-06; see docs/SERVERS.md.
const regions = {
  US: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  EU: [1, 2, 4, 6, 7, 8, 9, 10, 11],
  AU: [1, 2, 3],
  SA: [1, 3],
};
export const officialServers: Server[] = Object.entries(regions).flatMap(
  ([region, numbers]) =>
    numbers.map((number) => ({
      ...emptyDino,
      id: 'official-' + region.toLowerCase() + number,
      name: 'Official ' + region + ' ' + number,
      community: 'The Isle Official',
      kind: 'Official',
      favorite: false,
    })),
);
function catalogMatch(server: Server) {
  if (server.kind !== 'Official') return undefined;
  const compact = server.name
    .toLowerCase()
    .replace(/^official\s*/, '')
    .replace(/\s/g, '');
  return officialServers.find(
    (item) => item.id === server.id || item.id === 'official-' + compact,
  );
}
export function officialDisplay(server: Server): Server {
  const match = catalogMatch(server);
  return match ? { ...server, name: match.name } : server;
}
export function directoryServers(saved: Server[]): Server[] {
  const covered = new Set(saved.map((server) => catalogMatch(server)?.id));
  return [
    ...saved.map(officialDisplay),
    ...officialServers.filter((server) => !covered.has(server.id)),
  ];
}
export function matchesServerQuery(server: Server, query: string) {
  const haystack = (server.name + ' ' + server.community).toLowerCase();
  const normalized = query.trim().toLowerCase();
  return (
    haystack.includes(normalized) ||
    haystack.replace(/\s/g, '').includes(normalized.replace(/\s/g, ''))
  );
}
