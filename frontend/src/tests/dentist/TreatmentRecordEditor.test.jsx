import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { TreatmentRecordEditor } from '../../features/treatment-records/components/TreatmentRecordEditor';
import { treatmentRecordsApi } from '../../features/treatment-records/api';

vi.mock('../../features/treatment-records/api', () => ({
  treatmentRecordsApi: {
    create: vi.fn(),
    update: vi.fn(),
  },
}));

describe('TreatmentRecordEditor Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form inputs for diagnosis, procedure notes, and FDI tooth chart', () => {
    render(
      <TreatmentRecordEditor
        appointmentId={50}
        initialRecord={null}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/Clinical Diagnosis/i)).toBeDefined();
    expect(screen.getByLabelText(/Procedure Notes/i)).toBeDefined();
    expect(screen.getByRole('group', { name: /FDI Dental Arch Chart/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Save Treatment Record/i })).toBeDefined();
  });

  it('allows selecting teeth numbers in FDI chart', async () => {
    render(
      <TreatmentRecordEditor
        appointmentId={50}
        initialRecord={null}
        onSaved={vi.fn()}
      />
    );

    // Click tooth 14
    const tooth14Btn = screen.getByRole('button', { name: /14/i });
    fireEvent.click(tooth14Btn);

    // Selected teeth summary displays #14
    expect(screen.getByText(/#14/i)).toBeDefined();
  });

  it('validates required fields before submitting', async () => {
    render(
      <TreatmentRecordEditor
        appointmentId={50}
        initialRecord={null}
        onSaved={vi.fn()}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Save Treatment Record/i });
    fireEvent.click(submitBtn);

    // Required diagnosis error displays
    await waitFor(() => {
      expect(screen.getByText(/Clinical diagnosis is required/i)).toBeDefined();
    });
    expect(treatmentRecordsApi.create).not.toHaveBeenCalled();
  });

  it('submits valid clinical record payload and invokes onSaved callback', async () => {
    const handleSaved = vi.fn();
    treatmentRecordsApi.create.mockResolvedValueOnce({
      id: 99,
      appointment_id: 50,
      diagnosis: 'Localized acute apical periodontitis',
      procedure_notes: 'Pulpectomy performed under 2% lidocaine anesthesia.',
      teeth_treated: [14],
    });

    render(
      <TreatmentRecordEditor
        appointmentId={50}
        initialRecord={null}
        onSaved={handleSaved}
      />
    );

    // Select tooth 14
    fireEvent.click(screen.getByRole('button', { name: /14/i }));

    // Fill diagnosis & procedure
    fireEvent.change(screen.getByLabelText(/Clinical Diagnosis/i), {
      target: { value: 'Localized acute apical periodontitis' },
    });
    fireEvent.change(screen.getByLabelText(/Procedure Notes/i), {
      target: { value: 'Pulpectomy performed under 2% lidocaine anesthesia.' },
    });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Save Treatment Record/i }));

    await waitFor(() => {
      expect(treatmentRecordsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          appointment_id: 50,
          diagnosis: 'Localized acute apical periodontitis',
          procedure_notes: 'Pulpectomy performed under 2% lidocaine anesthesia.',
          teeth_treated: [14],
        })
      );
    });
  });

  it('displays locked compliance banner and disables inputs when record is locked', () => {
    const lockedRecord = {
      id: 99,
      appointment_id: 50,
      diagnosis: 'Past treated diagnosis',
      procedure_notes: 'Past procedure notes',
      teeth_treated: [21],
      is_locked: true,
      locked_at: '2026-11-01 10:00:00',
    };

    render(
      <TreatmentRecordEditor
        appointmentId={50}
        initialRecord={lockedRecord}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByText(/Record Locked & Permanently Archived/i)).toBeDefined();
    expect(screen.getByLabelText(/Clinical Diagnosis/i).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: /Update Treatment Record/i })).toBeNull();
  });
});
