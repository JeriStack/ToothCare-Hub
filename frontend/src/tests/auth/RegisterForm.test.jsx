import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../features/auth/context/AuthContext';
import { RegisterForm } from '../../features/auth/components/RegisterForm';
import authApi from '../../features/auth/api';

vi.mock('../../features/auth/api', () => {
  const mockApi = {
    getMe: vi.fn().mockRejectedValue(new Error('No active session')),
    register: vi.fn(),
    resendVerification: vi.fn(),
    getCsrfToken: vi.fn().mockRejectedValue(new Error('No active session')),
  };
  return {
    default: mockApi,
    authApi: mockApi,
  };
});

describe('RegisterForm Name Input Restrictions', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
    authApi.getMe.mockRejectedValue(new Error('No active session'));
  });

  const renderReadyForm = async () => {
    render(
      <AuthProvider>
        <RegisterForm />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled();
    });
  };

  it('prevents typing digits in First name and Last name inputs', async () => {
    await renderReadyForm();

    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);

    const digitEventFirst = new KeyboardEvent('keydown', { key: '5', bubbles: true, cancelable: true });
    firstNameInput.dispatchEvent(digitEventFirst);
    expect(digitEventFirst.defaultPrevented).toBe(true);

    const digitEventLast = new KeyboardEvent('keydown', { key: '9', bubbles: true, cancelable: true });
    lastNameInput.dispatchEvent(digitEventLast);
    expect(digitEventLast.defaultPrevented).toBe(true);

    const letterEvent = new KeyboardEvent('keydown', { key: 'M', bubbles: true, cancelable: true });
    firstNameInput.dispatchEvent(letterEvent);
    expect(letterEvent.defaultPrevented).toBe(false);

    const shortcutEvent = new KeyboardEvent('keydown', { key: '1', ctrlKey: true, bubbles: true, cancelable: true });
    firstNameInput.dispatchEvent(shortcutEvent);
    expect(shortcutEvent.defaultPrevented).toBe(false);
  });

  it('strips numbers when pasted or changed into First name and Last name while keeping valid name characters', async () => {
    await renderReadyForm();

    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);

    fireEvent.change(firstNameInput, { target: { value: 'Maria123 Clara45' } });
    fireEvent.change(lastNameInput, { target: { value: "De la Cruz-99 O'Brien0" } });

    expect(firstNameInput).toHaveValue('Maria Clara');
    expect(lastNameInput).toHaveValue("De la Cruz- O'Brien");
    expect(firstNameInput).toHaveAttribute('autocomplete', 'given-name');
    expect(lastNameInput).toHaveAttribute('autocomplete', 'family-name');
  });

  it('shows accessible inline errors and focuses First name when submitted with only digits stripped', async () => {
    await renderReadyForm();

    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);

    fireEvent.change(firstNameInput, { target: { value: '12345' } });
    fireEvent.change(lastNameInput, { target: { value: '67890' } });
    expect(firstNameInput).toHaveValue('');
    expect(lastNameInput).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByText('First name is required.')).toBeInTheDocument();
    expect(screen.getByText('Last name is required.')).toBeInTheDocument();
    expect(firstNameInput).toHaveAttribute('aria-invalid', 'true');
    expect(firstNameInput).toHaveAttribute('aria-describedby', 'reg-first-name-error');
    expect(lastNameInput).toHaveAttribute('aria-describedby', 'reg-last-name-error');
    expect(firstNameInput).toHaveFocus();
  });

  it('prevents words/letters in Phone number and Emergency contact phone, and blocks numbers in Emergency contact name', async () => {
    await renderReadyForm();

    const phoneInput = screen.getByLabelText(/^phone number$/i);
    const letterOnPhone = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    phoneInput.dispatchEvent(letterOnPhone);
    expect(letterOnPhone.defaultPrevented).toBe(true);

    const digitOnPhone = new KeyboardEvent('keydown', { key: '9', bubbles: true, cancelable: true });
    phoneInput.dispatchEvent(digitOnPhone);
    expect(digitOnPhone.defaultPrevented).toBe(false);

    fireEvent.change(phoneInput, { target: { value: 'call +63 917 abc 123 4567' } });
    expect(phoneInput).toHaveValue('+63 917  123 4567');

    // Expand optional section
    const optionalToggle = screen.getByRole('button', { name: /address, medical history & emergency contact/i });
    expect(optionalToggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(optionalToggle);
    expect(optionalToggle).toHaveAttribute('aria-expanded', 'true');

    const emergencyNameInput = screen.getByLabelText(/emergency contact name/i);
    const emergencyPhoneInput = screen.getByLabelText(/emergency contact phone/i);

    const digitOnEmergencyName = new KeyboardEvent('keydown', { key: '4', bubbles: true, cancelable: true });
    emergencyNameInput.dispatchEvent(digitOnEmergencyName);
    expect(digitOnEmergencyName.defaultPrevented).toBe(true);

    fireEvent.change(emergencyNameInput, { target: { value: 'Juan99 Santos (Spouse) 2' } });
    expect(emergencyNameInput).toHaveValue('Juan Santos (Spouse) ');

    const letterOnEmergencyPhone = new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true });
    emergencyPhoneInput.dispatchEvent(letterOnEmergencyPhone);
    expect(letterOnEmergencyPhone.defaultPrevented).toBe(true);

    fireEvent.change(emergencyPhoneInput, { target: { value: 'tel +63 918 xyz 765 4321' } });
    expect(emergencyPhoneInput).toHaveValue('+63 918  765 4321');
  });

  it('validates email, password mismatch on blur, and displays live match indicator', async () => {
    await renderReadyForm();

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput);
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();

    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

    fireEvent.change(passwordInput, { target: { value: 'StrongPass123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPass1!' } });
    fireEvent.blur(confirmPasswordInput);
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();

    fireEvent.change(confirmPasswordInput, { target: { value: 'StrongPass123!' } });
    expect(screen.queryByText('Passwords do not match.')).not.toBeInTheDocument();
    expect(screen.getByText('Passwords match')).toBeInTheDocument();
  });

  it('displays accurate queued registration confirmation and handles resend cleanly without exposing internal errors', async () => {
    authApi.register.mockResolvedValue({ id: 99, email: 'welcome.patient@example.com' });
    authApi.resendVerification.mockResolvedValue({ sent: true });

    await renderReadyForm();

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Santos' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'welcome.patient@example.com' } });
    fireEvent.change(screen.getByLabelText(/^phone number$/i), { target: { value: '+63 917 123 4567' } });
    fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1995-04-12' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'StrongPass123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'StrongPass123!' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /registration received/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/have been queued for/i)).toBeInTheDocument();
    expect(screen.getByText('welcome.patient@example.com')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /resend verification/i }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/new verification link has been queued/i);
    });
  });
});
