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

  it('announces validation errors next to the Save button and moves focus to them', async () => {
    render(<TreatmentRecordEditor appointmentId={50} initialRecord={null} onSaved={vi.fn()} />);

    const diagnosis = screen.getByLabelText(/Clinical Diagnosis/i);
    const save = screen.getByRole('button', { name: /Save Treatment Record/i });
    fireEvent.click(save);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Clinical diagnosis is required/i);

    // The form is very long on phones: the alert must sit between the fields and the Save button,
    // not above the odontogram where a user who just tapped Save cannot see it.
    expect(diagnosis.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(alert.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(diagnosis.getAttribute('aria-invalid')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(alert));
  });

  it('stacks full-width action buttons on phones with 44px touch height', () => {
    render(<TreatmentRecordEditor appointmentId={50} initialRecord={null} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const row = screen.getByRole('button', { name: /Save Treatment Record/i }).parentElement;
    expect(row.className).toMatch(/flex-col-reverse/);
    expect(row.className).toMatch(/\[&>button\]:min-h-11/);
    expect(row.className).toMatch(/\[&>button\]:w-full/);
  });

  it('prefills clinical fields when a quick clinical template is selected', () => {
    render(<TreatmentRecordEditor appointmentId={50} initialRecord={null} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Oral Prophylaxis/i }));

    expect(screen.getByLabelText(/Clinical Diagnosis/i).value).toMatch(/supragingival plaque/i);
    expect(screen.getByLabelText(/Procedure Notes/i).value).toMatch(/ultrasonic scaling/i);
    expect(screen.getByLabelText(/Post-Op & Home Care/i).value).toMatch(/fluoride toothpaste/i);
  });

  it('toggles Full Mouth, quadrant selection, and Clear in FDI chart', () => {
    render(<TreatmentRecordEditor appointmentId={50} initialRecord={null} onSaved={vi.fn()} />);

    const fullMouthBtn = screen.getByRole('button', { name: /Full Mouth/i });
    fireEvent.click(fullMouthBtn);
    expect(screen.getByText(/Selected \(32\):/i)).toBeDefined();
    expect(fullMouthBtn.getAttribute('aria-pressed')).toBe('true');

    // Clicking Full Mouth again toggles all 32 teeth off
    fireEvent.click(fullMouthBtn);
    expect(screen.getByText(/Selected \(0\):/i)).toBeDefined();
    expect(fullMouthBtn.getAttribute('aria-pressed')).toBe('false');

    // Quadrant toggle selects 8 teeth and Clear resets selection
    const q1Btn = screen.getByRole('button', { name: /Q1 · Upper Right/i });
    fireEvent.click(q1Btn);
    expect(screen.getByText(/Selected \(8\):/i)).toBeDefined();
    expect(q1Btn.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: /^Clear$/i }));
    expect(screen.getByText(/Selected \(0\):/i)).toBeDefined();
  });
});
