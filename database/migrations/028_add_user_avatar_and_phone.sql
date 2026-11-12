-- Migration 028: Add avatar storage metadata and phone to users table
-- Enables staff and account holders to maintain profile pictures and direct contact numbers.

ALTER TABLE users
    ADD COLUMN phone VARCHAR(50) NULL AFTER last_name,
    ADD COLUMN avatar_path VARCHAR(255) NULL AFTER phone,
    ADD COLUMN avatar_mime VARCHAR(64) NULL AFTER avatar_path,
    ADD COLUMN avatar_updated_at DATETIME NULL AFTER avatar_mime;

-- Backfill phone for canonical receptionist and administrator accounts
UPDATE users
SET phone = '+63 917 800 1234'
WHERE email IN ('receptionist@toothcare.com', 'receptionist@toothcare.local')
  AND (phone IS NULL OR phone = '');

UPDATE users
SET phone = '+63 917 800 5678'
WHERE email IN ('admin@toothcare.com', 'admin@toothcare.local')
  AND (phone IS NULL OR phone = '');

-- Sync phone from patients table where available
UPDATE users u
INNER JOIN patients p ON p.user_id = u.id
SET u.phone = COALESCE(NULLIF(u.phone, ''), p.phone)
WHERE (u.phone IS NULL OR u.phone = '') AND p.phone IS NOT NULL AND p.phone != '';

-- Sync phone from dentists table where available
UPDATE users u
INNER JOIN dentists d ON d.user_id = u.id
SET u.phone = COALESCE(NULLIF(u.phone, ''), d.phone)
WHERE (u.phone IS NULL OR u.phone = '') AND d.phone IS NOT NULL AND d.phone != '';
