ALTER TABLE `vocabularies`
  ADD COLUMN `word_meaning_audio_path` VARCHAR(500) NULL,
  ADD COLUMN `word_meaning_audio_name` VARCHAR(255) NULL,
  ADD COLUMN `word_meaning_audio_type` VARCHAR(100) NULL,
  ADD COLUMN `word_meaning_audio_size` BIGINT UNSIGNED NULL;
