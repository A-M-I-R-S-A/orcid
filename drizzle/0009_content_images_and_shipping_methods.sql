CREATE TABLE `shipping_methods` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `description` VARCHAR(500) NULL,
  `fee` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `free_threshold` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `is_enabled` ENUM('0','1') NOT NULL DEFAULT '1',
  `is_default` ENUM('0','1') NOT NULL DEFAULT '0',
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `shipping_methods_enabled_sort_idx` (`is_enabled`, `sort_order`),
  KEY `shipping_methods_default_idx` (`is_default`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

INSERT INTO `shipping_methods` (`name`, `description`, `fee`, `free_threshold`, `is_enabled`, `is_default`, `sort_order`)
SELECT 'ارسال استاندارد', NULL,
  COALESCE(CAST((SELECT `value` FROM `settings` WHERE `namespace` = 'shipping' AND `key` = 'shippingFee' LIMIT 1) AS UNSIGNED), 0),
  COALESCE(CAST((SELECT `value` FROM `settings` WHERE `namespace` = 'shipping' AND `key` = 'freeShippingThreshold' LIMIT 1) AS UNSIGNED), 0),
  '1', '1', 0
WHERE NOT EXISTS (SELECT 1 FROM `shipping_methods` LIMIT 1);
--> statement-breakpoint

ALTER TABLE `orders`
  ADD COLUMN `shipping_method_id` BIGINT UNSIGNED NULL AFTER `shipping_total`,
  ADD COLUMN `shipping_method_name` VARCHAR(120) NULL AFTER `shipping_method_id`,
  ADD KEY `orders_shipping_method_idx` (`shipping_method_id`),
  ADD CONSTRAINT `orders_shipping_method_fk` FOREIGN KEY (`shipping_method_id`) REFERENCES `shipping_methods` (`id`) ON DELETE SET NULL;
