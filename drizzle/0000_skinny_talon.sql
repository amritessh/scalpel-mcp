CREATE TABLE `definitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`file` text NOT NULL,
	`start_line` integer NOT NULL,
	`end_line` integer NOT NULL,
	`doc` text
);
--> statement-breakpoint
CREATE INDEX `idx_definitions_name` ON `definitions` (`name`);--> statement-breakpoint
CREATE TABLE `usages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`file` text NOT NULL,
	`line` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_usages_name` ON `usages` (`name`);