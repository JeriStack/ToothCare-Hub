-- Migration 034: Composite indexes for unbounded pending scheduling conflict counting
-- and cross-dentist operatory room conflict lookups.

-- Accelerates keyset-paginated streaming over all PENDING appointments (WHERE status = 'PENDING' AND id > ? ORDER BY id ASC)
CREATE INDEX idx_appointments_status_id ON appointments (status, id);

-- Accelerates cross-dentist operatory chair/room overlap queries
CREATE INDEX idx_appointments_room_overlap ON appointments (operatory_chair, status, start_at, end_at);
