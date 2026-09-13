CREATE TABLE `option_definitions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(60) NOT NULL,
  `kind` ENUM('size','color','other') NOT NULL DEFAULT 'other',
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `option_definitions_name_kind_unq` (`name`,`kind`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `option_definition_values` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `definition_id` BIGINT UNSIGNED NOT NULL,
  `value` VARCHAR(80) NOT NULL,
  `swatch_hex` VARCHAR(7) NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `option_definition_value_unq` (`definition_id`,`value`),
  CONSTRAINT `option_definition_values_definition_fk` FOREIGN KEY (`definition_id`) REFERENCES `option_definitions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `product_options`
  ADD COLUMN `definition_id` BIGINT UNSIGNED NULL AFTER `product_id`,
  ADD COLUMN `note` VARCHAR(500) NULL AFTER `kind`,
  ADD KEY `product_options_definition_idx` (`product_id`,`definition_id`),
  ADD CONSTRAINT `product_options_definition_fk` FOREIGN KEY (`definition_id`) REFERENCES `option_definitions` (`id`) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE `product_option_values`
  ADD COLUMN `definition_value_id` BIGINT UNSIGNED NULL AFTER `option_id`,
  ADD CONSTRAINT `product_option_values_definition_value_fk` FOREIGN KEY (`definition_value_id`) REFERENCES `option_definition_values` (`id`) ON DELETE RESTRICT;
--> statement-breakpoint
INSERT INTO `option_definitions` (`name`,`kind`,`sort_order`)
SELECT `name`,`kind`,MIN(`sort_order`) FROM `product_options` GROUP BY `name`,`kind`;
--> statement-breakpoint
UPDATE `product_options` po JOIN `option_definitions` od ON od.name=po.name AND od.kind=po.kind SET po.definition_id=od.id;
--> statement-breakpoint
INSERT INTO `option_definition_values` (`definition_id`,`value`,`swatch_hex`,`sort_order`)
SELECT po.definition_id,pov.value,MAX(pov.swatch_hex),MIN(pov.sort_order)
FROM `product_option_values` pov JOIN `product_options` po ON po.id=pov.option_id
WHERE po.definition_id IS NOT NULL GROUP BY po.definition_id,pov.value;
--> statement-breakpoint
UPDATE `product_option_values` pov
JOIN `product_options` po ON po.id=pov.option_id
JOIN `option_definition_values` odv ON odv.definition_id=po.definition_id AND odv.value=pov.value
SET pov.definition_value_id=odv.id;
