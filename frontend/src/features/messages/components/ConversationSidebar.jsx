import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  SquarePen,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { ParticipantAvatar } from './ParticipantAvatar';
import { formatConversationTimestamp } from '../utils/chatFormatters';

export function ConversationSidebar({
  conversations = [],
  contacts = [],
  totalUnread = 0,
  loading = false,
  error = null,
  searchQuery = '',
  onSearchChange,
  filter = 'all',
  onFilterChange,
  activeConversationId = null,
  typingByConversation = {},
  startingChat = false,
  startChatError = null,
  onClearStartChatError,
  currentUserRole = 'PATIENT',
  onSelectConversation,
  onStartWithContact,
  onRetry,
}) {
  const [isComposingNew, setIsComposingNew] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  const filteredContacts = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        String(c.name || '').toLowerCase().includes(q) ||
        String(c.subtitle || '').toLowerCase().includes(q)
    );
  }, [contacts, contactSearch]);

  const counterpartLabel = currentUserRole === 'PATIENT' ? 'dentist' : 'patient';

  return (
    <section
      aria-label="Conversations"
      className="flex flex-col h-full min-h-0 w-full bg-[var(--chat-sidebar-surface)] border-r border-[var(--chat-divider)]"
    >
      {/* Top Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[var(--chat-divider)] shrink-0">
        <div className="flex items-center justify-between gap-2 mb-3">
          {isComposingNew ? (
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => {
                  setIsComposingNew(false);
                  setContactSearch('');
                  onClearStartChatError?.();
                }}
                aria-label="Back to conversations"
                className="min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 inline-flex items-center justify-center rounded-full text-slate-600 dark:text-gray-300 hover:bg-[var(--chat-item-hover)] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              </button>
              <h2 className="text-base font-bold text-[var(--text-primary)] truncate">
                New Message
              </h2>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)] truncate">
                Messages
              </h2>
              {totalUnread > 0 && (
                <span
                  data-testid="sidebar-total-unread"
                  className="inline-flex items-center justify-center min-w-[1.35rem] h-5 px-1.5 rounded-full text-[11px] font-bold text-white"
                  style={{ backgroundColor: 'var(--chat-bubble-out-bg)' }}
                >
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </div>
          )}

          {!isComposingNew && (
            <button
              type="button"
              onClick={() => setIsComposingNew(true)}
              aria-label={`Start new conversation with a ${counterpartLabel}`}
              title={`Message a ${counterpartLabel}`}
              className="min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 inline-flex items-center justify-center rounded-full bg-[var(--chat-composer-bg)] text-[var(--text-primary)] hover:bg-[var(--chat-item-hover)] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]"
            >
              <SquarePen className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Search Input */}
        {isComposingNew ? (
          <div className="relative">
            <label htmlFor="chat-new-contact-search" className="sr-only">
              Search {counterpartLabel}s to message
            </label>
            <Search
              className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="chat-new-contact-search"
              type="search"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder={`Search ${counterpartLabel}s...`}
              className="w-full min-h-10 pl-10 pr-9 py-2 rounded-full text-sm bg-[var(--chat-composer-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border border-transparent focus:border-[var(--ring-focus)] focus:outline-none transition-colors"
            />
            {contactSearch && (
              <button
                type="button"
                onClick={() => setContactSearch('')}
                aria-label="Clear contact search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="relative">
              <label htmlFor="chat-conversation-search" className="sr-only">
                Search conversations
              </label>
              <Search
                className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="chat-conversation-search"
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Search conversations..."
                className="w-full min-h-10 pl-10 pr-9 py-2 rounded-full text-sm bg-[var(--chat-composer-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border border-transparent focus:border-[var(--ring-focus)] focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange?.('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Filter Pills: All / Unread */}
            <div role="tablist" aria-label="Filter conversations" className="flex items-center gap-2 mt-3">
              {[
                { key: 'all', label: 'All' },
                { key: 'unread', label: 'Unread', badge: totalUnread },
              ].map((tab) => {
                const isSelected = filter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => onFilterChange?.(tab.key)}
                    className={`min-h-9 px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] ${
                      isSelected
                        ? 'bg-[var(--chat-item-active)] text-[#0B6EFD] dark:text-blue-300'
                        : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--chat-item-hover)]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.badge > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[1.15rem] h-4 px-1 rounded-full text-[10px] font-bold bg-[#0B6EFD] dark:bg-blue-500 text-white">
                        {tab.badge > 99 ? '99+' : tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain tch-chat-scroll p-2">
        {isComposingNew ? (
          <>
            {startChatError && (
              <div
                role="alert"
                className="mx-1 mb-2 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">{startChatError}</span>
              </div>
            )}
            {filteredContacts.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                No {counterpartLabel}s found
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {contactSearch
                  ? 'Try a different name or specialty.'
                  : currentUserRole === 'DENTIST'
                    ? 'Patients with assigned appointments appear here.'
                    : 'Active clinic dentists will appear here.'}
              </p>
            </div>
          ) : (
            <ul role="list" className="space-y-1">
              {filteredContacts.map((contact) => (
                <li key={`${contact.role}-${contact.id}`}>
                  <button
                    type="button"
                    disabled={startingChat}
                    onClick={async () => {
                      const result = await onStartWithContact?.(contact);
                      if (result?.ok) {
                        setIsComposingNew(false);
                        setContactSearch('');
                      }
                    }}
                    className="w-full min-h-[3.75rem] px-3 py-2.5 rounded-xl flex items-center gap-3 text-left hover:bg-[var(--chat-item-hover)] transition-colors cursor-pointer disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]"
                  >
                    <ParticipantAvatar
                      avatarUrl={contact.avatar_url}
                      initials={contact.initials}
                      name={contact.name}
                      isOnline={contact.is_online}
                      showOnlineDot={true}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {contact.name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {contact.subtitle}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          </>
        ) : loading ? (
          <div aria-label="Loading conversations" className="space-y-2 p-1">
            {[0, 1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl animate-pulse"
              >
                <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-gray-700 shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="h-3.5 w-28 rounded bg-slate-200 dark:bg-gray-700" />
                    <div className="h-2.5 w-10 rounded bg-slate-200 dark:bg-gray-700" />
                  </div>
                  <div className="h-3 w-4/5 rounded bg-slate-200/80 dark:bg-gray-700/80" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="px-4 py-8 text-center">
            <AlertCircle className="w-7 h-7 text-rose-500 mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Could not load conversations
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 min-h-10 px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 bg-[var(--chat-composer-bg)] text-[var(--text-primary)] hover:bg-[var(--chat-item-hover)] cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Retry
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--chat-composer-bg)] flex items-center justify-center mx-auto mb-3 text-[var(--text-muted)]">
              <MessageSquare className="w-5 h-5" aria-hidden="true" />
            </div>
            {searchQuery.trim() ? (
              <>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  No matching conversations
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  No chats matched &ldquo;{searchQuery.trim()}&rdquo;.
                </p>
                <button
                  type="button"
                  onClick={() => onSearchChange?.('')}
                  className="mt-3 min-h-10 px-4 py-2 rounded-full text-xs font-semibold text-[#0B6EFD] dark:text-blue-400 hover:bg-[var(--chat-item-hover)] cursor-pointer"
                >
                  Clear search
                </button>
              </>
            ) : filter === 'unread' ? (
              <>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  All caught up
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  You have no unread conversations.
                </p>
                <button
                  type="button"
                  onClick={() => onFilterChange?.('all')}
                  className="mt-3 min-h-10 px-4 py-2 rounded-full text-xs font-semibold text-[#0B6EFD] dark:text-blue-400 hover:bg-[var(--chat-item-hover)] cursor-pointer"
                >
                  Show all conversations
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  No conversations yet
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Start a secure chat with your {counterpartLabel} about appointments or dental care.
                </p>
                {contacts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsComposingNew(true)}
                    className="mt-4 min-h-10 px-4 py-2 rounded-full text-xs font-semibold text-white cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]"
                    style={{ backgroundColor: 'var(--chat-bubble-out-bg)' }}
                  >
                    Start a Conversation
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <ul role="list" className="space-y-1">
            {conversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              const hasUnread = Number(conv.unread_count || 0) > 0;
              const isTyping = Boolean(typingByConversation[conv.id]);
              const timestamp = formatConversationTimestamp(conv.last_message_at || conv.updated_at);

              return (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => onSelectConversation?.(conv.id)}
                    aria-current={isActive ? 'true' : undefined}
                    data-testid={`conversation-item-${conv.id}`}
                    className={`w-full min-h-[4.25rem] px-3 py-2.5 rounded-xl flex items-center gap-3 text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] ${
                      isActive
                        ? 'bg-[var(--chat-item-active)]'
                        : 'hover:bg-[var(--chat-item-hover)]'
                    }`}
                  >
                    <ParticipantAvatar
                      avatarUrl={conv.participant?.avatar_url}
                      initials={conv.participant?.initials}
                      name={conv.participant?.name}
                      isOnline={Boolean(conv.participant?.is_online)}
                      showOnlineDot={true}
                      size="md"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`text-sm truncate ${
                            hasUnread
                              ? 'font-bold text-[var(--text-primary)]'
                              : 'font-semibold text-[var(--text-primary)]'
                          }`}
                        >
                          {conv.participant?.name || 'Participant'}
                        </span>
                        {timestamp && (
                          <span
                            className={`text-[11px] shrink-0 ${
                              hasUnread
                                ? 'font-semibold text-[#0B6EFD] dark:text-blue-400'
                                : 'text-[var(--text-muted)]'
                            }`}
                          >
                            {timestamp}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p
                          className={`text-xs truncate ${
                            isTyping
                              ? 'font-medium text-[#0B6EFD] dark:text-blue-400 italic'
                              : hasUnread
                                ? 'font-semibold text-[var(--text-primary)]'
                                : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {isTyping
                            ? 'Typing...'
                            : conv.last_message_preview
                              ? `${conv.last_message_from_me ? 'You: ' : ''}${conv.last_message_preview}`
                              : conv.participant?.subtitle || 'Start the conversation'}
                        </p>

                        {hasUnread && (
                          <span
                            aria-label={`${conv.unread_count} unread messages`}
                            className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-bold text-white shrink-0"
                            style={{ backgroundColor: 'var(--chat-bubble-out-bg)' }}
                          >
                            {conv.unread_count > 99 ? '99+' : conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

export default ConversationSidebar;
