CREATE TABLE IF NOT EXISTS schema_migrations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_schema_migrations_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  screen_name VARCHAR(100) NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  roles JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_screen_name (screen_name),
  CONSTRAINT chk_users_roles_is_array CHECK (JSON_TYPE(roles) = 'ARRAY')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fantasy leagues. Commissioners own a league and can tune scoring later.
CREATE TABLE IF NOT EXISTS leagues (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description VARCHAR(500) NULL,
  commissioner_user_id INT UNSIGNED NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leagues_slug (slug),
  KEY idx_leagues_commissioner (commissioner_user_id),
  CONSTRAINT fk_leagues_commissioner
    FOREIGN KEY (commissioner_user_id) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS league_members (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  league_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  member_role ENUM('commissioner', 'member') NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_league_members_league_user (league_id, user_id),
  KEY idx_league_members_user (user_id),
  CONSTRAINT fk_league_members_league
    FOREIGN KEY (league_id) REFERENCES leagues (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_league_members_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Commissioner-tunable scoring knobs (exact score, outcome, etc.).
CREATE TABLE IF NOT EXISTS league_scoring_rules (
  league_id INT UNSIGNED NOT NULL,
  points_exact_score SMALLINT NOT NULL DEFAULT 5,
  points_correct_outcome SMALLINT NOT NULL DEFAULT 2,
  points_correct_home_goals SMALLINT NOT NULL DEFAULT 0,
  points_correct_away_goals SMALLINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (league_id),
  CONSTRAINT fk_league_scoring_rules_league
    FOREIGN KEY (league_id) REFERENCES leagues (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per-user score picks for an external fixture (football-data.org match id).
CREATE TABLE IF NOT EXISTS match_predictions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  league_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  external_match_id INT NOT NULL,
  competition_code VARCHAR(16) NOT NULL DEFAULT 'WC',
  home_team_name VARCHAR(120) NOT NULL,
  away_team_name VARCHAR(120) NOT NULL,
  match_kickoff_at DATETIME NULL,
  predicted_home_score TINYINT UNSIGNED NOT NULL,
  predicted_away_score TINYINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_match_predictions_league_user_match (league_id, user_id, external_match_id),
  KEY idx_match_predictions_user (user_id),
  KEY idx_match_predictions_match (external_match_id),
  CONSTRAINT fk_match_predictions_league
    FOREIGN KEY (league_id) REFERENCES leagues (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_match_predictions_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
