CREATE TABLE `addresses` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`full_name` varchar(120) NOT NULL,
	`phone` varchar(11) NOT NULL,
	`province` varchar(60) NOT NULL,
	`city` varchar(80) NOT NULL,
	`address_line` text NOT NULL,
	`postal_code` varchar(10) NOT NULL,
	`notes` text,
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `addresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `otp_requests` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`phone` varchar(11) NOT NULL,
	`code_hash` varchar(64) NOT NULL,
	`purpose` enum('login','verify_phone') NOT NULL DEFAULT 'login',
	`attempts` int NOT NULL DEFAULT 0,
	`max_attempts` int NOT NULL DEFAULT 5,
	`consumed_at` timestamp,
	`expires_at` datetime NOT NULL,
	`ip` varchar(45),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `otp_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`identifier` varchar(190) NOT NULL,
	`action` varchar(64) NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	`window_start` datetime NOT NULL,
	`expires_at` datetime NOT NULL,
	CONSTRAINT `rate_limits_id` PRIMARY KEY(`id`),
	CONSTRAINT `rl_identifier_action_unq` UNIQUE(`identifier`,`action`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`ip` varchar(45),
	`user_agent` varchar(255),
	`expires_at` datetime NOT NULL,
	`revoked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_token_unq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`phone` varchar(11) NOT NULL,
	`full_name` varchar(120),
	`email` varchar(190),
	`phone_verified_at` timestamp,
	`is_active` boolean NOT NULL DEFAULT true,
	`disabled_reason` varchar(255),
	`last_login_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_phone_unq` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`admin_user_id` bigint unsigned NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`ip` varchar(45),
	`user_agent` varchar(255),
	`expires_at` datetime NOT NULL,
	`revoked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_sessions_token_unq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `admin_users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`username` varchar(60) NOT NULL,
	`full_name` varchar(120) NOT NULL,
	`email` varchar(190),
	`password_hash` varchar(255) NOT NULL,
	`role_id` bigint unsigned NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`last_login_at` timestamp,
	`failed_attempts` bigint NOT NULL DEFAULT 0,
	`locked_until` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_username_unq` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`actor_id` bigint unsigned,
	`actor_name` varchar(120) NOT NULL,
	`action` varchar(80) NOT NULL,
	`entity_type` varchar(60) NOT NULL,
	`entity_id` varchar(60),
	`summary` varchar(255),
	`metadata` json,
	`ip` varchar(45),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`key` varchar(80) NOT NULL,
	`group_key` varchar(40) NOT NULL,
	`label` varchar(160) NOT NULL,
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `permissions_key_unq` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` bigint unsigned NOT NULL,
	`permission_id` bigint unsigned NOT NULL,
	CONSTRAINT `role_perm_unq` UNIQUE(`role_id`,`permission_id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`key` varchar(60) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(255),
	`is_system` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_key_unq` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`parent_id` bigint unsigned,
	`name` varchar(120) NOT NULL,
	`slug` varchar(190) NOT NULL,
	`description` text,
	`image_path` varchar(255),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_visible` boolean NOT NULL DEFAULT true,
	`seo_title` varchar(190),
	`seo_description` varchar(320),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `product_categories` (
	`product_id` bigint unsigned NOT NULL,
	`category_id` bigint unsigned NOT NULL,
	CONSTRAINT `product_category_unq` UNIQUE(`product_id`,`category_id`)
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`product_id` bigint unsigned NOT NULL,
	`path` varchar(255) NOT NULL,
	`alt` varchar(255),
	`width` int NOT NULL,
	`height` int NOT NULL,
	`is_primary` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_option_values` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`option_id` bigint unsigned NOT NULL,
	`value` varchar(80) NOT NULL,
	`swatch_hex` varchar(7),
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_option_values_id` PRIMARY KEY(`id`),
	CONSTRAINT `option_value_unq` UNIQUE(`option_id`,`value`)
);
--> statement-breakpoint
CREATE TABLE `product_options` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`product_id` bigint unsigned NOT NULL,
	`name` varchar(60) NOT NULL,
	`kind` enum('size','color','other') NOT NULL DEFAULT 'other',
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_options_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_tags` (
	`product_id` bigint unsigned NOT NULL,
	`tag_id` bigint unsigned NOT NULL,
	CONSTRAINT `product_tag_unq` UNIQUE(`product_id`,`tag_id`)
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`product_id` bigint unsigned NOT NULL,
	`sku` varchar(64) NOT NULL,
	`price` bigint unsigned NOT NULL,
	`discount_price` bigint unsigned,
	`stock_qty` int NOT NULL DEFAULT 0,
	`low_stock_threshold` int NOT NULL DEFAULT 3,
	`image_id` bigint unsigned,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `variants_sku_unq` UNIQUE(`sku`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(190) NOT NULL,
	`slug` varchar(190) NOT NULL,
	`short_description` varchar(320),
	`description` text,
	`primary_category_id` bigint unsigned,
	`search_text` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`is_archived` boolean NOT NULL DEFAULT false,
	`is_featured` boolean NOT NULL DEFAULT false,
	`is_new_arrival` boolean NOT NULL DEFAULT false,
	`is_bestseller` boolean NOT NULL DEFAULT false,
	`rating_sum` int NOT NULL DEFAULT 0,
	`rating_count` int NOT NULL DEFAULT 0,
	`view_count` int NOT NULL DEFAULT 0,
	`sales_count` int NOT NULL DEFAULT 0,
	`seo_title` varchar(190),
	`seo_description` varchar(320),
	`published_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`slug` varchar(120) NOT NULL,
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_slug_unq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `variant_option_values` (
	`variant_id` bigint unsigned NOT NULL,
	`option_id` bigint unsigned NOT NULL,
	`option_value_id` bigint unsigned NOT NULL,
	CONSTRAINT `variant_option_unq` UNIQUE(`variant_id`,`option_id`)
);
--> statement-breakpoint
CREATE TABLE `cart_items` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`cart_id` bigint unsigned NOT NULL,
	`variant_id` bigint unsigned NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cart_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `cart_item_unq` UNIQUE(`cart_id`,`variant_id`)
);
--> statement-breakpoint
CREATE TABLE `carts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned,
	`token` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `carts_id` PRIMARY KEY(`id`),
	CONSTRAINT `carts_token_unq` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`order_id` bigint unsigned NOT NULL,
	`variant_id` bigint unsigned NOT NULL,
	`product_id` bigint unsigned NOT NULL,
	`product_name` varchar(190) NOT NULL,
	`product_slug` varchar(190) NOT NULL,
	`variant_label` varchar(190),
	`sku` varchar(64) NOT NULL,
	`image_path` varchar(255),
	`unit_price` bigint unsigned NOT NULL,
	`quantity` int NOT NULL,
	`line_total` bigint unsigned NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`order_number` varchar(32) NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`status` enum('pending','awaiting_payment','payment_verification','paid','processing','shipped','delivered','cancelled','rejected') NOT NULL DEFAULT 'awaiting_payment',
	`payment_status` enum('pending','reference_submitted','approved','rejected','refunded') NOT NULL DEFAULT 'pending',
	`payment_method` varchar(32) NOT NULL,
	`subtotal` bigint unsigned NOT NULL,
	`discount_total` bigint unsigned NOT NULL DEFAULT 0,
	`shipping_total` bigint unsigned NOT NULL DEFAULT 0,
	`grand_total` bigint unsigned NOT NULL,
	`ship_full_name` varchar(120) NOT NULL,
	`ship_phone` varchar(11) NOT NULL,
	`ship_province` varchar(60) NOT NULL,
	`ship_city` varchar(80) NOT NULL,
	`ship_address_line` text NOT NULL,
	`ship_postal_code` varchar(10) NOT NULL,
	`customer_note` text,
	`internal_note` text,
	`paid_at` timestamp,
	`shipped_at` timestamp,
	`delivered_at` timestamp,
	`cancelled_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_number_unq` UNIQUE(`order_number`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`order_id` bigint unsigned NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`method` varchar(32) NOT NULL,
	`status` enum('pending','reference_submitted','approved','rejected','refunded') NOT NULL DEFAULT 'pending',
	`amount` bigint unsigned NOT NULL,
	`reference_code` varchar(64),
	`reference_submitted_at` timestamp,
	`reviewed_by_admin_id` bigint unsigned,
	`reviewed_at` timestamp,
	`admin_note` text,
	`provider_data` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_reference_unq` UNIQUE(`reference_code`)
);
--> statement-breakpoint
CREATE TABLE `blog_categories` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(190) NOT NULL,
	`description` varchar(320),
	CONSTRAINT `blog_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `blog_categories_slug_unq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `blog_posts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`title` varchar(190) NOT NULL,
	`slug` varchar(190) NOT NULL,
	`excerpt` varchar(320),
	`body` text,
	`category_id` bigint unsigned,
	`author_admin_id` bigint unsigned,
	`cover_image_path` varchar(255),
	`cover_image_alt` varchar(255),
	`is_published` boolean NOT NULL DEFAULT false,
	`published_at` timestamp,
	`seo_title` varchar(190),
	`seo_description` varchar(320),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blog_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `blog_posts_slug_unq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `homepage_sections` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`kind` enum('hero','featured_products','categories','new_arrivals','bestsellers','promo_banner','brand_story','reviews','blog_teaser','newsletter') NOT NULL,
	`title` varchar(190),
	`subtitle` varchar(320),
	`image_path` varchar(255),
	`link_url` varchar(255),
	`link_label` varchar(80),
	`config` json,
	`is_visible` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `homepage_sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`slug` varchar(190) NOT NULL,
	`title` varchar(190) NOT NULL,
	`body` text,
	`is_published` boolean NOT NULL DEFAULT true,
	`show_in_footer` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`seo_title` varchar(190),
	`seo_description` varchar(320),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `pages_slug_unq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `review_replies` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`review_id` bigint unsigned NOT NULL,
	`admin_user_id` bigint unsigned NOT NULL,
	`body` text NOT NULL,
	`is_visible` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `review_replies_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_reply_unq` UNIQUE(`review_id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`product_id` bigint unsigned NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`rating` int NOT NULL,
	`title` varchar(160),
	`body` text NOT NULL,
	`status` enum('pending','approved','rejected','hidden') NOT NULL DEFAULT 'pending',
	`is_verified_purchase` boolean NOT NULL DEFAULT false,
	`moderated_by_admin_id` bigint unsigned,
	`moderated_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_user_product_unq` UNIQUE(`user_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`namespace` varchar(40) NOT NULL,
	`key` varchar(80) NOT NULL,
	`value` text,
	`is_secret` boolean NOT NULL DEFAULT false,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `settings_ns_key_unq` UNIQUE(`namespace`,`key`)
);
--> statement-breakpoint
CREATE TABLE `settings_version` (
	`id` int NOT NULL,
	`version` bigint unsigned NOT NULL DEFAULT 1,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_version_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `slug_redirects` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`entity_type` enum('product','category','blog_post','page') NOT NULL,
	`old_slug` varchar(190) NOT NULL,
	`new_slug` varchar(190) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `slug_redirects_id` PRIMARY KEY(`id`),
	CONSTRAINT `slug_redirect_unq` UNIQUE(`entity_type`,`old_slug`)
);
--> statement-breakpoint
CREATE TABLE `sms_messages` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`event` enum('otp_login','order_created','payment_approved','order_shipped') NOT NULL,
	`phone` varchar(11) NOT NULL,
	`payload` json,
	`status` enum('pending','approved','sending','sent','failed','cancelled') NOT NULL DEFAULT 'pending',
	`order_id` bigint unsigned,
	`approved_by_admin_id` bigint unsigned,
	`approved_at` timestamp,
	`attempts` int NOT NULL DEFAULT 0,
	`max_attempts` int NOT NULL DEFAULT 3,
	`provider_message_id` varchar(80),
	`last_error` varchar(255),
	`sent_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sms_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sms_templates` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`event` enum('otp_login','order_created','payment_approved','order_shipped') NOT NULL,
	`name` varchar(120) NOT NULL,
	`provider_template_id` varchar(40),
	`parameters` json,
	`is_enabled` boolean NOT NULL DEFAULT false,
	`requires_approval` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sms_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `sms_templates_event_unq` UNIQUE(`event`)
);
--> statement-breakpoint
ALTER TABLE `addresses` ADD CONSTRAINT `addresses_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_sessions` ADD CONSTRAINT `admin_sessions_admin_user_id_admin_users_id_fk` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_permissions_id_fk` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_categories` ADD CONSTRAINT `product_categories_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_categories` ADD CONSTRAINT `product_categories_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_option_values` ADD CONSTRAINT `product_option_values_option_id_product_options_id_fk` FOREIGN KEY (`option_id`) REFERENCES `product_options`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_options` ADD CONSTRAINT `product_options_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_tags` ADD CONSTRAINT `product_tags_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_tags` ADD CONSTRAINT `product_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `variant_option_values` ADD CONSTRAINT `variant_option_values_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `variant_option_values` ADD CONSTRAINT `variant_option_values_option_id_product_options_id_fk` FOREIGN KEY (`option_id`) REFERENCES `product_options`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `variant_option_values` ADD CONSTRAINT `variant_option_values_value_fk` FOREIGN KEY (`option_value_id`) REFERENCES `product_option_values`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_cart_id_carts_id_fk` FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `carts` ADD CONSTRAINT `carts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD CONSTRAINT `blog_posts_category_id_blog_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `blog_categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_replies` ADD CONSTRAINT `review_replies_review_id_reviews_id_fk` FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_replies` ADD CONSTRAINT `review_replies_admin_user_id_admin_users_id_fk` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `addresses_user_idx` ON `addresses` (`user_id`);--> statement-breakpoint
CREATE INDEX `otp_phone_created_idx` ON `otp_requests` (`phone`,`created_at`);--> statement-breakpoint
CREATE INDEX `otp_expires_idx` ON `otp_requests` (`expires_at`);--> statement-breakpoint
CREATE INDEX `rl_expires_idx` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `users_created_idx` ON `users` (`created_at`);--> statement-breakpoint
CREATE INDEX `users_active_idx` ON `users` (`is_active`);--> statement-breakpoint
CREATE INDEX `admin_sessions_user_idx` ON `admin_sessions` (`admin_user_id`);--> statement-breakpoint
CREATE INDEX `admin_role_idx` ON `admin_users` (`role_id`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_actor_idx` ON `audit_logs` (`actor_id`);--> statement-breakpoint
CREATE INDEX `audit_action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `permissions_group_idx` ON `permissions` (`group_key`);--> statement-breakpoint
CREATE INDEX `role_perm_role_idx` ON `role_permissions` (`role_id`);--> statement-breakpoint
CREATE INDEX `categories_parent_idx` ON `categories` (`parent_id`);--> statement-breakpoint
CREATE INDEX `categories_visible_sort_idx` ON `categories` (`is_visible`,`sort_order`);--> statement-breakpoint
CREATE INDEX `product_category_cat_idx` ON `product_categories` (`category_id`);--> statement-breakpoint
CREATE INDEX `product_images_product_idx` ON `product_images` (`product_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `product_images_primary_idx` ON `product_images` (`product_id`,`is_primary`);--> statement-breakpoint
CREATE INDEX `option_values_option_idx` ON `product_option_values` (`option_id`);--> statement-breakpoint
CREATE INDEX `product_options_product_idx` ON `product_options` (`product_id`);--> statement-breakpoint
CREATE INDEX `product_tag_tag_idx` ON `product_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `variants_product_idx` ON `product_variants` (`product_id`);--> statement-breakpoint
CREATE INDEX `variants_stock_idx` ON `product_variants` (`stock_qty`);--> statement-breakpoint
CREATE INDEX `variants_active_idx` ON `product_variants` (`is_active`);--> statement-breakpoint
CREATE INDEX `products_category_active_idx` ON `products` (`primary_category_id`,`is_active`,`created_at`);--> statement-breakpoint
CREATE INDEX `products_active_created_idx` ON `products` (`is_active`,`created_at`);--> statement-breakpoint
CREATE INDEX `products_featured_idx` ON `products` (`is_featured`,`is_active`);--> statement-breakpoint
CREATE INDEX `products_bestseller_idx` ON `products` (`is_bestseller`,`is_active`);--> statement-breakpoint
CREATE INDEX `products_new_idx` ON `products` (`is_new_arrival`,`is_active`);--> statement-breakpoint
CREATE INDEX `variant_option_value_idx` ON `variant_option_values` (`option_value_id`);--> statement-breakpoint
CREATE INDEX `cart_items_cart_idx` ON `cart_items` (`cart_id`);--> statement-breakpoint
CREATE INDEX `carts_user_idx` ON `carts` (`user_id`);--> statement-breakpoint
CREATE INDEX `carts_updated_idx` ON `carts` (`updated_at`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_items_product_idx` ON `order_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `orders_user_created_idx` ON `orders` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_status_created_idx` ON `orders` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_payment_status_idx` ON `orders` (`payment_status`,`created_at`);--> statement-breakpoint
CREATE INDEX `payments_order_idx` ON `payments` (`order_id`);--> statement-breakpoint
CREATE INDEX `payments_status_created_idx` ON `payments` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `payments_user_idx` ON `payments` (`user_id`);--> statement-breakpoint
CREATE INDEX `blog_published_idx` ON `blog_posts` (`is_published`,`published_at`);--> statement-breakpoint
CREATE INDEX `blog_category_idx` ON `blog_posts` (`category_id`);--> statement-breakpoint
CREATE INDEX `homepage_sections_order_idx` ON `homepage_sections` (`is_visible`,`sort_order`);--> statement-breakpoint
CREATE INDEX `reviews_product_status_idx` ON `reviews` (`product_id`,`status`);--> statement-breakpoint
CREATE INDEX `reviews_status_created_idx` ON `reviews` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `settings_ns_idx` ON `settings` (`namespace`);--> statement-breakpoint
CREATE INDEX `sms_status_created_idx` ON `sms_messages` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `sms_order_idx` ON `sms_messages` (`order_id`);--> statement-breakpoint
CREATE INDEX `sms_event_idx` ON `sms_messages` (`event`);