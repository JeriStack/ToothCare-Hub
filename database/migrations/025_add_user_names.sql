-- Migration 025: Add first_name and last_name columns to users table
-- Ensures all accounts (including ADMIN and RECEPTIONIST staff) store and expose real names.

ALTER TABLE users
    ADD COLUMN first_name VARCHAR(100) NULL AFTER email,
    ADD COLUMN last_name VARCHAR(100) NULL AFTER first_name;

-- Backfill names from linked patient profiles
UPDATE users u
INNER JOIN patients p ON p.user_id = u.id
SET u.first_name = COALESCE(NULLIF(u.first_name, ''), p.first_name),
    u.last_name = COALESCE(NULLIF(u.last_name, ''), p.last_name)
WHERE u.first_name IS NULL OR u.first_name = '' OR u.last_name IS NULL OR u.last_name = '';

-- Backfill names from linked dentist profiles
UPDATE users u
INNER JOIN dentists d ON d.user_id = u.id
SET u.first_name = COALESCE(NULLIF(u.first_name, ''), d.first_name),
    u.last_name = COALESCE(NULLIF(u.last_name, ''), d.last_name)
WHERE u.first_name IS NULL OR u.first_name = '' OR u.last_name IS NULL OR u.last_name = '';

-- Backfill canonical Administrator and Receptionist accounts
UPDATE users
SET first_name = 'Marco',
    last_name = 'Villanueva'
WHERE email IN ('admin@toothcare.com', 'admin@toothcare.local')
  AND (first_name IS NULL OR first_name = '');

UPDATE users
SET first_name = 'Clarisse',
    last_name = 'Mendoza'
WHERE email IN ('receptionist@toothcare.com', 'receptionist@toothcare.local')
  AND (first_name IS NULL OR first_name = '');
