import { getChatGPTUser } from '@/app/chatgpt-auth';
import { HttpError } from './runtime';
export async function owner() {
  const user = await getChatGPTUser();
  if (!user)
    throw new HttpError(401, 'Sign in with ChatGPT to manage your garage');
  return user.userId;
}
