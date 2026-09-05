import { env } from 'cloudflare:workers';
import { owner } from '@/lib/server/owner';
import { failure, json, mutation } from '@/lib/server/runtime';
import { discordConfigured, syncDiscord } from '@/lib/server/discord';
export async function GET() {
  try {
    const ownerId = await owner();
    const configured = discordConfigured() && env.DISCORD_OWNER_ID === ownerId;
    return json({
      configured,
      description: configured
        ? 'Bot-owned message edits are configured.'
        : 'Bot connection not configured. Share pages work; existing Discord unfurls do not update automatically.',
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    mutation(request);
    return json({ status: await syncDiscord(await owner()) });
  } catch (e) {
    return failure(e);
  }
}
