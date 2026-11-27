import { useState, useEffect, useCallback, useRef } from 'react';
import { messagesApi } from '../api';
import { useRealtimeNotifications } from '../../../hooks/useRealtimeNotifications';
import { REALTIME_EVENTS } from '../../../services/realtime/socket-events';

const TYPING_INBOUND_TTL_MS = 4000;
const TYPING_OUTBOUND_THROTTLE_MS = 2200;
const PRESENCE_REFRESH_MS = 45000;

function generateClientMessageId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function broadcastUnreadCount(unreadCount) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent('toothcare:messages-unread', {
        detail: { unreadCount: Math.max(0, Number(unreadCount) || 0) },
      })
    );
  } catch {
    // Ignore in non-browser contexts
  }
}

/**
 * Deduplicate and merge server messages with optimistic pending/failed entries cleanly.
 */
function mergeMessageLists(existing, incoming, mode = 'replace') {
  const byKey = new Map();
  const keyOf = (m) => (m.id ? `id:${m.id}` : `client:${m.client_message_id}`);

  if (mode === 'prepend') {
    incoming.forEach((m) => byKey.set(keyOf(m), m));
    existing.forEach((m) => {
      const k = keyOf(m);
      if (!byKey.has(k)) byKey.set(k, m);
    });
  } else {
    // Keep optimistic/failed messages unless server now returned the matching client_message_id
    const serverClientIds = new Set(incoming.map((m) => m.client_message_id).filter(Boolean));
    const localOnly = existing.filter(
      (m) =>
        (m.delivery_status === 'sending' || m.delivery_status === 'failed') &&
        (!m.client_message_id || !serverClientIds.has(m.client_message_id))
    );

    if (mode === 'append') {
      existing.forEach((m) => {
        if (m.id) byKey.set(keyOf(m), m);
      });
    }
    incoming.forEach((m) => byKey.set(keyOf(m), m));
    localOnly.forEach((m) => byKey.set(keyOf(m), m));
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if (a.id && b.id) return a.id - b.id;
    const tA = new Date(a.created_at || 0).getTime();
    const tB = new Date(b.created_at || 0).getTime();
    return tA - tB;
  });
}

