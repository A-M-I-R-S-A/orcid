ALTER TABLE `get_later_carts`
  MODIFY COLUMN `created_by_admin_id` BIGINT UNSIGNED NULL;
--> statement-breakpoint

ALTER TABLE `orders`
  ADD COLUMN `shipment_company` VARCHAR(80) NULL AFTER `ship_postal_code`,
  ADD COLUMN `shipment_tracking_code` VARCHAR(80) NULL AFTER `shipment_company`;
