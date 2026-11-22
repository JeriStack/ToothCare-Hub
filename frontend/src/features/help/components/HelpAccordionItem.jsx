import React, { useEffect, useRef } from 'react';
import { ChevronDown, BookOpen, Info } from 'lucide-react';

const CATEGORY_LABELS = {
  account: 'Account & Login',
  appointments: 'Appointments',
  services: 'Dental Services',
  notifications: 'Notifications',
  general: 'General',
};

/**
 * Accessible non-exclusive FAQ accordion item.
 *
 * Uses a native <button> inside an <h3> so screen reader users can navigate
 * directly by heading, pairs it with `hidden="until-found"` and a `beforematch`
 * listener so native browser Find-in-page reveals collapsed answers, and keeps
 * the disclosure marker adjacent to the question text.
 */
export function HelpAccordionItem({
  faq,
  isOpen,
  onToggle,
  onForceOpen,
  relatedGuides = [],
  onSelectGuide,
}) {
  const panelRef = useRef(null);
  const buttonId = `help-faq-btn-${faq.id}`;
  const panelId = `help-faq-panel-${faq.id}`;

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return undefined;

    const supportsUntilFound = 'onbeforematch' in HTMLElement.prototype;

    if (isOpen) {
      panel.removeAttribute('hidden');
    } else if (supportsUntilFound) {
      panel.setAttribute('hidden', 'until-found');
    } else {
      panel.setAttribute('hidden', '');
    }

    const handleBeforeMatch = () => {
      onForceOpen?.(faq.id);
    };

    panel.addEventListener('beforematch', handleBeforeMatch);
    return () => {
      panel.removeEventListener('beforematch', handleBeforeMatch);
    };
  }, [faq.id, isOpen, onForceOpen]);

  return (
    <article
      id={faq.id}
      className="bg-white dark:bg-gray-800 border border-slate-200/90 dark:border-gray-700/80 rounded-2xl transition-colors shadow-2xs hover:border-[#0D9488]/40 dark:hover:border-teal-400/40"
    >
      <h3 className="m-0">
        <button
          id={buttonId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => onToggle(faq.id)}
          className="w-full min-h-14 text-left px-5 py-4 sm:px-6 sm:py-5 flex items-start gap-3.5 rounded-2xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 focus-visible:ring-inset"
        >
          <span
            aria-hidden="true"
            className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 border transition-transform duration-200 motion-reduce:transition-none ${
              isOpen
                ? 'rotate-180 bg-[#CCFBF1] dark:bg-teal-500/20 border-[#0D9488]/35 dark:border-teal-400/45 text-[#0F766E] dark:text-teal-300'
                : 'bg-slate-50 dark:bg-gray-900 border-slate-200 dark:border-gray-600 text-slate-500 dark:text-gray-300'
            }`}
          >
            <ChevronDown className="w-4 h-4" />
          </span>

          <span className="flex-1 min-w-0 space-y-1.5">
            <span className="block font-bold text-slate-900 dark:text-gray-100 text-sm sm:text-base leading-snug">
              {faq.question}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-gray-900/80 text-slate-600 dark:text-gray-300 border border-slate-200/80 dark:border-gray-700">
              {CATEGORY_LABELS[faq.category] || 'General'}
            </span>
          </span>
        </button>
      </h3>

      {/* Border, padding, and background live on the nested wrapper so hidden="until-found" never leaves remnants */}
      <div id={panelId} ref={panelRef} role="region" aria-labelledby={buttonId}>
        <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-3 border-t border-slate-100 dark:border-gray-700/80 space-y-4">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-normal">
            {faq.answer}
          </p>

          {faq.requiresClinicConfirmation && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-400/30 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-300" aria-hidden="true" />
              <span>
                Specific clinic policies or exceptions may be updated by clinic administration. Contact reception to confirm details for your visit.
              </span>
            </div>
          )}

          {relatedGuides.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
                Related Guide:
              </span>
              {relatedGuides.map((guide) => (
                <button
                  key={guide.id}
                  type="button"
                  onClick={() => onSelectGuide?.(guide.id)}
                  className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-200 border border-[#0D9488]/25 dark:border-teal-400/35 hover:bg-teal-100 dark:hover:bg-teal-500/25 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
                >
                  <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{guide.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default HelpAccordionItem;
