import { HttpError } from './runtime';
const reserved = new Set([
  'admin',
  'administrator',
  'api',
  'auth',
  'account',
  'accounts',
  'login',
  'logout',
  'signup',
  'register',
  'parked',
  'profile',
  'profiles',
  'garage',
  'garages',
  'help',
  'support',
  'settings',
  'static',
  'image',
  'images',
  'new',
  'edit',
  'root',
  'www',
  'theislegarage',
  'undefined',
  'null',
]);
export function publicHandle(input: unknown) {
  if (typeof input !== 'string')
    throw new HttpError(400, 'Enter a public username.');
  const value = input.trim().toLowerCase();
  if (
    !/^[A-Za-z0-9_-]+$/.test(input.trim()) ||
    value.length < 3 ||
    value.length > 30 ||
    !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(value) ||
    reserved.has(value) ||
    value.startsWith('garage-')
  )
    throw new HttpError(
      400,
      'Use 3–30 letters or numbers with optional single hyphens or underscores between words. Choose a non-reserved name.',
    );
  return value;
}
