ALTER TABLE `vocabularies`
  ADD COLUMN `example_english` VARCHAR(500) NULL,
  ADD COLUMN `example_vietnamese` VARCHAR(1000) NULL,
  ADD COLUMN `example_audio_path` VARCHAR(500) NULL,
  ADD COLUMN `example_audio_name` VARCHAR(255) NULL,
  ADD COLUMN `example_audio_type` VARCHAR(100) NULL,
  ADD COLUMN `example_audio_size` BIGINT UNSIGNED NULL;
