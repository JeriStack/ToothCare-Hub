-- Rollback Migration 034: Remove composite indexes added for scheduling conflict counting

DROP INDEX idx_appointments_room_overlap ON appointments;
DROP INDEX idx_appointments_status_id ON appointments;
