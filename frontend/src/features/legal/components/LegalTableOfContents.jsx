import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Shared Table of Contents for formal legal documents.
 * - Derives links automatically from the document sections array.
 * - Desktop: subordinate sticky outline rail with IntersectionObserver scroll-spy and minimize/expand toggle.
 * - Mobile: native collapsible <details> disclosure above the document that collapses on selection.
 */
export function LegalTableOfContents({ sections = [], variant = 'desktop' }) {
  const [activeId, setActiveId] = useState(() => (sections[0]?.id ? sections[0].id : ''));
  const [isMinimized, setIsMinimized] = useState(false);
  const detailsRef = useRef(null);

  useEffect(() => {
    if (!sections.length) {
      setActiveId('');
      return undefined;
    }
    setActiveId(sections[0].id);

    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    const elements = sections
      .map((s) => document.getElementById(s.id))
      .filter(Boolean);

    if (!elements.length) return undefined;

    const visibleMap = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibleMap.set(entry.target.id, entry.isIntersecting);
        }
        const firstVisible = sections.find((s) => visibleMap.get(s.id));
        if (firstVisible) {
          setActiveId(firstVisible.id);
        }
      },
      {
        rootMargin: '-18% 0px -65% 0px',
        threshold: [0, 0.1],
      }
    );

    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [sections]);

  if (!sections.length) return null;

  const handleLinkClick = (sectionId) => {
    setActiveId(sectionId);
    if (variant === 'mobile' && detailsRef.current) {
      detailsRef.current.open = false;
    }
  };

  if (variant === 'mobile') {
    return (
      <details
        ref={detailsRef}
        className="legal-no-print legal-details lg:hidden mb-6 rounded-lg bg-surface border border-line"
      >
        <summary className="legal-details-summary tch-tap px-4 py-3 text-[0.875rem] font-semibold text-[#12304A] dark:text-gray-100 select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488] rounded-lg">
          <span>Table of Contents</span>
          <span className="text-xs font-normal text-slate-500 dark:text-gray-400">
            ({sections.length} sections)
          </span>
        </summary>
        <div className="px-4 pb-4 pt-2 border-t border-slate-200/80 dark:border-gray-700/80">
          <nav aria-label="Document sections">
            <ol className="space-y-1 text-[0.875rem]">
              {sections.map((section) => {
                const isActive = activeId === section.id;
                return (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      aria-current={isActive ? 'location' : undefined}
                      onClick={() => handleLinkClick(section.id)}
                      className={`tch-tap block py-1.5 pl-3 border-l-2 transition-colors rounded-r focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488] ${
                        isActive
                          ? 'border-[#0D9488] dark:border-teal-400 font-semibold text-[#12304A] dark:text-teal-300'
                          : 'border-transparent text-slate-600 dark:text-gray-300 hover:text-[#12304A] dark:hover:text-white hover:border-slate-300 dark:hover:border-gray-600'
                      }`}
                    >
                      {section.heading}
                    </a>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>
      </details>
    );
  }

  const activeSection = sections.find((s) => s.id === activeId) || sections[0];

  return (
    <aside className="legal-no-print hidden lg:block sticky top-24 self-start">
      <div className={isMinimized ? 'rounded-xl border border-slate-200/80 dark:border-gray-700/80 bg-surface/80 p-3 transition-colors' : ''}>
        <div className={`flex items-center justify-between gap-2 ${isMinimized ? '' : 'mb-3 pl-4 pr-1'}`}>
          <p
            id="legal-toc-heading"
            className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-gray-400"
          >
            On this page
          </p>
          <button
            type="button"
            onClick={() => setIsMinimized((prev) => !prev)}
            aria-expanded={!isMinimized}
            aria-controls="legal-toc-list"
            aria-label={isMinimized ? 'Expand table of contents' : 'Minimize table of contents'}
            title={isMinimized ? 'Expand table of contents' : 'Minimize table of contents'}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[0.6875rem] font-medium text-slate-500 dark:text-gray-400 hover:text-[#12304A] dark:hover:text-gray-100 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488]"
          >
            <span>{isMinimized ? 'Expand' : 'Minimize'}</span>
            {isMinimized ? (
              <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            )}
          </button>
        </div>

        {isMinimized ? (
          <p className="mt-1.5 text-xs text-slate-600 dark:text-gray-300 truncate">
            <span className="text-[#0F766E] dark:text-teal-400 font-semibold">{activeSection?.heading}</span>
            <span className="text-slate-400 dark:text-gray-500"> · {sections.length} sections</span>
          </p>
        ) : (
          <nav
            id="legal-toc-list"
            aria-label="Table of Contents"
            className="max-h-[calc(100dvh-9rem)] overflow-y-auto pr-2"
          >
            <ol className="border-l border-slate-200 dark:border-gray-700/80 space-y-1 text-[0.8125rem] leading-[1.45]">
              {sections.map((section) => {
                const isActive = activeId === section.id;
                return (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      aria-current={isActive ? 'location' : undefined}
                      onClick={() => handleLinkClick(section.id)}
                      className={`legal-toc-link block py-1.5 -ml-px pl-4 border-l-2 transition-colors rounded-r focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488] ${
                        isActive
                          ? 'legal-toc-link-active border-[#0D9488] dark:border-teal-400 font-semibold text-[#12304A] dark:text-teal-300'
                          : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-[#12304A] dark:hover:text-gray-100 hover:border-slate-300 dark:hover:border-gray-600'
                      }`}
                    >
                      {section.heading}
                    </a>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
      </div>
    </aside>
  );
}

export default LegalTableOfContents;
