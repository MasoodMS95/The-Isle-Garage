import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const garages = sqliteTable('garages', {
  ownerId: text('owner_id').primaryKey(),
  records: text('records').notNull(),
  version: integer('version').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});
export const shares = sqliteTable(
  'shares',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => garages.ownerId),
    title: text('title').notNull(),
    selectedIds: text('selected_ids').notNull(),
    includeCodes: integer('include_codes').notNull().default(0),
    includePhotos: integer('include_photos').notNull().default(0),
    active: integer('active').notNull().default(1),
    updatedAt: text('updated_at').notNull(),
    discordStatus: text('discord_status').notNull().default('not_configured'),
    nextAttempt: integer('next_attempt').notNull().default(0),
  },
  (t) => [index('idx_shares_owner').on(t.ownerId)],
);
