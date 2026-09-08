import { cache } from 'react';
import { recordSummary } from '@/lib/garage-model';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { publicData } from '@/lib/server/garage';
import { origin } from '@/lib/server/runtime';
import SharedView from './shared-view';
export const dynamic = 'force-dynamic';
const loadProfile = cache(publicData);
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await loadProfile(id);
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
  const image = `${origin()}/s/${id}/image?v=${data.revision}`;
  return {
    title: data.title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: data.title,
      description,
      url: `${origin()}/s/${id}`,
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
  const data = await loadProfile((await params).id);
  if (!data) notFound();
  return <SharedView initial={data} />;
}
