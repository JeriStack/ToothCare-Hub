import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ArchiveCenterPage } from '../../features/archives/pages/ArchiveCenterPage';
import { archivesApi } from '../../features/archives/api';

const mockUseOptionalAuth = vi.fn();

vi.mock('../../features/auth/context/AuthContext', () => ({
  useOptionalAuth: () => mockUseOptionalAuth(),
}));

vi.mock('../../features/archives/api', () => ({
  archivesApi: {
    list: vi.fn(),
    getSummary: vi.fn(),
    getDetail: vi.fn(),
    archiveEntity: vi.fn(),
    restore: vi.fn(),
    exportCsv: vi.fn(),
  },
}));

describe('ArchiveCenterPage (Role-Aware Compliance Archive Vault)', () => {
  const sampleRecords = [
    {
      id: 1,
      entity_type: 'appointment',
      entity_id: 9001,
      reference_code: 'ARC-EX-APT-001',
      title: 'Completed Visit — Dental Prophylaxis (Example)',
      summary: 'Completed preventive cleaning visit.',
      status: 'ARCHIVED',
      retention_category: 'OPERATIONAL_3Y',
      retention_until: '2029-11-15',
      archive_reason: 'Quarterly operational archive (example record).',
      archived_by_role: 'RECEPTIONIST',
      archived_at: '2026-11-15 17:30:00',
      snapshot_sha256: 'a'.repeat(64),
      is_example: true,
      can_restore: false,
    },
    {
      id: 2,
      entity_type: 'service',
      entity_id: 14,
      reference_code: 'ARC-SRV-000014-AB12CD',
      title: 'Service #14 — Porcelain Veneer',
      summary: 'Cosmetic · 60 mins',
      status: 'ARCHIVED',
      retention_category: 'CATALOG_LEGACY',
      retention_until: '2029-11-26',
      archive_reason: 'Discontinued cosmetic SKU for Q4 cleanup.',
      archived_by_role: 'ADMIN',
      archived_at: '2026-11-26 10:00:00',
      snapshot_sha256: 'b'.repeat(64),
      is_example: false,
      can_restore: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    archivesApi.list.mockResolvedValue({
      data: sampleRecords,
      meta: {
        total: 2,
        total_records: 6,
        filtered_records: 2,
        page: 1,
        current_page: 1,
        per_page: 10,
        last_page: 1,
        total_pages: 1,
      },
    });
  });

  it('renders Admin Archive Vault with KPIs, Example badges, snapshot SHA-256 inspector, archive creation, and restore flow', async () => {
    mockUseOptionalAuth.mockReturnValue({ user: { id: 1, role: 'ADMIN' } });
    archivesApi.getSummary.mockResolvedValue({
      role: 'ADMIN',
      total_records: 6,
      active_archived: 5,
      locked_retention: 1,
      restored_count: 0,
      example_count: 6,
      by_entity_type: { appointment: 1, treatment_record: 1, patient: 1, dentist: 1, service: 1, user: 1 },
      allowed_entity_types: ['appointment', 'treatment_record', 'patient', 'dentist', 'service', 'user'],
      creatable_entity_types: ['appointment', 'treatment_record', 'patient', 'dentist', 'service', 'user'],
      capabilities: { can_archive: true, can_restore: true, can_export: true },
    });
    archivesApi.getDetail.mockResolvedValue({
      ...sampleRecords[1],
      integrity_verified: true,
      snapshot: { service_id: 14, name: 'Porcelain Veneer', category: 'Cosmetic' },
    });
    archivesApi.restore.mockResolvedValue({ ...sampleRecords[1], status: 'RESTORED', can_restore: false });
    archivesApi.archiveEntity.mockResolvedValue({ reference_code: 'ARC-SRV-000015-XYZ123' });

    render(<ArchiveCenterPage />);

    expect(screen.getByText('Compliance Archive Vault')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('ARC-EX-APT-001')).toBeInTheDocument();
      expect(screen.getByText('Example')).toBeInTheDocument();
      expect(screen.getByText('Service #14 — Porcelain Veneer')).toBeInTheDocument();
    });

    // Inspect snapshot modal shows SHA-256 verification badge and preserved fields
    fireEvent.click(screen.getByRole('button', { name: 'Inspect ARC-SRV-000014-AB12CD' }));
    await waitFor(() => {
      expect(screen.getByText('Tamper-Evident SHA-256 Integrity Verified')).toBeInTheDocument();
      expect(screen.getByText('Porcelain Veneer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close snapshot inspector' }));

    // Restore modal submits mandatory audit reason
    fireEvent.click(screen.getByRole('button', { name: 'Restore ARC-SRV-000014-AB12CD' }));
    fireEvent.change(screen.getByLabelText('Mandatory Restore Reason'), {
      target: { value: 'Re-enabling service for clinic schedule.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Restore' }));
    await waitFor(() => {
      expect(archivesApi.restore).toHaveBeenCalledWith(2, 'Re-enabling service for clinic schedule.');
    });

    // Archive Record modal submits live archive request
    fireEvent.click(screen.getByRole('button', { name: /Archive Record/i }));
    fireEvent.change(screen.getByLabelText('Record ID'), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText('Mandatory Audit Reason'), {
      target: { value: 'Closing resolved historical appointment record.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Archive' }));
    await waitFor(() => {
      expect(archivesApi.archiveEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: 'appointment',
          entity_id: 15,
          reason: 'Closing resolved historical appointment record.',
        })
      );
    });
  });

  it('renders read-only personal Archive view for Patients without archive, restore, or export buttons', async () => {
    mockUseOptionalAuth.mockReturnValue({ user: { id: 9, role: 'PATIENT' } });
    archivesApi.getSummary.mockResolvedValue({
      role: 'PATIENT',
      total_records: 2,
      active_archived: 1,
      locked_retention: 1,
      restored_count: 0,
      example_count: 2,
      by_entity_type: { appointment: 1, treatment_record: 1 },
      allowed_entity_types: ['appointment', 'treatment_record'],
      creatable_entity_types: [],
      capabilities: { can_archive: false, can_restore: false, can_export: false },
    });
    archivesApi.list.mockResolvedValue({
      data: [sampleRecords[0]],
      meta: { total: 1, total_records: 2, filtered_records: 1, page: 1, per_page: 10, last_page: 1 },
    });

    render(<ArchiveCenterPage />);

    expect(screen.getByText('My Visit & Clinical Archive')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('ARC-EX-APT-001')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Archive Record/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Export CSV/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Restore/i })).not.toBeInTheDocument();
  });

  it('surfaces tamper warning when snapshot SHA-256 verification fails and locks clinical retention for Dentists', async () => {
    mockUseOptionalAuth.mockReturnValue({ user: { id: 3, role: 'DENTIST' } });
    archivesApi.getSummary.mockResolvedValue({
      role: 'DENTIST',
      total_records: 2,
      active_archived: 1,
      locked_retention: 1,
      restored_count: 0,
      example_count: 2,
      by_entity_type: { appointment: 1, treatment_record: 1 },
      allowed_entity_types: ['appointment', 'treatment_record'],
      creatable_entity_types: ['appointment', 'treatment_record'],
      capabilities: { can_archive: true, can_restore: false, can_export: false },
    });
    archivesApi.list.mockResolvedValue({
      data: [sampleRecords[0]],
      meta: { total: 1, total_records: 2, filtered_records: 1, page: 1, per_page: 10, last_page: 1 },
    });
    archivesApi.getDetail.mockResolvedValue({
      ...sampleRecords[0],
      integrity_verified: false,
      snapshot: { appointment_id: 9001, status: 'COMPLETED' },
    });

    render(<ArchiveCenterPage />);

    expect(screen.getByText('Clinical & Treatment Archive')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('ARC-EX-APT-001')).toBeInTheDocument();
    });

    // Tampered snapshot triggers Integrity Check Warning banner
    fireEvent.click(screen.getByRole('button', { name: 'Inspect ARC-EX-APT-001' }));
    await waitFor(() => {
      expect(screen.getByText('Integrity Check Warning — Snapshot Digest Mismatch')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close snapshot inspector' }));

    // Selecting Clinical Chart in Archive modal locks retention policy to CLINICAL_7Y
    fireEvent.click(screen.getByRole('button', { name: /Archive Record/i }));
    fireEvent.change(screen.getByLabelText('Record Domain'), { target: { value: 'treatment_record' } });
    expect(screen.getByLabelText(/Retention Policy \(Mandatory Clinical Lock\)/i)).toBeDisabled();
    expect(screen.getByText(/permanently sealed as Locked Retention/i)).toBeInTheDocument();
  });
});
