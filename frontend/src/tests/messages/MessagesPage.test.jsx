import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MessagesPage } from '../../features/messages/pages/MessagesPage';
import { messagesApi } from '../../features/messages/api';
import { CONNECTION_STATUS, REALTIME_EVENTS } from '../../services/realtime/socket-events';

vi.mock('../../features/auth', () => ({
  useAuth: () => ({
    user: { id: 10, role: 'PATIENT', patient: { id: 3, first_name: 'Maria', last_name: 'Santos' } },
    isAuthenticated: true,
  }),
}));

let realtimeListeners = { onEvent: null, onReconnect: null };
let mockConnectionStatus = CONNECTION_STATUS.CONNECTED;

vi.mock('../../hooks/useRealtimeNotifications', () => ({
  useRealtimeNotifications: ({ onEvent, onReconnect } = {}) => {
    realtimeListeners.onEvent = onEvent;
    realtimeListeners.onReconnect = onReconnect;
    return {
      status: mockConnectionStatus,
      isConnected: mockConnectionStatus === CONNECTION_STATUS.CONNECTED,
      lastEvent: null,
    };
  },
}));

vi.mock('../../features/messages/api', () => ({
  messagesApi: {
    listConversations: vi.fn(),
    getUnreadCount: vi.fn(),
    getPresence: vi.fn(),
    startConversation: vi.fn(),
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
    markDelivered: vi.fn(),
    markRead: vi.fn(),
    sendTyping: vi.fn(),
  },
}));

const SAMPLE_CONV = {
  id: 1,
  patient_id: 3,
  dentist_id: 7,
  status: 'ACTIVE',
  is_available: true,
  unavailable_reason: null,
  participant: {
    user_id: 22,
    role: 'DENTIST',
    dentist_id: 7,
    name: 'Dr. Elena Cruz',
    subtitle: 'Orthodontics',
    initials: 'EC',
    avatar_url: null,
    is_online: true,
    is_active: true,
  },
  appointment: {
    id: 55,
    service_name: 'Dental Prophylaxis',
    start_at: '2026-11-28T10:00:00+08:00',
    status: 'CONFIRMED',
  },
  last_message_id: 102,
  last_message_preview: 'See you tomorrow morning!',
  last_message_at: '2026-11-27T14:10:00+08:00',
  last_message_from_me: false,
  unread_count: 1,
  updated_at: '2026-11-27T14:10:00+08:00',
};

const SAMPLE_MESSAGES = [
  {
    id: 101,
    conversation_id: 1,
    sender_user_id: 10,
    sender_role: 'PATIENT',
    is_mine: true,
    client_message_id: 'c-101',
    body: 'Hello Dr. Cruz!',
    delivery_status: 'read',
    delivered_at: '2026-11-27T14:00:00+08:00',
    read_at: '2026-11-27T14:01:00+08:00',
    created_at: '2026-11-27T14:00:00+08:00',
  },
  {
    id: 102,
    conversation_id: 1,
    sender_user_id: 22,
    sender_role: 'DENTIST',
    is_mine: false,
    client_message_id: 'c-102',
    body: 'See you tomorrow morning!',
    delivery_status: 'delivered',
    delivered_at: '2026-11-27T14:10:00+08:00',
    read_at: null,
    created_at: '2026-11-27T14:10:00+08:00',
  },
];

