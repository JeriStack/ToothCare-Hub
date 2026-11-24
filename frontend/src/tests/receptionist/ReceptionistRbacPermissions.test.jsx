import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DentistListPage } from '../../features/dentists/pages/DentistListPage';
import { ServicesPage } from '../../features/services/pages/ServicesPage';
import { PatientListPage } from '../../features/patients/pages/PatientListPage';
import { dentistsApi } from '../../features/dentists/api';
import { servicesApi } from '../../features/services/api';
import { patientsApi } from '../../features/patients/api';

const mockUseAuth = vi.fn();

vi.mock('../../features/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../features/dentists/api', () => ({
  dentistsApi: {
    getAdminDentists: vi.fn(),
    createDentist: vi.fn(),
    updateDentist: vi.fn(),
    toggleDentistStatus: vi.fn(),
  },
}));

vi.mock('../../features/services/api', () => ({
  servicesApi: {
    getAdminServices: vi.fn(),
    createService: vi.fn(),
    updateService: vi.fn(),
    toggleServiceStatus: vi.fn(),
  },
}));

vi.mock('../../features/patients/api', () => ({
  patientsApi: {
    getAdminPatients: vi.fn(),
    getPatient: vi.fn(),
    updatePatient: vi.fn(),
    togglePatientStatus: vi.fn(),
  },
}));

const receptionistAuth = {
  user: { id: 3, role: 'RECEPTIONIST', first_name: 'Clarisse', last_name: 'Mendoza' },
  hasPermission: (perm) =>
    ['dentists.view', 'services.view', 'patients.view', 'patients.manage'].includes(perm),
};

const adminAuth = {
  user: { id: 1, role: 'ADMIN', first_name: 'Marco', last_name: 'Villanueva' },
  hasPermission: () => true,
};

