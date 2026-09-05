CREATE TABLE `garages` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`records` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shares` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`selected_ids` text NOT NULL,
	`include_codes` integer DEFAULT 0 NOT NULL,
	`include_photos` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`discord_status` text DEFAULT 'not_configured' NOT NULL,
	`next_attempt` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `garages`(`owner_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_shares_owner` ON `shares` (`owner_id`);