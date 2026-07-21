-- Run once against local MySQL 8.x as a privileged user, e.g.:
--   mysql -u root -p < server/src/db/init-local.sql
-- Then: npm run db:migrate

CREATE DATABASE IF NOT EXISTS soccer_predictor
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'soccer'@'%' IDENTIFIED BY 'soccer';
CREATE USER IF NOT EXISTS 'soccer'@'localhost' IDENTIFIED BY 'soccer';

GRANT ALL PRIVILEGES ON soccer_predictor.* TO 'soccer'@'%';
GRANT ALL PRIVILEGES ON soccer_predictor.* TO 'soccer'@'localhost';
FLUSH PRIVILEGES;
