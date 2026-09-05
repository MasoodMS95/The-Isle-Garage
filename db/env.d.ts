declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    SITE_ORIGIN?: string;
    DISCORD_BOT_TOKEN?: string;
    DISCORD_CHANNEL_ID?: string;
    DISCORD_MESSAGE_ID?: string;
    DISCORD_SHARE_ID?: string;
    DISCORD_OWNER_ID?: string;
    DISCORD_SYNC_ENABLED?: string;
  }
}
