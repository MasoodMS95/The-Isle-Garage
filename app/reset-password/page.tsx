import ResetForm from './reset-form';
export const dynamic = 'force-dynamic';
export default async function Reset({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return <ResetForm token={(await searchParams).token || ''} />;
}