describe('Messenger-Style Patient-Dentist Chat (MessagesPage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectionStatus = CONNECTION_STATUS.CONNECTED;
    realtimeListeners = { onEvent: null, onReconnect: null };

    messagesApi.listConversations.mockResolvedValue({
      conversations: [SAMPLE_CONV],
      contacts: [],
      total_unread_count: 1,
      pagination: { page: 1, limit: 40, total: 1, total_pages: 1 },
    });
    messagesApi.getMessages.mockResolvedValue({
      conversation: SAMPLE_CONV,
      messages: SAMPLE_MESSAGES,
      pagination: { limit: 30, has_more: true, next_before_id: 101 },
    });
    messagesApi.markRead.mockResolvedValue({
      conversation_id: 1,
      read_count: 1,
      total_unread_count: 0,
    });
    messagesApi.sendTyping.mockResolvedValue({ conversation_id: 1, sent: true });
    messagesApi.getPresence.mockResolvedValue([22]);
  });

  it('renders conversation sidebar, opens a thread with appointment context and read receipts, and loads older messages', async () => {
    render(<MessagesPage />);

    const convBtn = await screen.findByTestId('conversation-item-1');
    expect(convBtn).toHaveTextContent('Dr. Elena Cruz');
    expect(convBtn).toHaveTextContent('See you tomorrow morning!');
    expect(screen.getByTestId('sidebar-total-unread')).toHaveTextContent('1');

    fireEvent.click(convBtn);

    expect(await screen.findByText('Hello Dr. Cruz!')).toBeInTheDocument();
    expect(screen.getByTestId('conversation-appointment-ref')).toHaveTextContent('Dental Prophylaxis');
    expect(screen.getByTestId('message-read-receipt')).toHaveTextContent('Seen');

    await waitFor(() => {
      expect(messagesApi.markRead).toHaveBeenCalledWith(1);
    });

    // Load older messages pagination
    messagesApi.getMessages.mockResolvedValueOnce({
      conversation: SAMPLE_CONV,
      messages: [
        {
          id: 99,
          conversation_id: 1,
          sender_user_id: 22,
          sender_role: 'DENTIST',
          is_mine: false,
          body: 'Earlier welcome message',
          delivery_status: 'read',
          created_at: '2026-11-26T10:00:00+08:00',
        },
      ],
      pagination: { limit: 30, has_more: false, next_before_id: null },
    });

    fireEvent.click(screen.getByRole('button', { name: /load older messages/i }));
    expect(await screen.findByText('Earlier welcome message')).toBeInTheDocument();
    expect(messagesApi.getMessages).toHaveBeenLastCalledWith(
      1,
      { beforeId: 101, limit: 30 },
      expect.any(Object)
    );
  });

  it('supports IME-safe Enter to send, Shift+Enter newline, failed send retry, and typing indicator', async () => {
    messagesApi.sendMessage.mockRejectedValueOnce(new Error('Network offline')).mockResolvedValueOnce({
      message: {
        id: 103,
        conversation_id: 1,
        sender_user_id: 10,
        sender_role: 'PATIENT',
        is_mine: true,
        client_message_id: 'retry-1',
        body: 'Can I arrive 10 minutes early?',
        delivery_status: 'sent',
        created_at: '2026-11-27T14:20:00+08:00',
      },
      conversation: { ...SAMPLE_CONV, last_message_preview: 'Can I arrive 10 minutes early?', last_message_from_me: true, unread_count: 0 },
      duplicate: false,
    });

    render(<MessagesPage />);
    fireEvent.click(await screen.findByTestId('conversation-item-1'));
    await screen.findByText('Hello Dr. Cruz!');

    const textarea = screen.getByLabelText('Write a message');
    fireEvent.change(textarea, { target: { value: 'Can I arrive 10 minutes early?' } });

    // IME composing Enter MUST NOT submit
    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(textarea, { key: 'Enter', keyCode: 229 });
    expect(messagesApi.sendMessage).not.toHaveBeenCalled();

    // Shift+Enter MUST NOT submit
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(messagesApi.sendMessage).not.toHaveBeenCalled();

    // Plain Enter submits -> first attempt fails -> shows Retry button
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    const retryBtn = await screen.findByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    // Clicking Retry resends with same clientMessageId and succeeds
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(messagesApi.sendMessage).toHaveBeenCalledTimes(2);
    });
    const firstClientId = messagesApi.sendMessage.mock.calls[0][1].clientMessageId;
    const secondClientId = messagesApi.sendMessage.mock.calls[1][1].clientMessageId;
    expect(secondClientId).toBe(firstClientId);

    // Realtime typing indicator event renders animated bubble
    act(() => {
      realtimeListeners.onEvent?.(REALTIME_EVENTS.MESSAGE_TYPING, {
        conversationId: 1,
        status: 'typing',
      });
    });
    expect(await screen.findByTestId('chat-typing-indicator')).toBeInTheDocument();
  });

  it('shows unavailable banner and disables composer when counterpart account is archived/inactive, plus reconnecting state', async () => {
    mockConnectionStatus = CONNECTION_STATUS.RECONNECTING;
    const unavailableConv = {
      ...SAMPLE_CONV,
      status: 'UNAVAILABLE',
      is_available: false,
      unavailable_reason: 'This conversation is read-only because the participant account is currently inactive or archived.',
    };
    messagesApi.listConversations.mockResolvedValue({
      conversations: [unavailableConv],
      contacts: [],
      total_unread_count: 0,
      pagination: { page: 1, limit: 40, total: 1, total_pages: 1 },
    });
    messagesApi.getMessages.mockResolvedValue({
      conversation: unavailableConv,
      messages: SAMPLE_MESSAGES,
      pagination: { limit: 30, has_more: false, next_before_id: null },
    });

    render(<MessagesPage />);
    fireEvent.click(await screen.findByTestId('conversation-item-1'));

    expect(await screen.findByTestId('chat-connection-banner')).toHaveTextContent(/reconnecting/i);
    expect(screen.getByTestId('composer-unavailable-banner')).toHaveTextContent(/inactive or archived/i);
    expect(screen.queryByLabelText('Write a message')).not.toBeInTheDocument();
  });

  it('supports Unread filter tab, New Message contact picker error handling, and defers read receipts while tab is hidden', async () => {
    messagesApi.listConversations.mockResolvedValue({
      conversations: [SAMPLE_CONV],
      contacts: [
        {
          id: 9,
          dentist_id: 9,
          user_id: 30,
          role: 'DENTIST',
          name: 'Dr. Marco Lim',
          subtitle: 'Endodontics',
          initials: 'ML',
          avatar_url: null,
          is_online: true,
          existing_conversation_id: null,
        },
      ],
      total_unread_count: 1,
      pagination: { page: 1, limit: 40, total: 1, total_pages: 1 },
    });
    messagesApi.startConversation.mockRejectedValueOnce({
      response: { data: { error: { message: 'This dentist is currently unavailable for messaging.' } } },
    });

    render(<MessagesPage />);
    await screen.findByTestId('conversation-item-1');

    // Switch to Unread filter tab
    fireEvent.click(screen.getByRole('tab', { name: /unread/i }));
    await waitFor(() => {
      expect(messagesApi.listConversations).toHaveBeenCalledWith(
        expect.objectContaining({ filter: 'unread' }),
        expect.any(Object)
      );
    });

    // Open New Message panel and trigger failed conversation creation -> shows inline alert
    fireEvent.click(screen.getByRole('button', { name: /start new conversation/i }));
    fireEvent.click(await screen.findByText('Dr. Marco Lim'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/currently unavailable for messaging/i);

    // Return to conversation list while document is hidden -> opening conversation does NOT falsely mark read
    fireEvent.click(screen.getByRole('button', { name: /back to conversations/i }));
    const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    try {
      fireEvent.click(await screen.findByTestId('conversation-item-1'));
      await screen.findByText('Hello Dr. Cruz!');
      expect(messagesApi.markRead).not.toHaveBeenCalled();

      // Returning to visible tab triggers markRead automatically
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await waitFor(() => {
        expect(messagesApi.markRead).toHaveBeenCalledWith(1);
      });
    } finally {
      if (originalVisibility) {
        Object.defineProperty(document, 'visibilityState', originalVisibility);
      } else {
        delete document.visibilityState;
      }
    }
  });
});
