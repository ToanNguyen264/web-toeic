ALTER TABLE `vocabularies`
  ADD COLUMN `is_learned` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `vocabularies_user_id_is_learned_created_at_idx`
  ON `vocabularies` (`user_id`, `is_learned`, `created_at` DESC);
