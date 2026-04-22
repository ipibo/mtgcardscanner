CREATE TABLE `card_cache` (
	`scryfall_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`cached_at` integer DEFAULT (unixepoch()) NOT NULL,
	`prices_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `collection_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`scryfall_id` text NOT NULL,
	`card_name` text NOT NULL,
	`set_code` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`foil` integer DEFAULT false NOT NULL,
	`added_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT 'local' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
