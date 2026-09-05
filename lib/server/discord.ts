import { recordSummary } from '../garage-model';
import { env } from 'cloudflare:workers';
import { db, origin } from './runtime';
import { publicData, type ShareRow } from './garage';
export function discordConfigured() {
  return (
    env.DISCORD_SYNC_ENABLED === 'true' &&
    !!env.DISCORD_BOT_TOKEN &&
    !!env.DISCORD_CHANNEL_ID &&
    !!env.DISCORD_MESSAGE_ID &&
    !!env.DISCORD_SHARE_ID &&
    !!env.DISCORD_OWNER_ID
  );
}
export async function syncDiscord(ownerId: string) {
  if (!discordConfigured() || env.DISCORD_OWNER_ID !== ownerId)
    return 'not_configured';
  const id = env.DISCORD_SHARE_ID!;
  const share = await db()
    .prepare('SELECT * FROM shares WHERE id=? AND owner_id=?')
    .bind(id, ownerId)
    .first<ShareRow>();
  if (!share) return 'not_configured';
  if (share.next_attempt > Date.now()) return 'rate_limited';
  const headers = {
    Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
    'Content-Type': 'application/json',
  };
  const status = async (value: string, next = 0) => {
    await db()
      .prepare(
        'UPDATE shares SET discord_status=?,next_attempt=? WHERE id=? AND owner_id=?',
      )
      .bind(value, next, id, ownerId)
      .run();
    return value;
  };
  try {
    const identity = await fetch('https://discord.com/api/v10/users/@me', {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (identity.status === 429) {
      const limit = (await identity.json()) as { retry_after?: number };
      return status(
        'rate_limited',
        Date.now() + Math.max(1000, (limit.retry_after || 60) * 1000),
      );
    }
    if (!identity.ok) return status('configuration_error');
    const me = (await identity.json()) as { id: string };
    const endpoint = `https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages/${env.DISCORD_MESSAGE_ID}`;
    const existing = await fetch(endpoint, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (existing.status === 429) {
      const limit = (await existing.json()) as { retry_after?: number };
      return status(
        'rate_limited',
        Date.now() + Math.max(1000, (limit.retry_after || 60) * 1000),
      );
    }
    if (!existing.ok)
      return status(
        existing.status === 404 ? 'message_missing' : 'configuration_error',
      );
    const message = (await existing.json()) as { author: { id: string } };
    if (message.author.id !== me.id) return status('not_bot_owned');
    const data = await publicData(id);
    const payload = data
      ? {
          content: '',
          allowed_mentions: { parse: [] },
          embeds: [
            {
              title: data.title,
              url: `${origin()}/s/${id}`,
              description: data.records
                .slice(0, 8)
                .map(recordSummary)
                .join('\n')
                .slice(0, 3500),
              color: 9685403,
              image: { url: `${origin()}/s/${id}/image?v=${data.revision}` },
              footer: { text: 'Manual website records · open link for latest' },
              timestamp: data.updatedAt,
            },
          ],
        }
      : {
          content: 'This garage share has been revoked.',
          embeds: [],
          allowed_mentions: { parse: [] },
        };
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 429) {
      const error = (await response.json()) as { retry_after?: number };
      return status(
        'rate_limited',
        Date.now() + Math.max(1000, (error.retry_after || 60) * 1000),
      );
    }
    return status(response.ok ? 'synced' : 'sync_failed');
  } catch {
    return status('sync_failed');
  }
}
