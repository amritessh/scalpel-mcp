CREATE TABLE `type_references` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`referencer_name` text,
	`referencer_file` text NOT NULL,
	`referencer_start_line` integer,
	`referencer_end_line` integer,
	`referenced_name` text NOT NULL,
	`reference_line` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_type_references_referenced` ON `type_references` (`referenced_name`);--> statement-breakpoint
CREATE INDEX `idx_type_references_referencer` ON `type_references` (`referencer_name`);