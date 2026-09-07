import LoginForm from './login-form';
import { mailConfigured } from '@/lib/server/config';
export const dynamic = 'force-dynamic';
export default function Login() {
  return <LoginForm mailAvailable={mailConfigured()} />;
}
