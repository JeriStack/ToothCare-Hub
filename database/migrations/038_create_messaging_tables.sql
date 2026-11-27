-- Migration 038: Patient-Dentist Messaging System & DRBAC Permissions
-- Supports Messenger-style 1-to-1 conversations, cursor-paginated messages,
-- idempotent delivery/read receipts, archive retention preservation, and strict RBAC.

CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    patient_id BIGINT UNSIGNED NOT NULL,
    dentist_id BIGINT UNSIGNED NOT NULL,
    appointment_id BIGINT UNSIGNED NULL,
    status ENUM('ACTIVE', 'ARCHIVED', 'UNAVAILABLE') NOT NULL DEFAULT 'ACTIVE',
    last_message_id BIGINT UNSIGNED NULL,
    last_message_at DATETIME NULL,
    last_message_preview VARCHAR(160) NULL,
    last_message_sender_user_id BIGINT UNSIGNED NULL,
    patient_unread_count INT UNSIGNED NOT NULL DEFAULT 0,
    dentist_unread_count INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_conversations_patient_dentist UNIQUE (patient_id, dentist_id),
    CONSTRAINT fk_conversations_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_conversations_dentist FOREIGN KEY (dentist_id) REFERENCES dentists(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_conversations_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_conversations_last_sender FOREIGN KEY (last_message_sender_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_conversations_patient_activity (patient_id, last_message_at, id),
    INDEX idx_conversations_dentist_activity (dentist_id, last_message_at, id),
    INDEX idx_conversations_appointment (appointment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation_messages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT UNSIGNED NOT NULL,
    sender_user_id BIGINT UNSIGNED NOT NULL,
    sender_role ENUM('PATIENT', 'DENTIST') NOT NULL,
    client_message_id VARCHAR(64) NULL,
    body TEXT NOT NULL,
    appointment_id BIGINT UNSIGNED NULL,
    delivered_at DATETIME NULL,
    read_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_conv_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_conv_messages_sender FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_conv_messages_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT uq_conv_messages_client_id UNIQUE (conversation_id, sender_user_id, client_message_id),
    INDEX idx_conv_messages_cursor (conversation_id, id),
    INDEX idx_conv_messages_unread (conversation_id, sender_user_id, read_at),
    INDEX idx_conv_messages_delivered (conversation_id, sender_user_id, delivered_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Granular DRBAC permissions strictly for authorized Patient-Dentist messaging
INSERT INTO permissions (name, slug, module, description) VALUES
('View Direct Messages', 'messages.view', 'messages', 'Access own Patient-Dentist direct message conversations and history'),
('Send Direct Messages', 'messages.send', 'messages', 'Send direct messages and read/typing updates in own Patient-Dentist conversations')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    module = VALUES(module),
    description = VALUES(description);

-- Grant strictly to Patient and Dentist roles (never Admin or Receptionist by default to protect private chat privacy)
INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
JOIN permissions p ON p.slug IN ('messages.view', 'messages.send')
WHERE r.slug IN ('patient', 'dentist')
ON DUPLICATE KEY UPDATE role_id = role_permissions.role_id;
