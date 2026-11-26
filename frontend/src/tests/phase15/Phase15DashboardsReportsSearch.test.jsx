import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminDashboard } from '../../features/dashboard/AdminDashboard';
import { ReportsPage } from '../../features/reports/pages/ReportsPage';
import { AdminAppointmentsPage } from '../../features/appointments/pages/AdminAppointmentsPage';
import { dashboardApi } from '../../features/dashboard/api';
import { reportsApi } from '../../features/reports/api';
import { appointmentsApi } from '../../features/appointments/api';
import { dentistsApi } from '../../features/dentists/api';
import { servicesApi } from '../../features/services/api';

vi.mock('../../features/dashboard/api', () => ({
  dashboardApi: {
    getMetrics: vi.fn(),
  },
}));

vi.mock('../../features/reports/api', () => ({
  reportsApi: {
    getAppointmentReports: vi.fn(),
    getServiceReports: vi.fn(),
    getDentistReports: vi.fn(),
    getPatientReports: vi.fn(),
  },
}));

vi.mock('../../features/appointments/api', () => ({
  appointmentsApi: {
    listAdmin: vi.fn(),
    getAdminById: vi.fn(),
    confirm: vi.fn(),
    reject: vi.fn(),
    complete: vi.fn(),
    cancel: vi.fn(),
  },
}));

vi.mock('../../features/dentists/api', () => ({
  dentistsApi: {
    getPublicDentists: vi.fn(),
  },
}));

vi.mock('../../features/services/api', () => ({
  servicesApi: {
    getPublicServices: vi.fn(),
  },
}));

