CREATE TABLE `app_settings` (
  `key` VARCHAR(100) NOT NULL,
  `encrypted_value` TEXT NOT NULL,
  `iv` VARCHAR(32) NOT NULL,
  `auth_tag` VARCHAR(32) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
