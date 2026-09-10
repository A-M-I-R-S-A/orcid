CREATE TABLE `nav_links` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`placement` enum('header','footer_shop','footer_help') NOT NULL,
	`label` varchar(60) NOT NULL,
	`href` varchar(255) NOT NULL,
	`is_visible` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nav_links_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE INDEX `nav_links_placement_idx` ON `nav_links` (`placement`,`is_visible`,`sort_order`);