export function useMessaging({ user }) {
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [conversationsError, setConversationsError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'

  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeConversationMeta, setActiveConversationMeta] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [messagesError, setMessagesError] = useState(null);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [nextBeforeId, setNextBeforeId] = useState(null);

  const [typingByConversation, setTypingByConversation] = useState({});
  const [startingChat, setStartingChat] = useState(false);
  const [startChatError, setStartChatError] = useState(null);
  const [announcement, setAnnouncement] = useState('');

  const activeConvIdRef = useRef(activeConversationId);
  activeConvIdRef.current = activeConversationId;

  const conversationsReqSeqRef = useRef(0);
  const typingTimersRef = useRef(new Map());
  const lastTypingSentAtRef = useRef(0);
  const stopTypingTimerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      typingTimersRef.current.forEach((t) => clearTimeout(t));
      typingTimersRef.current.clear();
      if (stopTypingTimerRef.current) {
        clearTimeout(stopTypingTimerRef.current);
        stopTypingTimerRef.current = null;
      }
    };
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchConversations = useCallback(
    async ({ silent = false } = {}) => {
      const reqSeq = ++conversationsReqSeqRef.current;
      if (!silent) {
        setLoadingConversations(true);
        setConversationsError(null);
      }
      try {
        const data = await messagesApi.listConversations(
          { search: debouncedSearch, filter, page: 1, limit: 40 },
          silent ? { background: true, skipGlobalLoading: true } : {}
        );
        if (!mountedRef.current || reqSeq !== conversationsReqSeqRef.current) return;
        const list = Array.isArray(data.conversations) ? data.conversations : [];
        setConversations(list);
        setContacts(Array.isArray(data.contacts) ? data.contacts : []);
        const unread = Number(data.total_unread_count ?? 0);
        setTotalUnread(unread);
        broadcastUnreadCount(unread);

        // Keep active conversation metadata fresh if present in list
        if (activeConvIdRef.current) {
          const match = list.find((c) => c.id === activeConvIdRef.current);
          if (match) {
            setActiveConversationMeta(match);
          }
        }
      } catch (err) {
        if (!mountedRef.current || reqSeq !== conversationsReqSeqRef.current) return;
        if (!silent) {
          setConversationsError(err?.response?.data?.error?.message || err.message || 'Unable to load conversations.');
        }
      } finally {
        if (mountedRef.current && reqSeq === conversationsReqSeqRef.current && !silent) {
          setLoadingConversations(false);
        }
      }
    },
    [debouncedSearch, filter]
  );

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  // Periodically refresh online presence for visible counterparts
  useEffect(() => {
    const timer = setInterval(async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const onlineIds = await messagesApi.getPresence();
        if (!mountedRef.current) return;
        const onlineSet = new Set(onlineIds.map(Number));
        setConversations((prev) =>
          prev.map((c) => ({
            ...c,
            participant: {
              ...c.participant,
              is_online: Boolean(c.is_available && onlineSet.has(Number(c.participant?.user_id))),
            },
          }))
        );
        setActiveConversationMeta((prev) =>
          prev
            ? {
                ...prev,
                participant: {
                  ...prev.participant,
                  is_online: Boolean(prev.is_available && onlineSet.has(Number(prev.participant?.user_id))),
                },
              }
            : prev
        );
      } catch {
        // Non-fatal presence check failure
      }
    }, PRESENCE_REFRESH_MS);

    return () => clearInterval(timer);
  }, []);

  const markConversationRead = useCallback(async (conversationId) => {
    if (!conversationId) return;
    try {
      const res = await messagesApi.markRead(conversationId);
      if (!mountedRef.current) return;
      const nextTotal = Number(res.total_unread_count ?? 0);
      setTotalUnread(nextTotal);
      broadcastUnreadCount(nextTotal);
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
      );
      setActiveConversationMeta((prev) =>
        prev && prev.id === conversationId ? { ...prev, unread_count: 0 } : prev
      );
    } catch {
      // Non-fatal
    }
  }, []);

  const loadMessagesForConversation = useCallback(
    async (conversationId, { silent = false } = {}) => {
      if (!conversationId) return;
      if (!silent) {
        setLoadingMessages(true);
        setMessagesError(null);
      }
      try {
        const data = await messagesApi.getMessages(
          conversationId,
          { limit: 30 },
          silent ? { background: true, skipGlobalLoading: true } : {}
        );
        if (!mountedRef.current || activeConvIdRef.current !== conversationId) return;

        if (data.conversation) {
          setActiveConversationMeta(data.conversation);
          setConversations((prev) => {
            const exists = prev.some((c) => c.id === data.conversation.id);
            if (!exists) return [data.conversation, ...prev];
            return prev.map((c) => (c.id === data.conversation.id ? data.conversation : c));
          });
        }

        const fetched = Array.isArray(data.messages) ? data.messages : [];
        setMessages((prev) => (silent ? mergeMessageLists(prev, fetched, 'append') : mergeMessageLists([], fetched, 'replace')));
        if (!silent) {
          setHasMoreOlder(Boolean(data.pagination?.has_more));
          setNextBeforeId(data.pagination?.next_before_id ?? null);
        }

        const hasUnreadIncoming =
          (data.conversation?.unread_count ?? 0) > 0 ||
          fetched.some((m) => !m.is_mine && !m.read_at);
        const isTabVisible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
        if (hasUnreadIncoming && isTabVisible) {
          void markConversationRead(conversationId);
        }
      } catch (err) {
        if (!mountedRef.current || activeConvIdRef.current !== conversationId) return;
        if (!silent) {
          setMessagesError(err?.response?.data?.error?.message || err.message || 'Unable to load messages.');
        }
      } finally {
        if (mountedRef.current && activeConvIdRef.current === conversationId && !silent) {
          setLoadingMessages(false);
        }
      }
    },
    [markConversationRead]
  );

  // Mark active conversation read once the user returns to a previously hidden tab
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && activeConvIdRef.current) {
        void markConversationRead(activeConvIdRef.current);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [markConversationRead]);

  const selectConversation = useCallback(
    (conversationId) => {
      // Clear any pending outbound typing stop timer on conversation change
      if (stopTypingTimerRef.current) {
        clearTimeout(stopTypingTimerRef.current);
        stopTypingTimerRef.current = null;
      }
      const prevId = activeConvIdRef.current;
      if (prevId && prevId !== conversationId) {
        void messagesApi.sendTyping(prevId, false).catch(() => {});
      }

      setActiveConversationId(conversationId);
      if (!conversationId) {
        setActiveConversationMeta(null);
        setMessages([]);
        setHasMoreOlder(false);
        setNextBeforeId(null);
        setMessagesError(null);
        return;
      }

      const existing = conversations.find((c) => c.id === conversationId) || null;
      if (existing) {
        setActiveConversationMeta(existing);
      }
      setMessages([]);
      setHasMoreOlder(false);
      setNextBeforeId(null);
      void loadMessagesForConversation(conversationId, { silent: false });
    },
    [conversations, loadMessagesForConversation]
  );

  const loadOlderMessages = useCallback(async () => {
    const convId = activeConvIdRef.current;
    if (!convId || !hasMoreOlder || !nextBeforeId || loadingOlder) {
      return 0;
    }
    setLoadingOlder(true);
    try {
      const data = await messagesApi.getMessages(
        convId,
        { beforeId: nextBeforeId, limit: 30 },
        { background: true, skipGlobalLoading: true }
      );
      if (!mountedRef.current || activeConvIdRef.current !== convId) return 0;
      const older = Array.isArray(data.messages) ? data.messages : [];
      setMessages((prev) => mergeMessageLists(prev, older, 'prepend'));
      setHasMoreOlder(Boolean(data.pagination?.has_more));
      setNextBeforeId(data.pagination?.next_before_id ?? null);
      return older.length;
    } catch {
      return 0;
    } finally {
      if (mountedRef.current) {
        setLoadingOlder(false);
      }
    }
  }, [hasMoreOlder, nextBeforeId, loadingOlder]);

  const startConversationWithContact = useCallback(
    async (contact) => {
      if (!contact || startingChat) return { ok: false };
      setStartChatError(null);
      if (contact.existing_conversation_id) {
        selectConversation(contact.existing_conversation_id);
        return { ok: true, conversationId: contact.existing_conversation_id };
      }

      setStartingChat(true);
      try {
        const created = await messagesApi.startConversation({
          dentistId: contact.dentist_id,
          patientId: contact.patient_id,
        });
        if (!mountedRef.current || !created) return { ok: false };
        setConversations((prev) => {
          const filtered = prev.filter((c) => c.id !== created.id);
          return [created, ...filtered];
        });
        setActiveConversationId(created.id);
        setActiveConversationMeta(created);
        setMessages([]);
        setHasMoreOlder(false);
        setNextBeforeId(null);
        void loadMessagesForConversation(created.id, { silent: false });
        return { ok: true, conversationId: created.id };
      } catch (err) {
        const msg = err?.response?.data?.error?.message || err.message || 'Unable to start conversation.';
        if (mountedRef.current) {
          setStartChatError(msg);
        }
        return { ok: false, error: msg };
      } finally {
        if (mountedRef.current) {
          setStartingChat(false);
        }
      }
    },
    [startingChat, selectConversation, loadMessagesForConversation]
  );

  const sendMessage = useCallback(
    async (bodyText, { retryClientMessageId = null } = {}) => {
      const convId = activeConvIdRef.current;
      const trimmed = String(bodyText || '').trim();
      if (!convId || !trimmed) return { ok: false };

      const clientMessageId = retryClientMessageId || generateClientMessageId();
      const nowIso = new Date().toISOString();

      const optimisticMsg = {
        id: null,
        conversation_id: convId,
        sender_user_id: user?.id ?? 0,
        sender_role: String(user?.role || 'PATIENT').toUpperCase(),
        is_mine: true,
        client_message_id: clientMessageId,
        body: trimmed,
        appointment_id: activeConversationMeta?.appointment?.id ?? null,
        delivery_status: 'sending',
        delivered_at: null,
        read_at: null,
        created_at: nowIso,
      };

      setMessages((prev) => {
        const withoutOldAttempt = prev.filter((m) => m.client_message_id !== clientMessageId);
        return [...withoutOldAttempt, optimisticMsg];
      });

      // Clear typing indicator once sent
      if (stopTypingTimerRef.current) {
        clearTimeout(stopTypingTimerRef.current);
        stopTypingTimerRef.current = null;
      }

      try {
        const res = await messagesApi.sendMessage(convId, {
          body: trimmed,
          clientMessageId,
        });
        if (!mountedRef.current) return { ok: true };

        const saved = res.message;
        const updatedConv = res.conversation;

        if (saved && activeConvIdRef.current === convId) {
          setMessages((prev) => {
            const withoutOptimistic = prev.filter(
              (m) => m.client_message_id !== clientMessageId && m.id !== saved.id
            );
            return mergeMessageLists(withoutOptimistic, [saved], 'append');
          });
        }

        if (updatedConv) {
          setConversations((prev) => {
            const rest = prev.filter((c) => c.id !== updatedConv.id);
            return [updatedConv, ...rest];
          });
          if (activeConvIdRef.current === updatedConv.id) {
            setActiveConversationMeta(updatedConv);
          }
        }

        return { ok: true, message: saved };
      } catch (err) {
        if (!mountedRef.current) return { ok: false };
        const errorMsg = err?.response?.data?.error?.message || 'Failed to send. Tap retry.';
        if (activeConvIdRef.current === convId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.client_message_id === clientMessageId
                ? { ...m, delivery_status: 'failed', error_message: errorMsg }
                : m
            )
          );
        }
        return { ok: false, error: errorMsg };
      }
    },
    [user?.id, user?.role, activeConversationMeta?.appointment?.id]
  );

  const retryFailedMessage = useCallback(
    (failedMessage) => {
      if (!failedMessage?.body) return;
      void sendMessage(failedMessage.body, {
        retryClientMessageId: failedMessage.client_message_id,
      });
    },
    [sendMessage]
  );

  const notifyTypingActivity = useCallback(() => {
    const convId = activeConvIdRef.current;
    if (!convId || !activeConversationMeta?.is_available) return;

    const now = Date.now();
    if (now - lastTypingSentAtRef.current >= TYPING_OUTBOUND_THROTTLE_MS) {
      lastTypingSentAtRef.current = now;
      void messagesApi.sendTyping(convId, true).catch(() => {});
    }

    if (stopTypingTimerRef.current) {
      clearTimeout(stopTypingTimerRef.current);
    }
    stopTypingTimerRef.current = setTimeout(() => {
      stopTypingTimerRef.current = null;
      if (activeConvIdRef.current === convId) {
        void messagesApi.sendTyping(convId, false).catch(() => {});
      }
    }, 3000);
  }, [activeConversationMeta?.is_available]);

  // Real-time Socket.IO event synchronization (listeners auto-cleaned on unmount by useRealtimeNotifications)
  const { status: connectionStatus, isConnected } = useRealtimeNotifications({
    onEvent: (eventType, payload) => {
      const convId = Number(payload?.conversationId || payload?.entityId || 0);

      if (eventType === REALTIME_EVENTS.MESSAGE_CREATED) {
        // Clear typing state for this conversation when message arrives
        if (convId > 0) {
          const existingTimer = typingTimersRef.current.get(convId);
          if (existingTimer) {
            clearTimeout(existingTimer);
            typingTimersRef.current.delete(convId);
          }
          setTypingByConversation((prev) => (prev[convId] ? { ...prev, [convId]: false } : prev));
        }

        if (convId > 0 && activeConvIdRef.current === convId) {
          void loadMessagesForConversation(convId, { silent: true });
          setAnnouncement('New message received.');
        } else if (convId > 0) {
          void messagesApi.markDelivered(convId).catch(() => {});
          setAnnouncement('You received a new message.');
        }
        void fetchConversations({ silent: true });
      } else if (eventType === REALTIME_EVENTS.MESSAGE_DELIVERED) {
        if (convId > 0 && activeConvIdRef.current === convId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.is_mine && m.delivery_status === 'sent'
                ? { ...m, delivery_status: 'delivered', delivered_at: payload?.occurredAt || new Date().toISOString() }
                : m
            )
          );
        }
      } else if (eventType === REALTIME_EVENTS.MESSAGE_READ) {
        if (convId > 0 && activeConvIdRef.current === convId) {
          const readTime = payload?.occurredAt || new Date().toISOString();
          setMessages((prev) =>
            prev.map((m) =>
              m.is_mine && m.delivery_status !== 'sending' && m.delivery_status !== 'failed'
                ? { ...m, delivery_status: 'read', delivered_at: m.delivered_at || readTime, read_at: m.read_at || readTime }
                : m
            )
          );
        }
      } else if (eventType === REALTIME_EVENTS.MESSAGE_TYPING) {
        if (convId <= 0) return;
        const isTypingNow = payload?.status === 'typing';
        const existingTimer = typingTimersRef.current.get(convId);
        if (existingTimer) {
          clearTimeout(existingTimer);
          typingTimersRef.current.delete(convId);
        }
        setTypingByConversation((prev) => ({ ...prev, [convId]: isTypingNow }));
        if (isTypingNow) {
          const timer = setTimeout(() => {
            typingTimersRef.current.delete(convId);
            if (mountedRef.current) {
              setTypingByConversation((prev) => ({ ...prev, [convId]: false }));
            }
          }, TYPING_INBOUND_TTL_MS);
          typingTimersRef.current.set(convId, timer);
        }
      }
    },
    onReconnect: () => {
      // Reconcile missed messages and unread counts cleanly on Socket.IO reconnect
      void fetchConversations({ silent: true });
      if (activeConvIdRef.current) {
        void loadMessagesForConversation(activeConvIdRef.current, { silent: true });
      }
    },
  });

  const activeConversation =
    activeConversationMeta ||
    conversations.find((c) => c.id === activeConversationId) ||
    null;

  return {
    conversations,
    contacts,
    totalUnread,
    loadingConversations,
    conversationsError,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    activeConversationId,
    activeConversation,
    messages,
    loadingMessages,
    loadingOlder,
    messagesError,
    hasMoreOlder,
    isOtherTyping: Boolean(activeConversationId && typingByConversation[activeConversationId]),
    typingByConversation,
    startingChat,
    startChatError,
    clearStartChatError: () => setStartChatError(null),
    connectionStatus,
    isConnected,
    announcement,
    fetchConversations,
    selectConversation,
    loadOlderMessages,
    startConversationWithContact,
    sendMessage,
    retryFailedMessage,
    notifyTypingActivity,
    reloadActiveMessages: () => activeConversationId && loadMessagesForConversation(activeConversationId, { silent: false }),
  };
}

export default useMessaging;
