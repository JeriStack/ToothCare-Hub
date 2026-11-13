import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../../components/ui/Modal';

describe('Modal Component', () => {
  it('does not render modal surface when isOpen is false', () => {
    render(
      <Modal isOpen={false} title="Booking Confirmation">
        <p>Modal content</p>
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders modal with title, subtitle, and content when isOpen is true', () => {
    render(
      <Modal
        isOpen={true}
        title="Schedule Appointment"
        subtitle="Select preferred operatory chair and slot"
      >
        <p>Modal inner body text</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Schedule Appointment')).toBeInTheDocument();
    expect(screen.getByText('Select preferred operatory chair and slot')).toBeInTheDocument();
    expect(screen.getByText('Modal inner body text')).toBeInTheDocument();
  });

  it('triggers onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} title="Dialog" onClose={handleClose}>
        <p>Content</p>
      </Modal>
    );
    const closeBtn = screen.getByLabelText(/close dialog/i);
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('triggers onClose when pressing Escape key', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} title="Dialog" onClose={handleClose}>
        <p>Content</p>
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders modal footer when provided', () => {
    render(
      <Modal
        isOpen={true}
        title="Confirmation"
        footer={<button type="button">Confirm Booking</button>}
      >
        <p>Confirm your appointment details.</p>
      </Modal>
    );
    expect(screen.getByRole('button', { name: /confirm booking/i })).toBeInTheDocument();
  });
});
