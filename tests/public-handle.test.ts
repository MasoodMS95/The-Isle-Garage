import assert from 'node:assert/strict';
import { publicHandle } from '../lib/server/public-handle';
assert.equal(publicHandle(' PLAYER_One-2 '), 'player_one-2');
assert.equal(publicHandle('a'.repeat(30)), 'a'.repeat(30));
for (const input of [
  'Karl',
  'İsle',
  'раrked',
  '../name',
  'a/b',
  'ADMIN',
  'garage-owner',
  '__proto__',
  'ab',
  'x'.repeat(31),
  'two--words',
  'two__words',
  'two-_words',
  'name@email.test',
  null,
]) {
  assert.throws(() => publicHandle(input), { status: 400 });
}
console.log(
  'PASS: public username ASCII boundaries, normalization, reserved names and path rejection.',
);
