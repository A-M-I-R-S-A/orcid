ALTER TABLE `get_later_carts`
  ADD COLUMN `active_user_id` BIGINT UNSIGNED NULL AFTER `user_id`,
  ADD UNIQUE KEY `get_later_active_user_unq` (`active_user_id`),
  ADD CONSTRAINT `get_later_active_user_fk`
    FOREIGN KEY (`active_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT;
--> statement-breakpoint
UPDATE `get_later_carts`
SET `active_user_id` = `user_id`
WHERE `status` IN ('draft', 'open');
