import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useServerTable } from '../../hooks/useServerTable';
import { SortableColumnHeader, ServerTableFooter } from '../../components/ui/ServerTableControls';
import { AdminAppointmentsPage } from '../../features/appointments/pages/AdminAppointmentsPage';
import { appointmentsApi } from '../../features/appointments/api';
import { dentistsApi } from '../../features/dentists/api';
import { servicesApi } from '../../features/services/api';

vi.mock('../../features/appointments/api', () => ({
  appointmentsApi: {
    listAdmin: vi.fn(),
    getAdminDetails: vi.fn(),
    checkAvailability: vi.fn(),
    confirm: vi.fn(),
    reject: vi.fn(),
    complete: vi.fn(),
    cancel: vi.fn(),
    reschedule: vi.fn(),
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

vi.mock('../../features/realtime/hooks/useDashboardSync', () => ({
  useDashboardSync: vi.fn(),
}));

function HookHarness({ fetcher, debounceMs = 300 }) {
  const table = useServerTable({
    fetcher,
    initialPerPage: 25,
    initialSortBy: 'created_at',
    initialSortDir: 'desc',
    initialFilters: { status: '' },
    debounceMs,
  });

  return (
    <div>
      <input
        aria-label="Search records"
        value={table.search}
        onChange={(e) => table.setSearch(e.target.value)}
      />
      <select
        aria-label="Status filter"
        value={table.filters.status}
        onChange={(e) => table.setFilter('status', e.target.value)}
      >
        <option value="">All</option>
        <option value="CONFIRMED">Confirmed</option>
      </select>
      <button type="button" onClick={() => table.refresh()}>
        Refresh
      </button>
      <button type="button" onClick={() => table.resetFilters()}>
        Reset
      </button>

      {table.error && <div role="alert">{table.error}</div>}
      {table.loading && <div>Loading rows...</div>}

      <table>
        <thead>
          <tr>
            <SortableColumnHeader
              columnKey="patient_name"
              label="Patient"
              activeSortBy={table.sortBy}
              activeSortDir={table.sortDir}
              onSort={table.toggleSort}
            />
          </tr>
        </thead>
        <tbody>
          {table.items.map((row) => (
            <tr key={row.id}>
              <td>{row.label}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ServerTableFooter
        page={table.meta.current_page}
        perPage={table.meta.per_page}
        totalRecords={table.meta.total_records}
        filteredRecords={table.meta.filtered_records}
        totalPages={table.meta.total_pages}
        onPageChange={table.setPage}
        onPerPageChange={table.setPerPage}
        loading={table.loading}
        itemLabel="records"
      />
    </div>
  );
}

describe('Server-Side Data Table Architecture (useServerTable + Controls + AdminAppointmentsPage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dentistsApi.getPublicDentists.mockResolvedValue([]);
    servicesApi.getPublicServices.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces search input (300ms), resets to page 1, and triggers immediate pagination & sorting', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue({
      data: [{ id: 1, label: 'Maria Santos' }],
      meta: {
        total: 40,
        total_records: 100,
        filtered_records: 40,
        page: 1,
        current_page: 1,
        per_page: 25,
        last_page: 2,
        total_pages: 2,
      },
    });

    render(<HookHarness fetcher={fetcher} debounceMs={300} />);

    // Initial load runs immediately
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenLastCalledWith(
      { page: 1, per_page: 25, sort_by: 'created_at', sort_dir: 'desc' },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Navigate to Page 2 immediately (no debounce)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Next page/i }));
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith(
      { page: 2, per_page: 25, sort_by: 'created_at', sort_dir: 'desc' },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    // Rapid typing only emits one debounced search after 300ms and resets page back to 1
    const searchBox = screen.getByLabelText('Search records');
    fireEvent.change(searchBox, { target: { value: 'M' } });
    fireEvent.change(searchBox, { target: { value: 'Ma' } });
    fireEvent.change(searchBox, { target: { value: 'Maria' } });

    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(60);
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher).toHaveBeenLastCalledWith(
      { page: 1, per_page: 25, sort_by: 'created_at', sort_dir: 'desc', search: 'Maria' },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    // Sorting toggles immediately asc -> desc
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Patient' }));
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(fetcher).toHaveBeenLastCalledWith(
      { page: 1, per_page: 25, sort_by: 'patient_name', sort_dir: 'asc', search: 'Maria' },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Patient' }));
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(fetcher).toHaveBeenLastCalledWith(
      { page: 1, per_page: 25, sort_by: 'patient_name', sort_dir: 'desc', search: 'Maria' },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    // Page-size change triggers immediate request and resets to page 1
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '50' } });
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(6);
    expect(fetcher).toHaveBeenLastCalledWith(
      { page: 1, per_page: 50, sort_by: 'patient_name', sort_dir: 'desc', search: 'Maria' },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('aborts superseded requests and ignores out-of-order stale responses', async () => {
    const signals = [];
    const resolvers = [];
    const fetcher = vi.fn((_params, options) => {
      signals.push(options.signal);
      return new Promise((resolve) => {
        resolvers.push(resolve);
      });
    });

    render(<HookHarness fetcher={fetcher} />);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(signals[0].aborted).toBe(false);

    // Apply a filter before the first request finishes -> aborts request #1
    fireEvent.change(screen.getByLabelText('Status filter'), { target: { value: 'CONFIRMED' } });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);

    // Newer response (#2) resolves FIRST
    await act(async () => {
      resolvers[1]({
        data: [{ id: 2, label: 'Fresh Confirmed Record' }],
        meta: { total: 1, total_records: 50, filtered_records: 1, current_page: 1, per_page: 25, total_pages: 1 },
      });
    });
    expect(screen.getByText('Fresh Confirmed Record')).toBeInTheDocument();

    // Older stale response (#1) resolves AFTERWARD — must NOT overwrite newer rows
    await act(async () => {
      resolvers[0]({
        data: [{ id: 1, label: 'Stale Old Record' }],
        meta: { total: 50, total_records: 50, filtered_records: 50, current_page: 1, per_page: 25, total_pages: 2 },
      });
    });
    expect(screen.getByText('Fresh Confirmed Record')).toBeInTheDocument();
    expect(screen.queryByText('Stale Old Record')).not.toBeInTheDocument();
  });

  it('surfaces error states and recovers cleanly on manual refresh', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('Database timeout'))
      .mockResolvedValueOnce({
        data: [{ id: 9, label: 'Recovered Record' }],
        meta: { total: 1, total_records: 10, filtered_records: 1, current_page: 1, per_page: 25, total_pages: 1 },
      });

    render(<HookHarness fetcher={fetcher} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Database timeout');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => {
      expect(screen.getByText('Recovered Record')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('AdminAppointmentsPage wires sortable headers, page-size selector, and filtered vs total counts', async () => {
    appointmentsApi.listAdmin.mockResolvedValue({
      data: [
        {
          id: 501,
          patient_first_name: 'Maria',
          patient_last_name: 'Santos',
          patient_phone: '09170001111',
          service_name: 'Dental Prophylaxis',
          price_snapshot: 1200,
          duration_snapshot: 30,
          dentist_first_name: 'Elena',
          dentist_last_name: 'Reyes',
          operatory_chair: 'Chair 1',
          start_at: '2026-12-01 09:00:00',
          end_at: '2026-12-01 09:30:00',
          status: 'CONFIRMED',
        },
      ],
      meta: {
        total: 1,
        total_records: 48,
        filtered_records: 1,
        page: 1,
        current_page: 1,
        per_page: 15,
        last_page: 1,
        total_pages: 1,
        sorting: { sort_by: 'start_at', sort_dir: 'desc' },
      },
    });

    render(<AdminAppointmentsPage />);

    await waitFor(() => {
      expect(screen.getByText('#501')).toBeInTheDocument();
    });

    // Shows filtered vs unfiltered total count clearly
    expect(screen.getByText(/filtered from 48 total/i)).toBeInTheDocument();

    // Clicking Patient header triggers server-side sort_by=patient_name&sort_dir=asc
    fireEvent.click(screen.getByRole('button', { name: 'Patient' }));
    await waitFor(() => {
      expect(appointmentsApi.listAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ sort_by: 'patient_name', sort_dir: 'asc', page: 1 }),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    // Changing page size to 50 triggers server-side per_page=50
    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '50' } });
    await waitFor(() => {
      expect(appointmentsApi.listAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ per_page: 50, page: 1 }),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });
});
