import React, { useEffect, useId, useRef } from 'react';

/**
 * Shared modal-dialog behaviour for every overlay in the app.
 *
 * - Moves focus into the dialog on open (to the dialog container, so phones don't pop the keyboard).
 * - Traps Tab / Shift+Tab inside the dialog.
 * - Escape closes the top-most dialog only (nested dialogs are stacked).
 * - Locks background scrolling while any dialog is open (reference-counted).
 * - Restores focus to the element that opened the dialog when it closes.
 *
 * Layout and styling stay with the caller; this hook adds behaviour only.
 */
const openStack = [];
let scrollLocks = 0;
let savedBodyOverflow = '';

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function focusableWithin(root) {
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter((el) => {
    if (el.closest('[inert]')) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0 || el === document.activeElement;
  });
}

export function useDialogBehavior(ref, { onClose, dismissible = true, active = true } = {}) {
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;

  useEffect(() => {
    const node = ref.current;
    if (!active || !node || typeof document === 'undefined') return undefined;

    const previouslyFocused = document.activeElement;
    const token = {};
    openStack.push(token);

    if (scrollLocks === 0) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    scrollLocks += 1;

    if (!node.contains(document.activeElement)) {
      if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
      node.focus({ preventScroll: true });
    }

    const handleKeyDown = (event) => {
      if (openStack[openStack.length - 1] !== token) return;

      if (event.key === 'Escape') {
        if (!dismissibleRef.current || !onCloseRef.current) return;
        event.stopPropagation();
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const items = focusableWithin(node);
      if (items.length === 0) {
        event.preventDefault();
        node.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      const outside = !node.contains(current);
      if (event.shiftKey && (current === first || current === node || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };

    // Capture phase so page-level Escape handlers (e.g. menus) don't also fire.
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      const index = openStack.indexOf(token);
      if (index !== -1) openStack.splice(index, 1);
      scrollLocks = Math.max(0, scrollLocks - 1);
      if (scrollLocks === 0) document.body.style.overflow = savedBodyOverflow;
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [ref, active]);
}

/**
 * Drop-in replacement for a hand-built `<div className="fixed inset-0 ...">` overlay.
 * Adds `role="dialog"`, `aria-modal`, an accessible name (from `aria-label`, `aria-labelledby`,
 * or the first heading inside), and the behaviour from `useDialogBehavior`.
 */
export function DialogOverlay({
  onClose,
  dismissible = true,
  className = '',
  children,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...rest
}) {
  const ref = useRef(null);
  const fallbackId = useId();
  useDialogBehavior(ref, { onClose, dismissible });

  // Name the dialog after its first heading when the caller didn't provide a name.
  useEffect(() => {
    const node = ref.current;
    if (!node || ariaLabel || ariaLabelledBy) return;
    const heading = node.querySelector('h1, h2, h3, h4');
    if (!heading) return;
    if (!heading.id) heading.id = `${fallbackId}-title`;
    node.setAttribute('aria-labelledby', heading.id);
  }, [ariaLabel, ariaLabelledBy, fallbackId]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      tabIndex={-1}
      data-dialog-overlay=""
      {...rest}
      className={`focus:outline-none ${className}`}
    >
      {children}
    </div>
  );
}

export default DialogOverlay;
