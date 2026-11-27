import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCheck,
  Loader2,
  AlertCircle,
  RotateCcw,
  WifiOff,
  ChevronDown,
  MessageSquare,
} from 'lucide-react';
import { ParticipantAvatar } from './ParticipantAvatar';
import { MessageComposer } from './MessageComposer';
import {
  formatChatTime,
  formatDaySeparator,
  getDayKey,
  formatAppointmentChipDate,
  minutesBetween,
} from '../utils/chatFormatters';
import { CONNECTION_STATUS } from '../../../services/realtime/socket-events';

const GROUP_GAP_MINUTES = 5;
const BOTTOM_STICKY_THRESHOLD_PX = 120;

export function MessageThread({
  conversation = null,
  messages = [],
  loading = false,
  loadingOlder = false,
  error = null,
  hasMoreOlder = false,
  isOtherTyping = false,
  connectionStatus = CONNECTION_STATUS.CONNECTED,
  onBack,
  onLoadOlder,
  onSendMessage,
  onRetryMessage,
  onTyping,
  onReload,
}) {
  const scrollRef = useRef(null);
  const bottomSentinelRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const prevScrollHeightRef = useRef(null);
  const prevConvIdRef = useRef(null);
  const prevLastMsgKeyRef = useRef(null);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const [expandedTimestampKey, setExpandedTimestampKey] = useState(null);

  const scrollToBottom = useCallback((behavior = 'auto') => {
    const el = scrollRef.current;
    if (!el) return;
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior });
    } else {
      el.scrollTop = el.scrollHeight;
    }
    isNearBottomRef.current = true;
    setHasNewBelow(false);
  }, []);

  const triggerLoadOlder = useCallback(async () => {
    const el = scrollRef.current;
    if (!el || !hasMoreOlder || loadingOlder) return;
    prevScrollHeightRef.current = el.scrollHeight;
    const count = await onLoadOlder?.();
    if (!count) {
      prevScrollHeightRef.current = null;
    }
  }, [hasMoreOlder, loadingOlder, onLoadOlder]);

  // Preserve exact scroll position after prepending older messages
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || prevScrollHeightRef.current === null) return;
    const delta = el.scrollHeight - prevScrollHeightRef.current;
    if (delta > 0) {
      el.scrollTop = el.scrollTop + delta;
    }
    prevScrollHeightRef.current = null;
  }, [messages]);

  // Smart bottom scroll: scroll on initial conversation open, own send, or when user is already near bottom
  useEffect(() => {
    if (!conversation?.id) return;
    const lastMsg = messages[messages.length - 1];
    const lastKey = lastMsg ? `${lastMsg.id || lastMsg.client_message_id}` : null;
    const switchedConversation = prevConvIdRef.current !== conversation.id;

    if (switchedConversation) {
      prevConvIdRef.current = conversation.id;
      prevLastMsgKeyRef.current = lastKey;
      isNearBottomRef.current = true;
      setHasNewBelow(false);
      if (messages.length > 0) {
        scrollToBottom('auto');
      }
      return;
    }

    if (lastKey && lastKey !== prevLastMsgKeyRef.current) {
      prevLastMsgKeyRef.current = lastKey;
      if (lastMsg?.is_mine || isNearBottomRef.current) {
        scrollToBottom('smooth');
      } else {
        setHasNewBelow(true);
      }
    }
  }, [conversation?.id, messages, scrollToBottom]);

  // Keep typing bubble visible when user is already at bottom
  useEffect(() => {
    if (isOtherTyping && isNearBottomRef.current) {
      scrollToBottom('smooth');
    }
  }, [isOtherTyping, scrollToBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= BOTTOM_STICKY_THRESHOLD_PX;
    isNearBottomRef.current = nearBottom;
    if (nearBottom && hasNewBelow) {
      setHasNewBelow(false);
    }
    if (el.scrollTop <= 72 && hasMoreOlder && !loadingOlder) {
      void triggerLoadOlder();
    }
  };

  // Identify the latest outgoing message that has been read so we display a clean Messenger "Seen" receipt
  const lastReadOwnMessageKey = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.is_mine && m.delivery_status === 'read') {
        return `${m.id || m.client_message_id}`;
      }
    }
    return null;
  }, [messages]);

  const lastOwnMessageKey = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.is_mine) {
        return `${m.id || m.client_message_id}`;
      }
    }
    return null;
  }, [messages]);

  if (!conversation) {
    return (
      <section
        aria-label="Active conversation"
        className="flex-1 flex flex-col items-center justify-center h-full min-h-0 bg-[var(--chat-surface)] p-6 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-[var(--chat-composer-bg)] flex items-center justify-center mb-4 text-[#0B6EFD] dark:text-blue-400">
          <MessageSquare className="w-7 h-7" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">
          Your Patient–Dentist Messages
        </h2>
        <p className="text-sm text-[var(--text-muted)] max-w-sm mt-1.5 leading-relaxed">
          Select a conversation from the left panel or start a new chat to coordinate upcoming visits and post-treatment care.
        </p>
      </section>
    );
  }

  const participant = conversation.participant || {};
  const isReconnecting =
    connectionStatus === CONNECTION_STATUS.RECONNECTING ||
    connectionStatus === CONNECTION_STATUS.CONNECTING;
  const isDisconnected = connectionStatus === CONNECTION_STATUS.DISCONNECTED;

  return (
    <section
      aria-label={`Conversation with ${participant.name || 'Participant'}`}
      className="flex-1 flex flex-col h-full min-h-0 min-w-0 bg-[var(--chat-surface)] relative"
    >
      {/* Active Conversation Header */}
      <header className="shrink-0 px-3 sm:px-5 py-3 border-b border-[var(--chat-divider)] bg-[var(--chat-surface)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to conversations"
            className="lg:hidden min-h-11 min-w-11 -ml-1 inline-flex items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--chat-item-hover)] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </button>

          <ParticipantAvatar
            avatarUrl={participant.avatar_url}
            initials={participant.initials}
            name={participant.name}
            isOnline={Boolean(participant.is_online)}
            showOnlineDot={true}
            size="md"
          />

          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate leading-tight">
              {participant.name || 'Participant'}
            </h2>
            <p className="text-xs text-[var(--text-muted)] truncate flex items-center gap-1.5 mt-0.5">
              {!conversation.is_available ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">Unavailable</span>
              ) : isOtherTyping ? (
                <span className="text-[#0B6EFD] dark:text-blue-400 font-medium">Typing...</span>
              ) : participant.is_online ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Active now</span>
              ) : (
                <span>{participant.subtitle || 'Offline'}</span>
              )}
              {participant.subtitle && (participant.is_online || isOtherTyping) && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{participant.subtitle}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Optional Appointment Reference Chip */}
        {conversation.appointment && (
          <div
            data-testid="conversation-appointment-ref"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--chat-composer-bg)] border border-[var(--chat-divider)] text-xs text-[var(--text-secondary)] max-w-[16rem] shrink-0"
            title={`${conversation.appointment.service_name} · ${formatAppointmentChipDate(conversation.appointment.start_at)}`}
          >
            <Calendar className="w-3.5 h-3.5 text-[#0D9488] dark:text-teal-400 shrink-0" aria-hidden="true" />
            <span className="truncate font-medium text-[var(--text-primary)]">
              {conversation.appointment.service_name}
            </span>
            {conversation.appointment.start_at && (
              <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                {formatAppointmentChipDate(conversation.appointment.start_at)}
              </span>
            )}
          </div>
        )}
      </header>

      {/* Mobile Appointment Reference Strip */}
      {conversation.appointment && (
        <div className="sm:hidden shrink-0 px-3 py-1.5 bg-[var(--chat-subtle-surface)] border-b border-[var(--chat-divider)] flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
          <Calendar className="w-3.5 h-3.5 text-[#0D9488] dark:text-teal-400 shrink-0" aria-hidden="true" />
          <span className="font-medium text-[var(--text-primary)] truncate">
            {conversation.appointment.service_name}
          </span>
          {conversation.appointment.start_at && (
            <span className="text-[var(--text-muted)] shrink-0">
              · {formatAppointmentChipDate(conversation.appointment.start_at)}
            </span>
          )}
        </div>
      )}

      {/* Disconnected / Reconnecting Banner */}
      {(isReconnecting || isDisconnected) && (
        <div
          role="status"
          aria-live="polite"
          data-testid="chat-connection-banner"
          className="shrink-0 px-4 py-2 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200/80 dark:border-amber-800/60 flex items-center justify-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-200"
        >
          {isReconnecting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
              <span>Reconnecting to live messaging...</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Live updates paused — messages will sync when reconnected.</span>
            </>
          )}
        </div>
      )}

      {/* Scrollable Message Stream */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-label="Message history"
        aria-live="off"
        tabIndex={0}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain tch-chat-scroll px-3 sm:px-5 py-4 space-y-1 focus:outline-none"
      >
        {/* Load Older Messages Trigger or Start-of-History Marker */}
        {!loading && hasMoreOlder && (
          <div className="flex justify-center pb-3">
            <button
              type="button"
              disabled={loadingOlder}
              onClick={triggerLoadOlder}
              className="min-h-9 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[var(--chat-composer-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--chat-item-hover)] inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              {loadingOlder && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              <span>{loadingOlder ? 'Loading older messages...' : 'Load older messages'}</span>
            </button>
          </div>
        )}
        {!loading && !hasMoreOlder && messages.length >= 10 && (
          <div className="flex justify-center pb-2">
            <span className="text-[11px] text-[var(--text-muted)]">
              Beginning of conversation
            </span>
          </div>
        )}

        {loading ? (
          <div aria-label="Loading messages" className="space-y-3 py-4">
            {[false, true, false, false, true].map((mine, idx) => (
              <div key={idx} className={`flex ${mine ? 'justify-end' : 'justify-start items-end gap-2'} animate-pulse`}>
                {!mine && <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-gray-700 shrink-0" />}
                <div
                  className={`h-10 rounded-2xl ${
                    mine
                      ? 'w-44 bg-blue-200/70 dark:bg-blue-900/50'
                      : 'w-56 bg-slate-200 dark:bg-gray-700'
                  }`}
                />
              </div>
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="py-12 text-center">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">Could not load message history</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">{error}</p>
            <button
              type="button"
              onClick={onReload}
              className="mt-3 min-h-10 px-4 py-2 rounded-full text-xs font-semibold bg-[var(--chat-composer-bg)] text-[var(--text-primary)] hover:bg-[var(--chat-item-hover)] cursor-pointer"
            >
              Try again
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center text-center">
            <ParticipantAvatar
              avatarUrl={participant.avatar_url}
              initials={participant.initials}
              name={participant.name}
              isOnline={Boolean(participant.is_online)}
              showOnlineDot={true}
              size="lg"
              className="mb-3"
            />
            <p className="text-base font-bold text-[var(--text-primary)]">{participant.name}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{participant.subtitle}</p>
            <p className="text-xs text-[var(--text-muted)] max-w-xs mt-3 leading-relaxed">
              Send a message below to start your private clinical conversation.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const prev = idx > 0 ? messages[idx - 1] : null;
            const next = idx < messages.length - 1 ? messages[idx + 1] : null;
            const msgKey = `${msg.id || msg.client_message_id || idx}`;

            const dayKey = getDayKey(msg.created_at);
            const prevDayKey = prev ? getDayKey(prev.created_at) : null;
            const showDayDivider = idx === 0 || (dayKey && dayKey !== prevDayKey);

            const samePrevSender =
              !showDayDivider &&
              prev &&
              prev.is_mine === msg.is_mine &&
              minutesBetween(prev.created_at, msg.created_at) <= GROUP_GAP_MINUTES;
            const sameNextSender =
              next &&
              getDayKey(next.created_at) === dayKey &&
              next.is_mine === msg.is_mine &&
              minutesBetween(msg.created_at, next.created_at) <= GROUP_GAP_MINUTES;

            const isFirstInGroup = !samePrevSender;
            const isLastInGroup = !sameNextSender;

            // Messenger-style clustered bubble border radii
            const radiusClass = msg.is_mine
              ? isFirstInGroup && isLastInGroup
                ? 'rounded-2xl'
                : isFirstInGroup
                  ? 'rounded-2xl rounded-br-md'
                  : isLastInGroup
                    ? 'rounded-2xl rounded-tr-md'
                    : 'rounded-2xl rounded-r-md'
              : isFirstInGroup && isLastInGroup
                ? 'rounded-2xl'
                : isFirstInGroup
                  ? 'rounded-2xl rounded-bl-md'
                  : isLastInGroup
                    ? 'rounded-2xl rounded-tl-md'
                    : 'rounded-2xl rounded-l-md';

            const showTimeLabel = isLastInGroup || expandedTimestampKey === msgKey;
            const isFailed = msg.delivery_status === 'failed';
            const isSending = msg.delivery_status === 'sending';
            const showReceipt = msg.is_mine && (isFailed || isSending || msgKey === lastOwnMessageKey || msgKey === lastReadOwnMessageKey);

            return (
              <React.Fragment key={msgKey}>
                {showDayDivider && (
                  <div className="flex items-center justify-center py-3">
                    <span className="px-3 py-0.5 rounded-full text-[11px] font-medium bg-[var(--chat-subtle-surface)] text-[var(--text-muted)] border border-[var(--chat-divider)]">
                      {formatDaySeparator(msg.created_at)}
                    </span>
                  </div>
                )}

                <div
                  className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start items-end gap-2'} ${
                    isFirstInGroup ? 'mt-2.5' : 'mt-0.5'
                  }`}
                >
                  {/* Incoming sender avatar (Messenger style: shown on last bubble of a consecutive group) */}
                  {!msg.is_mine && (
                    <div className="w-8 shrink-0 flex items-end justify-center">
                      {isLastInGroup ? (
                        <ParticipantAvatar
                          avatarUrl={participant.avatar_url}
                          initials={participant.initials}
                          name={participant.name}
                          size="sm"
                        />
                      ) : null}
                    </div>
                  )}

                  <div className={`flex flex-col max-w-[82%] sm:max-w-[70%] min-w-0 ${msg.is_mine ? 'items-end' : 'items-start'}`}>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedTimestampKey((curr) => (curr === msgKey ? null : msgKey))
                      }
                      aria-label={`Message sent at ${formatChatTime(msg.created_at)}`}
                      className={`text-left px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words tch-wrap-anywhere ${radiusClass} transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] ${
                        isSending ? 'opacity-75' : ''
                      } ${isFailed ? 'ring-2 ring-rose-500/80' : ''}`}
                      style={
                        msg.is_mine
                          ? {
                              backgroundColor: 'var(--chat-bubble-out-bg)',
                              color: 'var(--chat-bubble-out-text)',
                            }
                          : {
                              backgroundColor: 'var(--chat-bubble-in-bg)',
                              color: 'var(--chat-bubble-in-text)',
                            }
                      }
                    >
                      {msg.body}
                    </button>

                    {/* Timestamp + Delivery / Read Receipt / Retry Controls */}
                    {(showTimeLabel || showReceipt) && (
                      <div
                        className={`flex items-center gap-1.5 mt-1 px-1 text-[11px] text-[var(--text-muted)] ${
                          msg.is_mine ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {showTimeLabel && !isFailed && (
                          <span>{formatChatTime(msg.created_at)}</span>
                        )}

                        {msg.is_mine && isSending && (
                          <span className="inline-flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                            <span>Sending...</span>
                          </span>
                        )}

                        {msg.is_mine && !isSending && !isFailed && msg.delivery_status === 'sent' && msgKey === lastOwnMessageKey && (
                          <span className="inline-flex items-center gap-0.5" title="Sent">
                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Sent</span>
                          </span>
                        )}

                        {msg.is_mine && !isSending && !isFailed && msg.delivery_status === 'delivered' && msgKey === lastOwnMessageKey && (
                          <span className="inline-flex items-center gap-0.5" title="Delivered">
                            <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Delivered</span>
                          </span>
                        )}

                        {msg.is_mine && msgKey === lastReadOwnMessageKey && (
                          <span
                            data-testid="message-read-receipt"
                            className="inline-flex items-center gap-1 text-[#0B6EFD] dark:text-blue-400 font-medium"
                            title="Seen"
                          >
                            <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Seen</span>
                          </span>
                        )}

                        {isFailed && (
                          <span className="inline-flex items-center gap-2 text-rose-600 dark:text-rose-400 font-medium">
                            <span>{msg.error_message || 'Failed to send'}</span>
                            <button
                              type="button"
                              onClick={() => onRetryMessage?.(msg)}
                              className="inline-flex items-center gap-1 underline underline-offset-2 font-semibold hover:text-rose-700 dark:hover:text-rose-300 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" aria-hidden="true" />
                              Retry
                            </button>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}

        {/* Typing Indicator Bubble */}
        {isOtherTyping && (
          <div
            data-testid="chat-typing-indicator"
            role="status"
            aria-live="polite"
            className="flex items-end gap-2 pt-2"
          >
            <ParticipantAvatar
              avatarUrl={participant.avatar_url}
              initials={participant.initials}
              name={participant.name}
              size="sm"
            />
            <div
              className="px-3.5 py-2.5 rounded-2xl rounded-bl-md inline-flex items-center gap-1"
              style={{ backgroundColor: 'var(--chat-bubble-in-bg)' }}
              aria-label={`${participant.name || 'Participant'} is typing`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] tch-typing-dot" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] tch-typing-dot" style={{ animationDelay: '160ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] tch-typing-dot" style={{ animationDelay: '320ms' }} />
            </div>
          </div>
        )}

        <div ref={bottomSentinelRef} aria-hidden="true" />
      </div>

      {/* Floating Jump-to-Latest Pill when user is reading older messages */}
      {hasNewBelow && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
          <button
            type="button"
            onClick={() => scrollToBottom('smooth')}
            className="min-h-9 px-3.5 py-1.5 rounded-full shadow-lg text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
            style={{ backgroundColor: 'var(--chat-bubble-out-bg)' }}
          >
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            <span>New messages</span>
          </button>
        </div>
      )}

      {/* Fixed Bottom Composer */}
      <MessageComposer
        disabled={!conversation.is_available}
        unavailableReason={!conversation.is_available ? conversation.unavailable_reason : null}
        onSend={onSendMessage}
        onTyping={onTyping}
      />
    </section>
  );
}

export default MessageThread;
