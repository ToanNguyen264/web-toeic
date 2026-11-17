ALTER TABLE `vocabularies`
  ADD COLUMN `mastery_level` VARCHAR(20) NOT NULL DEFAULT 'unlearned';

UPDATE `vocabularies`
SET `mastery_level` = CASE
  WHEN `is_learned` = true THEN 'mastered'
  ELSE 'unlearned'
END;

CREATE INDEX `vocabularies_user_id_mastery_level_created_at_idx`
  ON `vocabularies` (`user_id`, `mastery_level`, `created_at` DESC);
