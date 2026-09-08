import { cache } from 'react';
import { recordSummary } from '@/lib/garage-model';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { publicData } from '@/lib/server/garage';
import { origin } from '@/lib/server/runtime';
import SharedView from '@/app/s/[id]/shared-view';
export const dynamic = 'force-dynamic';
const loadProfile = cache((handle: string) => publicData(handle, true));
type Props = { params: Promise<{ handle: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const data = await loadProfile(handle);
  if (!data)
    return {
      title: 'Share unavailable',
      robots: { index: false, follow: false },
      openGraph: { images: [] },
      twitter: { images: [] },
    };
  const description = data.records
    .slice(0, 5)
    .map(recordSummary)
    .join(' · ')
    .slice(0, 300);
  const image = `${origin()}/parked/${data.handle}/image?v=${data.revision}`;
  return {
    title: data.title,
    alternates: { canonical: `${origin()}/parked/${data.handle}` },
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: data.title,
      description,
      url: `${origin()}/parked/${data.handle}`,
      type: 'website',
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: 'Current garage records',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: data.title,
      description,
      images: [image],
    },
  };
}
export default async function SharedPage({ params }: Props) {
  const { handle } = await params;
  const data = await loadProfile(handle);
  if (!data) notFound();
  if (handle !== data.handle) redirect('/parked/' + data.handle);
  return <SharedView initial={data} />;
}
