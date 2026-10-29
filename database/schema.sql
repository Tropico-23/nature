-- Run this SQL on the MySQL server used by ajout.php.
CREATE DATABASE IF NOT EXISTS travail
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE travail;

CREATE TABLE IF NOT EXISTS `1` (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  tele CHAR(8) NOT NULL,
  adres VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inscriptions_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
