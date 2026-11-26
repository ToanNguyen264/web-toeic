ALTER TABLE `vocabularies`
  ADD COLUMN `last_reviewed_at` DATETIME(3) NULL,
  ADD COLUMN `review_count` INTEGER UNSIGNED NOT NULL DEFAULT 0;

CREATE INDEX `vocabularies_user_review_priority_idx`
  ON `vocabularies` (`user_id`, `last_reviewed_at` ASC, `created_at` DESC);

CREATE INDEX `vocabularies_user_mastery_review_priority_idx`
  ON `vocabularies` (`user_id`, `mastery_level`, `last_reviewed_at` ASC, `created_at` DESC);
