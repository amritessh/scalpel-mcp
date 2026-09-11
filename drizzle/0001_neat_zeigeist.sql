CREATE TABLE `calls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`caller_name` text,
	`caller_file` text NOT NULL,
	`caller_start_line` integer,
	`caller_end_line` integer,
	`callee_name` text NOT NULL,
	`call_line` integer NOT NULL,
	`resolved` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_calls_callee` ON `calls` (`callee_name`);--> statement-breakpoint
CREATE INDEX `idx_calls_caller` ON `calls` (`caller_name`);--> statement-breakpoint
CREATE TABLE `imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file` text NOT NULL,
	`source` text NOT NULL,
	`resolved_file` text,
	`kind` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_imports_file` ON `imports` (`file`);--> statement-breakpoint
CREATE INDEX `idx_imports_resolved` ON `imports` (`resolved_file`);