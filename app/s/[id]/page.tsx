import { notFound, redirect } from 'next/navigation';
import { publicData } from '@/lib/server/garage';
export const dynamic = 'force-dynamic';
export default async function LegacyProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const data = await publicData((await params).id);
  if (!data) notFound();
  redirect('/parked/' + data.handle);
}
