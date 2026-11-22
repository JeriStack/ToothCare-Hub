-- ToothCare Hub — Least-Privilege MySQL Exporter Account (Phase 19)
-- Execute manually on staging/production MySQL 8.0 with a strong generated password.
-- Never commit real credentials; set MYSQL_EXPORTER_USER and MYSQL_EXPORTER_PASSWORD via protected env/secrets.

CREATE USER IF NOT EXISTS 'toothcare_exporter'@'%' IDENTIFIED BY 'CHANGE_ME_STRONG_EXPORTER_PASSWORD' WITH MAX_USER_CONNECTIONS 3;
GRANT PROCESS, REPLICATION CLIENT ON *.* TO 'toothcare_exporter'@'%';
GRANT SELECT ON performance_schema.* TO 'toothcare_exporter'@'%';
FLUSH PRIVILEGES;
