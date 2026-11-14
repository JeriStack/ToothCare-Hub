import React, { useId, useRef } from 'react';
import { X } from 'lucide-react';
import { useDialogBehavior } from './DialogOverlay';

/**
 * Reusable Accessible Dialog / Modal Component adhering to ToothCare Hub Design System.
 *
 * Responsive behavior:
 * - Phones (< sm): anchored bottom-sheet, full width, rounded top corners.
 * - sm and up: centered dialog with size-based max width.
 * - Height is always constrained to the dynamic viewport (`dvh`); the header and footer stay
 *   visible while the body scrolls internally, so actions are never pushed off-screen.
 * - Footer actions stack full-width on phones and sit inline on sm+.
 *
 * @param {boolean} isOpen
 * @param {Function} onClose
 * @param {string} title
 * @param {string} subtitle
 * @param {'sm' | 'md' | 'lg' | 'xl'} size
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  className = '',
}) {
  const titleId = useId();
  const surfaceRef = useRef(null);

  // Focus in, Tab trap, Escape, scroll lock and focus restore (shared with DialogOverlay)
  useDialogBehavior(surfaceRef, { onClose, active: isOpen });

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
  }[size] || 'sm:max-w-lg';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Surface */}
      <div
        ref={surfaceRef}
        tabIndex={-1}
        className={`relative flex flex-col w-full ${sizeClasses} max-h-[100dvh] sm:max-h-[90dvh] bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-100 dark:border-gray-700 overflow-hidden z-10 focus:outline-none ${className}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 sm:p-6 border-b border-slate-100 dark:border-gray-700 shrink-0">
          <div className="min-w-0">
            {title && (
              <h3
                id={titleId}
                className="text-base sm:text-lg font-bold text-[#12304A] dark:text-gray-50 tracking-tight break-words"
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 break-words">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="shrink-0 -mt-1.5 -mr-1.5 sm:mt-0 sm:mr-0 inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 rounded-lg text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-100 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content Body (scrolls internally; header/footer stay visible) */}
        <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto overscroll-contain text-slate-700 dark:text-gray-200">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 px-4 py-3 sm:px-6 sm:py-4 bg-slate-50/80 dark:bg-gray-900/60 border-t border-slate-100 dark:border-gray-700 shrink-0 [&>*]:w-full sm:[&>*]:w-auto">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
