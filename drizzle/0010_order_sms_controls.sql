-- Per-template parameter names are stored in the existing JSON column.
ALTER TABLE `sms_templates`
  MODIFY COLUMN `event` ENUM('otp_login','order_created','payment_approved','order_shipped','admin_new_order') NOT NULL;
--> statement-breakpoint
ALTER TABLE `sms_messages`
  MODIFY COLUMN `event` ENUM('otp_login','order_created','payment_approved','order_shipped','admin_new_order') NOT NULL;
--> statement-breakpoint
UPDATE `sms_templates`
SET `parameters` = CASE `event`
  WHEN 'order_created' THEN JSON_OBJECT('ORDER', 'ORDER', 'NAME', 'NAME')
  WHEN 'order_shipped' THEN JSON_OBJECT('ORDER', 'ORDER', 'NAME', 'NAME', 'SHIPMENT', 'SHIPMENT', 'TRACK', 'TRACK')
  WHEN 'payment_approved' THEN JSON_OBJECT('ORDER', 'ORDER')
  WHEN 'otp_login' THEN JSON_OBJECT('CODE', 'CODE')
  ELSE `parameters`
END;
--> statement-breakpoint
INSERT INTO `sms_templates` (`event`, `name`, `parameters`, `is_enabled`, `requires_approval`)
VALUES ('admin_new_order', 'اعلان سفارش جدید برای مدیر', JSON_OBJECT('ORDER', 'ORDER'), 0, 0)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
