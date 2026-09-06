-- ─────────────────────────────────────────────────────────────────────────────
-- Customer passwords, OTP purposes, and the wishlist.
--
-- Hand-written rather than drizzle-kit generated, for the same reason as 0001:
-- the character set has to be stated explicitly on the new table, and an
-- ALTER that widens an ENUM is not something a schema differ should be
-- guessing at.
--
-- Every change here is additive and nullable. There is no backfill and no
-- destructive step, so the migration is safe to apply to a populated database
-- and safe to leave in place if the deploy is rolled back — the previous code
-- simply ignores the new columns.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Passwords ───────────────────────────────────────────────────────────────
--
-- NULLABLE, deliberately. Accounts created under the OTP-only flow have no
-- password and must keep working; they sign in by code and can set one later.
-- A NOT NULL column with a default would have meant inventing a credential on
-- a customer's behalf, which is worse than having none.
ALTER TABLE `users`
  ADD COLUMN `password_hash` VARCHAR(255) NULL AFTER `email`,
  ADD COLUMN `password_set_at` TIMESTAMP NULL AFTER `password_hash`;
--> statement-breakpoint

-- 2. OTP purposes ────────────────────────────────────────────────────────────
--
-- A code issued to confirm a registration must not be replayable into a
-- password reset. Widening the ENUM keeps existing 'login' rows valid; the
-- default is unchanged so in-flight codes written by the previous release
-- still verify.
ALTER TABLE `otp_requests`
  MODIFY COLUMN `purpose`
    ENUM('login', 'verify_phone', 'register', 'password_reset')
    NOT NULL DEFAULT 'login';
--> statement-breakpoint

-- 3. Wishlist ────────────────────────────────────────────────────────────────
--
-- The unique index is load-bearing rather than decorative: it is what makes
-- the heart toggle safe under a double-tap or a retried request, with no
-- transaction and no read-then-write race.
CREATE TABLE `wishlist_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `wishlist_items_id` PRIMARY KEY(`id`),
  CONSTRAINT `wishlist_user_product_unq` UNIQUE(`user_id`, `product_id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint

CREATE INDEX `wishlist_user_created_idx` ON `wishlist_items` (`user_id`, `created_at`);
--> statement-breakpoint

-- CASCADE on both sides. A wishlist row is a bookmark, not a record of
-- anything that happened, so it should not outlive either end of it — unlike
-- an order line, which deliberately RESTRICTs deletion of what it references.
ALTER TABLE `wishlist_items`
  ADD CONSTRAINT `wishlist_items_user_fk`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE `wishlist_items`
  ADD CONSTRAINT `wishlist_items_product_fk`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
  ON DELETE CASCADE ON UPDATE NO ACTION;
