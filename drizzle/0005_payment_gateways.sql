ALTER TABLE `payments` MODIFY COLUMN `reference_code` VARCHAR(191) NULL;
--> statement-breakpoint
CREATE TABLE `payment_gateway_attempts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_id` BIGINT UNSIGNED NOT NULL,
  `provider` VARCHAR(32) NOT NULL,
  `amount_rial` BIGINT UNSIGNED NOT NULL,
  `state` VARCHAR(64) NOT NULL,
  `token` VARCHAR(1000) NULL,
  `redirect_url` TEXT NULL,
  `reference` VARCHAR(191) NULL,
  `status` ENUM('creating','pending','review','paid','failed') NOT NULL DEFAULT 'creating',
  `locked_until` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payment_gateway_attempts_payment_unq` (`payment_id`),
  UNIQUE KEY `payment_gateway_attempts_state_unq` (`state`),
  UNIQUE KEY `payment_gateway_attempts_reference_unq` (`provider`, `reference`),
  KEY `payment_gateway_attempts_status_idx` (`status`, `updated_at`),
  CONSTRAINT `payment_gateway_attempts_payment_fk`
    FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
