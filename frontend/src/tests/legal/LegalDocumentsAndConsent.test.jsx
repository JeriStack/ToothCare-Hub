import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { AuthProvider } from '../../features/auth/context/AuthContext';
import { RegisterForm } from '../../features/auth/components/RegisterForm';
import { LandingFooter } from '../../features/landing/components/LandingFooter';
import { TermsOfServicePage } from '../../features/legal/pages/TermsOfServicePage';
import { PrivacyPolicyPage } from '../../features/legal/pages/PrivacyPolicyPage';
import { LegalReacceptanceModal } from '../../features/legal/components/LegalReacceptanceModal';
import authApi from '../../features/auth/api';
import legalApi from '../../features/legal/api';

vi.mock('../../features/auth/api', () => {
  const mockAuth = {
    getMe: vi.fn().mockRejectedValue(new Error('No active session')),
    register: vi.fn(),
    resendVerification: vi.fn(),
    getCsrfToken: vi.fn().mockRejectedValue(new Error('No active session')),
  };
  return { default: mockAuth, authApi: mockAuth };
});

vi.mock('../../features/legal/api', () => {
  const mockLegal = {
    getPublicDocuments: vi.fn(),
    getTermsOfService: vi.fn(),
    getPrivacyPolicy: vi.fn(),
    getMyAcceptances: vi.fn(),
    submitAcceptances: vi.fn(),
  };
  return { default: mockLegal, legalApi: mockLegal };
});