describe('Receptionist vs Admin RBAC Enforcement across Dentists, Services, and Patients', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    dentistsApi.getAdminDentists.mockResolvedValue({
      data: [
        {
          id: 1,
          first_name: 'Maria',
          last_name: 'Santos',
          email: 'dr.santos@toothcare.local',
          phone: '+639175551234',
          license_number: 'PRC-008472',
          specialization: 'General & Cosmetic Dentistry',
          default_operatory_chair: 'Operatory Chair 1',
          bio: 'Lead clinic dentist specializing in preventive care.',
          is_active: 1,
        },
      ],
      meta: { total: 1, page: 1, per_page: 10, last_page: 1 },
    });

    servicesApi.getAdminServices.mockResolvedValue({
      data: [
        {
          id: 2,
          name: 'Composite Tooth Filling',
          category: 'Restorative',
          description: 'Tooth-colored nanohybrid resin restoration.',
          price: 1800,
          duration_minutes: 45,
          is_active: 1,
        },
      ],
      meta: { total: 1, page: 1, per_page: 10, last_page: 1 },
    });

    const samplePatient = {
      id: 18,
      user_id: 25,
      first_name: 'Daniel',
      last_name: 'Reyes',
      email: 'daniel@example.com',
      phone: '09281234567',
      date_of_birth: '2001-11-08',
      gender: 'MALE',
      address: 'Makati City',
      emergency_contact_name: 'Ana Reyes',
      emergency_contact_phone: '09170000001',
      medical_alerts: 'None',
      is_active: 1,
      created_at: '2026-11-01 09:00:00',
    };

    patientsApi.getAdminPatients.mockResolvedValue({
      data: [samplePatient],
      meta: { total: 1, page: 1, per_page: 10, last_page: 1 },
    });
    patientsApi.getPatient.mockResolvedValue(samplePatient);
  });

  it('hides dentist email/phone clutter in the table, keeps Clinic Dentist Roster view-only for Receptionists, and lets Admins manage dentists', async () => {
    mockUseAuth.mockReturnValue(receptionistAuth);
    const { unmount } = render(<DentistListPage />);

    await waitFor(() => {
      expect(screen.getByText('Dr. Maria Santos')).toBeInTheDocument();
    });

    // Email and phone are NOT rendered inline in the table row
    expect(screen.queryByText('dr.santos@toothcare.local')).not.toBeInTheDocument();
    expect(screen.queryByText('+639175551234')).not.toBeInTheDocument();

    expect(screen.getByText('View-Only Access')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Licensed Dentist/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit Dr\. Maria Santos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Deactivate Dr\. Maria Santos/i })).not.toBeInTheDocument();

    // Receptionist can open read-only details modal to inspect contact info & bio
    fireEvent.click(screen.getByRole('button', { name: /View Dr\. Maria Santos/i }));
    expect(screen.getByText('dr.santos@toothcare.local')).toBeInTheDocument();
    expect(screen.getByText('+639175551234')).toBeInTheDocument();
    expect(screen.getByText('Lead clinic dentist specializing in preventive care.')).toBeInTheDocument();
    unmount();

    // Admin retains View, Add, Edit, and Deactivate controls
    mockUseAuth.mockReturnValue(adminAuth);
    render(<DentistListPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Licensed Dentist/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /View Dr\. Maria Santos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit Dr\. Maria Santos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Deactivate Dr\. Maria Santos/i })).toBeInTheDocument();
  });

  it('hides service descriptions in the table, keeps Dental Services Catalog strictly view-only for Receptionists, and lets Admins manage services', async () => {
    mockUseAuth.mockReturnValue(receptionistAuth);
    const { unmount } = render(<ServicesPage />);

    await waitFor(() => {
      expect(screen.getByText('Composite Tooth Filling')).toBeInTheDocument();
    });

    // Description is NOT rendered in the table row
    expect(screen.queryByText('Tooth-colored nanohybrid resin restoration.')).not.toBeInTheDocument();

    expect(screen.getByText('View-Only Access')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Dental Service/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit Composite Tooth Filling/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Deactivate Composite Tooth Filling/i })).not.toBeInTheDocument();

    // Receptionist can inspect full service description in read-only modal
    fireEvent.click(screen.getByRole('button', { name: /View Composite Tooth Filling/i }));
    expect(screen.getByText('Clinical Description')).toBeInTheDocument();
    expect(screen.getByText('Tooth-colored nanohybrid resin restoration.')).toBeInTheDocument();
    unmount();

    // Admin retains View, Add, Edit, and Deactivate controls
    mockUseAuth.mockReturnValue(adminAuth);
    render(<ServicesPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Dental Service/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /View Composite Tooth Filling/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit Composite Tooth Filling/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Deactivate Composite Tooth Filling/i })).toBeInTheDocument();
  });

  it('hides patient emails in the table, lets Receptionists view and edit patient records, and hides Disable/Enable account controls', async () => {
    mockUseAuth.mockReturnValue(receptionistAuth);
    const { unmount } = render(<PatientListPage />);

    await waitFor(() => {
      expect(screen.getByText('Daniel Reyes')).toBeInTheDocument();
    });

    // Patient email is NOT displayed in the table
    expect(screen.queryByText('daniel@example.com')).not.toBeInTheDocument();

    // Receptionist can open read-only View Patient Information modal
    const viewBtn = screen.getByRole('button', { name: /View Daniel Reyes/i });
    fireEvent.click(viewBtn);
    await waitFor(() => {
      expect(screen.getByText('Contact Information')).toBeInTheDocument();
      expect(screen.getByText('Makati City')).toBeInTheDocument();
      expect(screen.getByText('Ana Reyes')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Close patient information/i }));

    // Edit allowed, Disable hidden in table row
    const editBtn = screen.getByRole('button', { name: /Edit Daniel Reyes/i });
    expect(editBtn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Disable account for Daniel Reyes/i })).not.toBeInTheDocument();

    // Open Edit modal — Save Profile Changes is visible, Disable Account Login is hidden
    fireEvent.click(editBtn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save Profile Changes/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Disable Account Login/i })).not.toBeInTheDocument();
    unmount();

    // Admin retains both Edit and Disable Account controls
    mockUseAuth.mockReturnValue(adminAuth);
    render(<PatientListPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Disable account for Daniel Reyes/i })).toBeInTheDocument();
    });
  });
});
