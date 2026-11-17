import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmailDeliveryPanel } from '../../features/system/components/EmailDeliveryPanel';
import { emailOutboxApi } from '../../features/system/emailOutboxApi';

vi.mock('../../features/system/emailOutboxApi', () => ({
  emailOutboxApi: {
    getStats: vi.fn(),
    getJobs: vi.fn(),
    retry: vi.fn(),
    abandon: vi.fn(),
  },
}));

const stats = {
  total: 12, pending: 2, processing: 0, sent: 7, retrying: 1, failed: 2, cancelled: 0, exhausted: 1,
  last_sent_at: '2026-11-17 09:47:10', avg_delivery_delay_seconds: 4.2,
  mail: { enabled: true, operational: true, configuration_errors: [] },
  worker: { enabled: true, configuration_valid: true, configuration_errors: [], max_attempts: 5 },
};

const failedJob = {
  id: 21, reference: 'EML-000021', event_type: 'APPOINTMENT_CONFIRMED', recipient: 'm******@e******.com',
  status: 'FAILED_PERMANENT', attempts: 1, max_attempts: 5, exhausted: false, failure_category: 'PERMANENT',
  error_code: 'INVALID_RECIPIENT', error_message: 'Recipient address is invalid.', next_attempt_at: null,
  last_attempt_at: '2026-11-17 09:40:00',
};
const exhaustedJob = { ...failedJob, id: 22, reference: 'EML-000022', attempts: 5, exhausted: true, error_code: 'SMTP_451' };

function forbidden() {
  const err = new Error('Forbidden');
  err.response = { status: 403 };
  return err;
}

describe('EmailDeliveryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emailOutboxApi.getStats.mockResolvedValue(stats);
    emailOutboxApi.getJobs.mockResolvedValue({ data: [failedJob, exhaustedJob], meta: {} });
    emailOutboxApi.retry.mockResolvedValue({});
    emailOutboxApi.abandon.mockResolvedValue({});
  });

  it('shows database-backed queue metrics and SMTP state', async () => {
    render(<EmailDeliveryPanel />);
    expect(await screen.findByText('SMTP configured')).toBeInTheDocument();
    expect(screen.getAllByText('Exhausted').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('4.2s')).toBeInTheDocument();
  });

  it('lists failures with masked recipients and sanitized errors only', async () => {
    render(<EmailDeliveryPanel />);
    expect(await screen.findByText('EML-000021')).toBeInTheDocument();
    expect(screen.getAllByText('m******@e******.com').length).toBe(2);
    expect(screen.getByText(/INVALID_RECIPIENT/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry EML-000021' })).toHaveTextContent('Retry');
    expect(screen.getByRole('button', { name: 'Retry EML-000022' })).toHaveTextContent('Requeue');
  });

  it('retries a failed job and reloads', async () => {
    render(<EmailDeliveryPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry EML-000021' }));
    await waitFor(() => expect(emailOutboxApi.retry).toHaveBeenCalledWith(21, { confirm: false }));
    expect(await screen.findByText('EML-000021 was queued for another attempt.')).toBeInTheDocument();
    expect(emailOutboxApi.getStats).toHaveBeenCalledTimes(2);
  });

  it('requires explicit confirmation before requeueing an exhausted job', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<EmailDeliveryPanel />);
    const btn = await screen.findByRole('button', { name: 'Retry EML-000022' });
    fireEvent.click(btn);
    expect(emailOutboxApi.retry).not.toHaveBeenCalled();
    fireEvent.click(btn);
    await waitFor(() => expect(emailOutboxApi.retry).toHaveBeenCalledWith(22, { confirm: true }));
    confirmSpy.mockRestore();
  });

  it('explains missing permissions instead of failing', async () => {
    emailOutboxApi.getStats.mockRejectedValue(forbidden());
    emailOutboxApi.getJobs.mockRejectedValue(forbidden());
    render(<EmailDeliveryPanel />);
    expect(await screen.findByText(/requires the/)).toBeInTheDocument();
    expect(screen.getByText('email_outbox.view')).toBeInTheDocument();
  });

  it('shows failure-view permission message when only stats are allowed', async () => {
    emailOutboxApi.getJobs.mockRejectedValue(forbidden());
    render(<EmailDeliveryPanel />);
    expect(await screen.findByText('email_outbox.view_failures')).toBeInTheDocument();
  });

  it('surfaces SMTP misconfiguration', async () => {
    emailOutboxApi.getStats.mockResolvedValue({ ...stats, mail: { enabled: true, operational: false, configuration_errors: ['MAIL_HOST is required when MAIL_ENABLED=true.'] } });
    render(<EmailDeliveryPanel />);
    expect(await screen.findByText('SMTP misconfigured')).toBeInTheDocument();
    expect(screen.getByText('MAIL_HOST is required when MAIL_ENABLED=true.')).toBeInTheDocument();
  });
});
