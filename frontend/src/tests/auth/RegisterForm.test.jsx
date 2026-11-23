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
});