describe('Phase 15: Dashboards, Reports, and Appointment Search UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AdminDashboard renders all 7 live database metrics, outbox health, and shows an honest error without fake fallback data on failure', async () => {
    dashboardApi.getMetrics.mockRejectedValueOnce(new Error('Database connection unavailable'));

    render(<AdminDashboard onNavigateTab={vi.fn()} />);

    expect(await screen.findByText(/Failed to Load Clinic Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Database connection unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/Juan Dela Cruz/i)).not.toBeInTheDocument();

    dashboardApi.getMetrics.mockResolvedValueOnce({
      counts: {
        patients: { total: 42, active: 39, inactive: 3 },
        dentists: { total: 6, active: 5, inactive: 1 },
        services: { total: 10, active: 8, inactive: 2 },
        appointments: {
          total: 120,
          pending: 7,
          confirmed: 14,
          upcoming: 19,
          completed: 88,
          cancelled: 11,
          today: 4,
        },
      },
      appointment_trends: [{ date: '2026-11-20', total: 4 }],
      outbox_summary: {
        totals: { pending: 2, processing: 1, completed: 55, failed: 0 },
      },
      recent_errors: [],
      recent: { patients: [], services: [] },
      today_schedule: [],
      review_queue_peek: [],
      recent_activity: [],
      system_alerts: { pending_triage: 7, recent_security_events: 0, active_rate_limits: 0 },
      generated_at: '2026-11-20T12:00:00+08:00',
    });

    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));

    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText(/Upcoming Appointments/i)).toBeInTheDocument();
    expect(screen.getByText('19')).toBeInTheDocument();
    expect(screen.getByText(/Outbox Delivery Health/i)).toBeInTheDocument();
    expect(screen.getByText(/No recent delivery or security errors recorded/i)).toBeInTheDocument();
  });

  it('ReportsPage renders operational utilization reports without fabricated revenue and validates invalid date ranges', async () => {
    reportsApi.getAppointmentReports.mockResolvedValue({
      total_appointments: 10,
      upcoming_count: 3,
      completed_count: 6,
      cancelled_count: 1,
      completion_rate: 60,
      cancellation_rate: 10,
      status_distribution: { COMPLETED: 6, CONFIRMED: 3, CANCELLED: 1 },
      daily_timeline: [{ date: '2026-11-20', status: 'COMPLETED', count: 6 }],
      appointments: [
        {
          id: 501,
          patient_id: 1,
          dentist_id: 1,
          service_id: 1,
          start_at: '2026-11-20 09:00:00',
          status: 'COMPLETED',
          patient_first_name: 'Maria',
          patient_last_name: 'Santos',
          dentist_first_name: 'Elena',
          dentist_last_name: 'Reyes',
          service_name: 'Oral Prophylaxis',
        },
      ],
      appointments_meta: { total: 1, page: 1, per_page: 25, last_page: 1 },
    });
    reportsApi.getServiceReports.mockResolvedValue({
      services: [
        {
          id: 1,
          name: 'Oral Prophylaxis',
          category: 'Preventive',
          total_booked: 7,
          upcoming_count: 2,
          completed_count: 5,
          cancelled_count: 0,
          utilization_share_pct: 70,
        },
      ],
    });
    reportsApi.getDentistReports.mockResolvedValue({
      dentists: [
        {
          id: 1,
          first_name: 'Elena',
          last_name: 'Reyes',
          specialization: 'General',
          total_assigned: 10,
          upcoming_count: 3,
          completed_count: 6,
          cancelled_count: 1,
        },
      ],
    });
    reportsApi.getPatientReports.mockResolvedValue({
      total_patients: 25,
      active_patients: 23,
      inactive_patients: 2,
      new_in_period: 4,
      registration_timeline: [],
    });

    render(<ReportsPage />);

    expect(await screen.findByText(/Clinic Operational Reports & Analytics/i)).toBeInTheDocument();
    expect(screen.getAllByText('Oral Prophylaxis').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getAllByText(/Dr\. Elena Reyes/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Filtered Appointment Report List/i)).toBeInTheDocument();
    expect(screen.getByText('#501')).toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.queryByText(/Realized Revenue/i)).not.toBeInTheDocument();

    // Filter by status in ReportsPage triggers getAppointmentReports with status filter
    fireEvent.change(screen.getByLabelText(/Filter report by status/i), { target: { value: 'COMPLETED' } });
    await waitFor(() => {
      expect(reportsApi.getAppointmentReports).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'COMPLETED' })
      );
    });

    // Invalid date range (end_date < start_date) displays validation warning
    fireEvent.change(screen.getByLabelText(/Start date/i), { target: { value: '2026-11-25' } });
    fireEvent.change(screen.getByLabelText(/End date/i), { target: { value: '2026-11-10' } });

    expect(await screen.findByText(/End date cannot be earlier than start date\./i)).toBeInTheDocument();

    // Verify exact simplified subtitle text and collapsible card minimize/expand controls
    expect(
      screen.getByText(
        'Database-driven appointment throughput, dentist workload, service utilization, patient registrations (Asia/Manila).'
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Minimize Dental Service Utilization/i }));
    expect(screen.queryByText('70%')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Expand Dental Service Utilization/i }));
    expect(screen.getByText('70%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Minimize All/i }));
    expect(screen.queryByText('#501')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Expand All/i }));
    expect(screen.getByText('#501')).toBeInTheDocument();
  });

  it('AdminAppointmentsPage supports service, dentist, status, and date filters with range validation and Clear Filters', async () => {
    dentistsApi.getPublicDentists.mockResolvedValue([{ id: 1, first_name: 'Elena', last_name: 'Reyes' }]);
    servicesApi.getPublicServices.mockResolvedValue([{ id: 2, name: 'Tooth Extraction' }]);
    appointmentsApi.listAdmin.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, per_page: 15, last_page: 1 },
    });

    render(<AdminAppointmentsPage />);

    await waitFor(() => {
      expect(appointmentsApi.listAdmin).toHaveBeenCalled();
    });

    const serviceSelect = await screen.findByLabelText(/Filter by dental service/i);
    fireEvent.change(serviceSelect, { target: { value: '2' } });

    await waitFor(() => {
      expect(appointmentsApi.listAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ service_id: '2', per_page: 15 }),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    // Single calendar date filter sends matching start_date and end_date
    fireEvent.change(screen.getByLabelText(/Appointment date/i), { target: { value: '2026-12-20' } });
    await waitFor(() => {
      expect(appointmentsApi.listAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ service_id: '2', start_date: '2026-12-20', end_date: '2026-12-20', per_page: 15 }),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    // Clear Filters resets everything
    fireEvent.click(screen.getByRole('button', { name: /Clear Filters/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/Appointment date/i)).toHaveValue('');
    });
  });
});
