import React from 'react';
import { useAuth } from '../../auth';
import { useMessaging } from '../hooks/useMessaging';
import { ConversationSidebar } from '../components/ConversationSidebar';
import { MessageThread } from '../components/MessageThread';

/**
 * Messenger-Style Patient-Dentist Messaging Page
 * - Desktop (lg+): Two-panel split layout (Conversation Sidebar + Active Conversation)
 * - Mobile (< lg): Full-screen conversation list transitioning to full-screen chat with clear back navigation
 */
export function MessagesPage() {
  const { user } = useAuth();
  const currentRole = String(user?.role || 'PATIENT').toUpperCase();

  const {
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
    isOtherTyping,
    typingByConversation,
    startingChat,
    startChatError,
    clearStartChatError,
    connectionStatus,
    announcement,
    fetchConversations,
    selectConversation,
    loadOlderMessages,
    startConversationWithContact,
    sendMessage,
    retryFailedMessage,
    notifyTypingActivity,
    reloadActiveMessages,
  } = useMessaging({ user });

  const showMobileThread = Boolean(activeConversationId);

  return (
    <div
      data-testid="messages-workspace"
      className="w-full h-[calc(100dvh-7.5rem)] sm:h-[calc(100dvh-8.5rem)] min-h-[30rem] rounded-2xl border border-[var(--chat-divider)] bg-[var(--chat-surface)] shadow-sm overflow-hidden flex min-w-0"
    >
      {/* Centralized polite screen-reader announcement region */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Left Panel: Conversation Sidebar (full-screen on mobile when no chat selected; fixed 320–360px on desktop) */}
      <div
        className={`${
          showMobileThread ? 'hidden lg:flex' : 'flex'
        } w-full lg:w-80 xl:w-[22rem] shrink-0 h-full min-h-0`}
      >
        <ConversationSidebar
          conversations={conversations}
          contacts={contacts}
          totalUnread={totalUnread}
          loading={loadingConversations}
          error={conversationsError}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filter={filter}
          onFilterChange={setFilter}
          activeConversationId={activeConversationId}
          typingByConversation={typingByConversation}
          startingChat={startingChat}
          startChatError={startChatError}
          onClearStartChatError={clearStartChatError}
          currentUserRole={currentRole}
          onSelectConversation={selectConversation}
          onStartWithContact={startConversationWithContact}
          onRetry={() => fetchConversations()}
        />
      </div>

      {/* Right Panel: Active Conversation (full-screen on mobile when selected; flex-1 on desktop) */}
      <div
        className={`${
          showMobileThread ? 'flex' : 'hidden lg:flex'
        } flex-1 min-w-0 h-full min-h-0`}
      >
        <MessageThread
          conversation={activeConversation}
          messages={messages}
          loading={loadingMessages}
          loadingOlder={loadingOlder}
          error={messagesError}
          hasMoreOlder={hasMoreOlder}
          isOtherTyping={isOtherTyping}
          connectionStatus={connectionStatus}
          onBack={() => selectConversation(null)}
          onLoadOlder={loadOlderMessages}
          onSendMessage={sendMessage}
          onRetryMessage={retryFailedMessage}
          onTyping={notifyTypingActivity}
          onReload={reloadActiveMessages}
        />
      </div>
    </div>
  );
}

export default MessagesPage;
