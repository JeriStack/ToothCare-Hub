import apiClient from '../../lib/apiClient';

/**
 * Patient-Dentist Direct Messaging API Client
 * Uses silent/background flags for typing, read receipts, and presence checks
 * so the global top loading bar stays calm during real-time messaging.
 */
export const messagesApi = {
  async listConversations({ search = '', filter = 'all', page = 1, limit = 30 } = {}, options = {}) {
    const res = await apiClient.get('/messages/conversations', {
      params: { search, filter, page, limit },
      ...options,
    });
    return res.data?.data || { conversations: [], contacts: [], total_unread_count: 0, pagination: {} };
  },

  async getUnreadCount(options = {}) {
    const res = await apiClient.get('/messages/unread-count', {
      background: true,
      skipGlobalLoading: true,
      ...options,
    });
    return Number(res.data?.data?.unread_count ?? 0);
  },

  async getPresence(options = {}) {
    const res = await apiClient.get('/messages/presence', {
      background: true,
      skipGlobalLoading: true,
      ...options,
    });
    return res.data?.data?.online_user_ids || [];
  },

  async startConversation({ dentistId, patientId, appointmentId } = {}) {
    const payload = {};
    if (dentistId) payload.dentist_id = dentistId;
    if (patientId) payload.patient_id = patientId;
    if (appointmentId) payload.appointment_id = appointmentId;

    const res = await apiClient.post('/messages/conversations', payload);
    return res.data?.data?.conversation || null;
  },

  async getMessages(conversationId, { beforeId = null, limit = 30 } = {}, options = {}) {
    const params = { limit };
    if (beforeId) params.before_id = beforeId;

    const res = await apiClient.get(`/messages/conversations/${conversationId}/messages`, {
      params,
      ...options,
    });
    return res.data?.data || { conversation: null, messages: [], pagination: { has_more: false, next_before_id: null } };
  },

  async sendMessage(conversationId, { body, clientMessageId, appointmentId = null }) {
    const payload = {
      body,
      client_message_id: clientMessageId,
    };
    if (appointmentId) payload.appointment_id = appointmentId;

    const res = await apiClient.post(`/messages/conversations/${conversationId}/messages`, payload, {
      skipGlobalLoading: true,
    });
    return res.data?.data || { message: null, conversation: null, duplicate: false };
  },

  async markDelivered(conversationId) {
    const res = await apiClient.post(
      `/messages/conversations/${conversationId}/delivered`,
      {},
      { background: true, skipGlobalLoading: true }
    );
    return res.data?.data || { delivered_count: 0 };
  },

  async markRead(conversationId) {
    const res = await apiClient.post(
      `/messages/conversations/${conversationId}/read`,
      {},
      { background: true, skipGlobalLoading: true }
    );
    return res.data?.data || { read_count: 0, total_unread_count: 0 };
  },

  async sendTyping(conversationId, isTyping = true) {
    const res = await apiClient.post(
      `/messages/conversations/${conversationId}/typing`,
      { is_typing: Boolean(isTyping) },
      { background: true, skipGlobalLoading: true }
    );
    return res.data?.data || { sent: false };
  },
};

export default messagesApi;
