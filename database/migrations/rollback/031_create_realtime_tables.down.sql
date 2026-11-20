-- Rollback Migration 031: Remove Phase 14 real-time outbox and connection ticket tables
-- Note: notifications.role ENUM retains RECEPTIONIST if any receptionist rows exist;
-- delete receptionist notifications first if downgrading the ENUM strictly.

DROP TABLE IF EXISTS realtime_outbox;
DROP TABLE IF EXISTS realtime_tickets;
