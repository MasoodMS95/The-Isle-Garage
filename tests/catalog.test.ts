import assert from 'node:assert/strict';
import {
  directoryServers,
  officialServers,
  matchesServerQuery,
} from '../lib/server-catalog';
import { emptyDino } from '../lib/garage-model';
assert.equal(officialServers.length, 27);
assert.equal(new Set(officialServers.map((s) => s.id)).size, 27);
assert.ok(!officialServers.some((s) => /QA|EU 3$|EU 5$|SA 2$/.test(s.name)));
const old = {
  ...emptyDino,
  id: 'official-eu1',
  name: 'EU1',
  community: 'The Isle Official',
  kind: 'Official',
  favorite: true,
  growth: 100,
  dinosaurs: { alt: { ...emptyDino, prime: true } },
};
const absent = { ...old, id: 'existing-eu3', name: 'Official EU 3' };
const merged = directoryServers([old, absent]);
assert.equal(merged.length, 28);
const preserved = merged.find((s) => s.id === old.id)!;
assert.equal(preserved.name, 'Official EU 1');
assert.equal(preserved.favorite, true);
assert.equal(preserved.growth, 100);
assert.equal(preserved.dinosaurs?.alt.prime, true);
assert.ok(merged.some((s) => s.id === absent.id));
assert.equal(old.name, 'EU1');
for (const query of ['EU1', 'EU 1', 'Official EU 1'])
  assert.ok(matchesServerQuery(preserved, query));
assert.equal(
  directoryServers([{ ...old, id: 'kept-custom-id', name: 'Official EU 1' }])
    .length,
  27,
);
console.log(
  'PASS: observed official catalog, stable IDs, aliases, preservation and search.',
);
