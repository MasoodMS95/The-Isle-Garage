import { requireUser } from '@/lib/server/owner';
import { getGarage, clientRecords, clientAccounts } from '@/lib/server/garage';
import Garage from './garage-client';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await requireUser();
  const garage = await getGarage(user.id);
  return (
    <Garage
      initialAccounts={clientAccounts(garage)}
      initialRecords={clientRecords(garage)}
      initialVersion={garage?.version || 0}
      ownerName={user.name || 'Garage owner'}
    />
  );
}