describe('Legal Documents & User Consent Management UI', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
    authApi.getMe.mockRejectedValue(new Error('No active session'));
    legalApi.getPublicDocuments.mockResolvedValue({
      terms_of_service: { version: '1.0', effective_date: '2026-11-23', is_approved: false },
      privacy_policy: { version: '1.0', effective_date: '2026-11-23', is_approved: false },
    });
    legalApi.getTermsOfService.mockRejectedValue(new Error('Offline fallback'));
    legalApi.getPrivacyPolicy.mockRejectedValue(new Error('Offline fallback'));
  });

  it('renders public Terms of Service page with version, effective date, draft notice, TOC, and Back to Registration', async () => {
    const onBackToRegister = vi.fn();
    render(
      <ThemeProvider>
        <AuthProvider>
          <TermsOfServicePage
            cameFromRegister={true}
            onNavigateRegister={onBackToRegister}
            onNavigateHome={vi.fn()}
            onNavigateTerms={vi.fn()}
            onNavigatePrivacy={vi.fn()}
            onNavigateLogin={vi.fn()}
          />
        </AuthProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /terms of service/i })).toBeInTheDocument();
    });
    expect(screen.getByText('v1.0')).toBeInTheDocument();
    expect(screen.getAllByText(/november 23, 2026/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/draft — pending clinic & legal\/privacy approval/i)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /table of contents/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back to registration/i }));
    expect(onBackToRegister).toHaveBeenCalledTimes(1);
  });

  it('renders public Privacy Policy page with Philippine Data Privacy Act sections and no private patient data', async () => {
    render(
      <ThemeProvider>
        <AuthProvider>
          <PrivacyPolicyPage
            onNavigateHome={vi.fn()}
            onNavigateRegister={vi.fn()}
            onNavigateTerms={vi.fn()}
            onNavigatePrivacy={vi.fn()}
            onNavigateLogin={vi.fn()}
          />
        </AuthProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /privacy policy/i })).toBeInTheDocument();
    });
    expect(screen.getAllByText(/data privacy act of 2012/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/national privacy commission/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/draft — not approved for production/i).length).toBeGreaterThanOrEqual(1);
  });

  it('exposes clickable Terms of Service and Privacy Policy links in LandingFooter', () => {
    const onTerms = vi.fn();
    const onPrivacy = vi.fn();

    render(
      <LandingFooter
        onLogin={vi.fn()}
        onBookAppointment={vi.fn()}
        onAdminLogin={vi.fn()}
        onHelpSupport={vi.fn()}
        onTermsOfService={onTerms}
        onPrivacyPolicy={onPrivacy}
      />
    );

    const termsLink = screen.getByRole('link', { name: /terms of service/i });
    const privacyLink = screen.getByRole('link', { name: /privacy policy/i });

    expect(termsLink).toHaveAttribute('href', '/terms-of-service');
    expect(privacyLink).toHaveAttribute('href', '/privacy-policy');

    fireEvent.click(termsLink);
    fireEvent.click(privacyLink);

    expect(onTerms).toHaveBeenCalledTimes(1);
    expect(onPrivacy).toHaveBeenCalledTimes(1);
  });

  it('enforces unchecked agreement checkbox, navigates legal links without submitting, preserves non-sensitive draft, and submits document versions', async () => {
    const onNavigateTerms = vi.fn();
    const onNavigatePrivacy = vi.fn();
    const onSuccess = vi.fn();
    authApi.register.mockResolvedValue({ id: 42, email: 'maria.legal@example.com' });

    const { unmount } = render(
      <AuthProvider>
        <RegisterForm
          onNavigateLogin={vi.fn()}
          onNavigateTerms={onNavigateTerms}
          onNavigatePrivacy={onNavigatePrivacy}
          onSuccess={onSuccess}
        />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled();
    });

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    // Fill out form fields
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Santos' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'maria.legal@example.com' } });
    fireEvent.change(screen.getByLabelText(/^phone number$/i), { target: { value: '+63 917 123 4567' } });
    fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1995-04-12' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'StrongPass123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'StrongPass123!' } });

    // Click legal links: must navigate WITHOUT submitting form or toggling checkbox
    fireEvent.click(screen.getByRole('link', { name: /terms of service/i }));
    fireEvent.click(screen.getByRole('link', { name: /privacy policy/i }));
    expect(onNavigateTerms).toHaveBeenCalledTimes(1);
    expect(onNavigatePrivacy).toHaveBeenCalledTimes(1);
    expect(checkbox).not.toBeChecked();
    expect(authApi.register).not.toHaveBeenCalled();

    // Verify non-sensitive draft is saved in sessionStorage and password is NEVER stored
    const savedDraft = sessionStorage.getItem('toothcare_register_draft');
    expect(savedDraft).toContain('Maria');
    expect(savedDraft).toContain('maria.legal@example.com');
    expect(savedDraft).not.toContain('StrongPass123!');

    // Unmount and remount to simulate returning from /terms-of-service
    unmount();
    render(
      <AuthProvider>
        <RegisterForm
          onNavigateLogin={vi.fn()}
          onNavigateTerms={onNavigateTerms}
          onNavigatePrivacy={onNavigatePrivacy}
          onSuccess={onSuccess}
        />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled();
    });

    // Non-sensitive fields restored; passwords remain blank
    expect(screen.getByLabelText(/first name/i)).toHaveValue('Maria');
    expect(screen.getByLabelText(/email address/i)).toHaveValue('maria.legal@example.com');
    expect(screen.getByLabelText(/^password$/i)).toHaveValue('');

    // Re-enter password and attempt submit WITHOUT checking checkbox
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'StrongPass123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'StrongPass123!' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(
      screen.getByText('Please agree to the Terms of Service and acknowledge the Privacy Policy before creating your account.')
    ).toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();

    // Check checkbox and submit
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'maria.legal@example.com',
          accept_legal: true,
          terms_version: '1.0',
          privacy_version: '1.0',
        })
      );
    });
    // Must not submit client-generated acceptance timestamp
    expect(authApi.register.mock.calls[0][0]).not.toHaveProperty('accepted_at');
    // Draft cleared on success
    expect(sessionStorage.getItem('toothcare_register_draft')).toBeNull();
  });

  it('requires active confirmation in LegalReacceptanceModal before submitting renewed version', async () => {
    const onCompleted = vi.fn();
    legalApi.getMyAcceptances.mockResolvedValue({
      requires_reacceptance: true,
      pending_documents: [
        {
          document_id: 3,
          document_type: 'TERMS_OF_SERVICE',
          version: '2.0',
          title: 'Terms of Service',
          effective_date: '2026-12-15',
          change_summary: 'Material appointment policy update.',
          required_action: 'ACCEPTED',
          content: {
            introduction: 'Updated Terms v2.0',
            sections: [{ id: 's1', heading: '1. Updated', paragraphs: ['Details here.'] }],
          },
        },
      ],
    });
    legalApi.submitAcceptances.mockResolvedValue({ recorded: [] });

    render(<LegalReacceptanceModal isOpen={true} onCompleted={onCompleted} onSignOut={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('v2.0')).toBeInTheDocument();
    });

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    // Submitting unchecked displays alert error
    fireEvent.click(screen.getByRole('button', { name: /confirm & continue/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/review and confirm/i);
    expect(legalApi.submitAcceptances).not.toHaveBeenCalled();

    // Check and submit
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: /confirm & continue/i }));

    await waitFor(() => {
      expect(legalApi.submitAcceptances).toHaveBeenCalledWith([
        {
          document_type: 'TERMS_OF_SERVICE',
          document_version: '2.0',
          acceptance_action: 'ACCEPTED',
          accepted: true,
        },
      ]);
      expect(onCompleted).toHaveBeenCalledTimes(1);
    });
  });

  it('supports formal document utilities (Print, Copy link), active TOC selection, and accessible landmarks', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });

    render(
      <ThemeProvider>
        <AuthProvider>
          <PrivacyPolicyPage
            onNavigateHome={vi.fn()}
            onNavigateRegister={vi.fn()}
            onNavigateTerms={vi.fn()}
            onNavigatePrivacy={vi.fn()}
            onNavigateLogin={vi.fn()}
          />
        </AuthProvider>
      </ThemeProvider>
    );

    const h1 = await screen.findByRole('heading', { level: 1, name: /privacy policy/i });
    expect(h1).toHaveAttribute('id', 'legal-document-title');
    expect(h1).toHaveAttribute('tabindex', '-1');

    // Primary legal nav should not duplicate the "navigation" role word and marks Privacy Policy current
    const legalNav = screen.getByRole('navigation', { name: /^legal documents$/i });
    const activePrivacyLink = legalNav.querySelector('a[href="/privacy-policy"]');
    expect(activePrivacyLink).toHaveAttribute('aria-current', 'page');

    // Verbatim structured sub-clause rendering in Sections 3 & 13 keeps exact markers & wording
    expect(screen.getAllByText('(a)').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('(e)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /3\. personal information collected/i })).toBeInTheDocument();

    // Print action calls window.print
    fireEvent.click(screen.getByRole('button', { name: /^print$/i }));
    expect(printSpy).toHaveBeenCalledTimes(1);

    // Copy link action copies current URL and exposes copied feedback
    fireEvent.click(screen.getByRole('button', { name: /copy link/i }));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Link copied')).toBeInTheDocument();
      expect(screen.getByText(/privacy policy link copied to clipboard/i)).toBeInTheDocument();
    });

    // TOC navigation marks clicked section with aria-current="location"
    const tocNav = screen.getByRole('navigation', { name: /table of contents/i });
    const rightsLink = tocNav.querySelector('a[href="#data-subject-rights"]');
    expect(rightsLink).toBeTruthy();
    fireEvent.click(rightsLink);
    expect(rightsLink).toHaveAttribute('aria-current', 'location');

    // Minimize and expand desktop Table of Contents rail
    const minimizeBtn = screen.getByRole('button', { name: /minimize table of contents/i });
    expect(minimizeBtn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(minimizeBtn);
    expect(screen.queryByRole('navigation', { name: /table of contents/i })).not.toBeInTheDocument();

    const expandBtn = screen.getByRole('button', { name: /expand table of contents/i });
    expect(expandBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(expandBtn);
    expect(screen.getByRole('navigation', { name: /table of contents/i })).toBeInTheDocument();

    printSpy.mockRestore();
  });
});
