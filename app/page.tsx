import { requireChatGPTUser } from './chatgpt-auth';
import { getGarage, clientRecords } from '@/lib/server/garage';
import Garage from './garage-client';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await requireChatGPTUser('/');
  const garage = await getGarage(user.userId);
  return (
    <Garage
      initialRecords={clientRecords(garage)}
      initialVersion={garage?.version || 0}
      ownerName={user.fullName || 'Garage owner'}
    />
  );
}
