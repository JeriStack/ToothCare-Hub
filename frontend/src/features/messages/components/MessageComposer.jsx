import React, { useState, useRef, useId } from 'react';
import { Send, Loader2, Lock } from 'lucide-react';

const MAX_LENGTH = 2000;
const COUNTER_THRESHOLD = 1600;

export function MessageComposer({
  disabled = false,
  unavailableReason = null,
  onSend,
  onTyping,
}) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const formRef = useRef(null);
  const textareaRef = useRef(null);
  const inputId = useId();
  const errorId = useId();

  const trimmedLength = text.trim().length;
  const charCount = text.length;
  const isOverLimit = charCount > MAX_LENGTH;
  const canSubmit = !disabled && !submitting && trimmedLength > 0 && !isOverLimit;

  const handleChange = (e) => {
    const nextVal = e.target.value;
    setText(nextVal);
    if (nextVal.length <= MAX_LENGTH) {
      setValidationError('');
    } else {
      setValidationError(`Message exceeds the ${MAX_LENGTH.toLocaleString()} character limit.`);
    }
    if (nextVal.trim().length > 0 && !disabled) {
      onTyping?.();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (disabled || submitting) return;

    const clean = text.trim();
    if (!clean) {
      setValidationError('Enter a message before sending.');
      return;
    }
    if (clean.length > MAX_LENGTH) {
      setValidationError(`Message must be ${MAX_LENGTH.toLocaleString()} characters or fewer.`);
      return;
    }

    setValidationError('');
    setSubmitting(true);
    setText('');

    try {
      await onSend?.(clean);
    } finally {
      setSubmitting(false);
      textareaRef.current?.focus();
    }
  };

  /**
   * IME-safe Enter-to-submit (with Shift+Enter for newline).
   * Blocks submission during active IME composition and handles Safari's keyCode 229 ordering quirk.
   */
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (event.nativeEvent?.isComposing || event.isComposing || event.keyCode === 229) {
        return;
      }
      if (canSubmit && formRef.current) {
        if (typeof formRef.current.requestSubmit === 'function') {
          formRef.current.requestSubmit();
        } else {
          formRef.current.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }
    }
  };

  if (unavailableReason) {
    return (
      <div
        data-testid="composer-unavailable-banner"
        className="shrink-0 px-4 py-3 border-t border-[var(--chat-divider)] bg-[var(--chat-subtle-surface)] flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>{unavailableReason}</span>
      </div>
    );
  }

  return (
    <div
      className="shrink-0 px-3 sm:px-4 py-2.5 border-t border-[var(--chat-divider)] bg-[var(--chat-surface)]"
      style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom, 0px))' }}
    >
      {validationError && (
        <p id={errorId} role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400 mb-1.5 px-1">
          {validationError}
        </p>
      )}

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="flex items-end gap-2"
        noValidate
      >
        <div className="flex-1 min-w-0 relative">
          <label htmlFor={inputId} className="sr-only">
            Write a message
          </label>
          <textarea
            ref={textareaRef}
            id={inputId}
            rows={1}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Aa — Type a message..."
            aria-invalid={isOverLimit ? 'true' : undefined}
            aria-describedby={validationError ? errorId : undefined}
            className="tch-chat-textarea block rounded-2xl px-4 py-2.5 text-sm leading-5 bg-[var(--chat-composer-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border border-transparent focus:border-[var(--ring-focus)] focus:outline-none resize-none overflow-y-auto tch-chat-scroll disabled:opacity-60 transition-colors"
          />
          {charCount >= COUNTER_THRESHOLD && (
            <span
              aria-live="off"
              className={`block text-[11px] text-right mt-1 pr-1 ${
                isOverLimit
                  ? 'font-semibold text-rose-600 dark:text-rose-400'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              {charCount.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          aria-label="Send message"
          className="min-h-11 min-w-11 shrink-0 inline-flex items-center justify-center rounded-full text-white transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2"
          style={{ backgroundColor: 'var(--chat-bubble-out-bg)' }}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </form>
      <p className="hidden sm:block text-[10px] text-[var(--text-muted)] mt-1 px-1">
        Press Enter to send · Shift + Enter for a new line
      </p>
    </div>
  );
}

export default MessageComposer;
