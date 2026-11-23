-- Rollback for Migration 033: Legal Documents, User Legal Acceptances, and DRBAC Permissions
-- WARNING: Dropping user_legal_acceptances removes historical acceptance audit evidence.
-- Only execute during non-production rollback or after exporting acceptance records for retention.

DELETE rp
FROM role_permissions rp
JOIN permissions p ON p.id = rp.permission_id
WHERE p.slug IN (
    'legal_documents.view',
    'legal_documents.create',
    'legal_documents.edit',
    'legal_documents.publish',
    'legal_acceptances.view'
);

DELETE FROM permissions
WHERE slug IN (
    'legal_documents.view',
    'legal_documents.create',
    'legal_documents.edit',
    'legal_documents.publish',
    'legal_acceptances.view'
);

DROP TABLE IF EXISTS user_legal_acceptances;
DROP TABLE IF EXISTS legal_documents;
