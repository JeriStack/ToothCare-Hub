import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HistoryRecordsPage } from '../../features/history/pages/HistoryRecordsPage';
import { historyApi } from '../../features/history/api';

vi.mock('../../features/history/api', () => ({
  historyApi: {
    list: vi.fn(),
    getSummary: vi.fn(),
    getDetail: vi.fn(),
    getPatientTimeline: vi.fn(),
    getDentistTimeline: vi.fn(),
    getStaffTimeline: vi.fn(),
    getAppointmentTimeline: vi.fn(),
  },
}));

describe('HistoryRecordsPage (Phase 3 Centralized History Records)', () => {
  const sampleEvent = {
    id: 42,
    source: 'audit_log',
    event_ref: 'HIS-000042',
    actor_user_id: 7,
    actor_name: 'Bianca Soriano',
    actor_email: 'bianca@toothcare.example',
    actor_role: 'RECEPTIONIST',
    actor_is_active: false,
    action: 'APPOINTMENT_RESCHEDULED',
    action_label: 'Appointment Rescheduled',
    module: 'appointments',
    category: 'APPOINTMENT',
    affected_record: { type: 'appointment', id: 501, reference: 'APPOINTMENT #501' },
    result: 'SUCCESS',
    reason: 'Patient requested afternoon chair slot.',
    changes: [
      { field: 'start_at', before: '2026-11-01 09:00:00', after: '2026-11-02 14:00:00' },
      { field: 'dentist_id', before: 1, after: 2 },
    ],
    created_at: '2026-11-02 09:15:00',
    timestamp_manila: '2026-11-02 09:15:00 AM PHT',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    historyApi.getSummary.mockResolvedValue({
      total_activities: 105,
      patient_activities: 20,
      staff_activities: 30,
      appointment_activities: 30,
      security_activities: 10,
      administrative_activities: 15,
      timezone: 'Asia/Manila',
    });
    historyApi.list.mockResolvedValue({
      data: [sampleEvent],
      meta: {
        total: 1,
        total_records: 105,
        filtered_records: 1,
        page: 1,
        current_page: 1,
        per_page: 10,
        last_page: 1,
        total_pages: 1,
      },
    });
    historyApi.getDetail.mockResolvedValue({
      ...sampleEvent,
      payload: { reason: sampleEvent.reason, password: '[REDACTED]' },
    });
    historyApi.getAppointmentTimeline.mockResolvedValue({
      subject: { entity_type: 'appointment', entity_id: 501, reference: 'APT-000501' },
      events: [sampleEvent],
      total_events: 1,
    });
  });

  it('renders 6 database-backed KPI cards, archived-actor badge, Before->After diff modal, and individual record timeline', async () => {
    render(<HistoryRecordsPage />);

    expect(screen.getByText('History Records')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('105')).toBeInTheDocument();
      expect(screen.getByText('HIS-000042')).toBeInTheDocument();
      expect(screen.getByText('Bianca Soriano')).toBeInTheDocument();
      expect(screen.getByText('Archived Actor')).toBeInTheDocument();
    });

    // Clicking Security KPI triggers server-side category filter
    fireEvent.click(screen.getByRole('button', { name: /Security Events/i }));
    await waitFor(() => {
      expect(historyApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'SECURITY' }),
        expect.any(Object)
      );
    });

    // Inspecting event opens Previous vs. Updated Values diff modal
    fireEvent.click(screen.getByRole('button', { name: 'View details for HIS-000042' }));
    await waitFor(() => {
      expect(screen.getByText('Previous vs. Updated Values')).toBeInTheDocument();
      expect(screen.getByText('2026-11-01 09:00:00')).toBeInTheDocument();
      expect(screen.getByText('2026-11-02 14:00:00')).toBeInTheDocument();
    });

    // Opening full record timeline invokes appointment timeline endpoint
    fireEvent.click(screen.getByRole('button', { name: /Open Full Record Timeline/i }));
    await waitFor(() => {
      expect(historyApi.getAppointmentTimeline).toHaveBeenCalledWith(501);
      expect(screen.getByText('APT-000501')).toBeInTheDocument();
    });
  });
});
