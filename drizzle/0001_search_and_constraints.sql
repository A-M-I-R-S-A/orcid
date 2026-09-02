-- ─────────────────────────────────────────────────────────────────────────────
-- Hand-written migration.
--
-- drizzle-kit cannot emit any of the following, and all three are load-bearing:
--
--   1. utf8mb4 character set — Persian text is multi-byte, and a table that
--      lands on latin1 (still the default on some managed MariaDB builds)
--      silently mangles every product name. Cheap here because the tables are
--      empty; expensive and disruptive later.
--
--   2. FULLTEXT index on products.search_text — the index behind Persian
--      product search. Without it, MATCH ... AGAINST fails outright rather
--      than degrading. Planning package §D-2.
--
--   3. CHECK (stock_qty >= 0) — the database's own guarantee against
--      overselling. The checkout transaction takes row locks and re-checks
--      stock, but this constraint is what makes the guarantee hold even if
--      that logic is ever wrong. §35.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Character set ───────────────────────────────────────────────────────────
ALTER TABLE `users` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `addresses` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `admin_users` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `roles` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `permissions` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `audit_logs` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `categories` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `products` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `product_options` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `product_option_values` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `product_variants` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `product_images` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `tags` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `orders` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `order_items` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `payments` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `reviews` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `review_replies` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `sms_templates` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `sms_messages` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `pages` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `homepage_sections` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `blog_posts` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `blog_categories` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `settings` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `slug_redirects` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint

-- 2. Persian search index ────────────────────────────────────────────────────
-- search_text holds the output of normalizePersian(): Arabic Yeh/Kaf folded,
-- ZWNJ collapsed to spaces, digits mapped to ASCII. The application normalises
-- the incoming query with the SAME function, so the index and the query cannot
-- drift apart.
--
-- NOTE: InnoDB ignores tokens shorter than innodb_ft_min_token_size (default 3),
-- which is usually not tunable on shared hosting. The application detects short
-- tokens and falls back to a LIKE scan against this same column, so short
-- Persian queries still return results.
ALTER TABLE `products` ADD FULLTEXT INDEX `ft_products_search` (`search_text`);
--> statement-breakpoint

-- 3. Inventory floor ─────────────────────────────────────────────────────────
-- MariaDB 10.2+ / MySQL 8.0.16+ enforce CHECK. On an older server this
-- statement fails and the migration stops — which is the correct outcome: the
-- overselling guarantee would otherwise be silently absent.
ALTER TABLE `product_variants`
  ADD CONSTRAINT `chk_variant_stock_non_negative` CHECK (`stock_qty` >= 0);
--> statement-breakpoint

ALTER TABLE `order_items`
  ADD CONSTRAINT `chk_order_item_quantity_positive` CHECK (`quantity` > 0);
--> statement-breakpoint

ALTER TABLE `cart_items`
  ADD CONSTRAINT `chk_cart_item_quantity_positive` CHECK (`quantity` > 0);
--> statement-breakpoint

ALTER TABLE `reviews`
  ADD CONSTRAINT `chk_review_rating_range` CHECK (`rating` BETWEEN 1 AND 5);
