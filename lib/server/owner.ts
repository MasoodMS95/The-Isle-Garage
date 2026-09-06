import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from '../auth';
import { HttpError } from './runtime';
export async function currentUser() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session?.user.emailVerified
    ? { id: session.user.id, name: session.user.name }
    : null;
}
export async function owner() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, 'Sign in to manage your garage');
  return user.id;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect('/login');
  return user;
}
