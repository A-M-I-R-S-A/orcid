-- ─────────────────────────────────────────────────────────────────────────────
-- A feature image on CMS pages.
--
-- Added for the size guide, which is a picture with a page of prose around it
-- rather than prose alone: the product page shows the picture in a dialog and
-- links through to the page for the rest. The alternative was a settings key
-- holding a media path, which would have put file handling into a key/value
-- store that has none, and would have left the guide's image and the guide's
-- words in two different places for an administrator to keep in step.
--
-- Nullable and additive. Every existing page keeps working unchanged, the
-- previous code simply ignores the column, and the migration is safe to leave
-- in place if the deploy is rolled back.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE `pages` ADD COLUMN `image_path` VARCHAR(255) NULL AFTER `body`;
