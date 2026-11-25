import React from 'react';

/**
 * Highlights bracketed clinic/legal review markers (e.g., [PENDING CLINIC CONFIRMATION: ...])
 * without modifying or removing a single character of the original legal text.
 */
function renderVerbatimText(text) {
  const str = String(text ?? '');
  const parts = str.split(/(\[PENDING [^\]]+\])/g);
  if (parts.length === 1) return str;
  return parts.map((part, idx) => {
    if (part.startsWith('[PENDING ') && part.endsWith(']')) {
      return (
        <span
          key={idx}
          className="inline font-medium text-amber-900 dark:text-amber-200 bg-amber-100/75 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-[3px]"
        >
          {part}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

/**
 * Formats dense multi-clause enumerations such as "Intro: (a) ...; (b) ..."
 * into a structured indented list while preserving every character verbatim.
 */
function renderParagraphContent(paragraph) {
  const str = String(paragraph ?? '');
  const letteredMatch = /^(.*?:)\s+(\(a\)\s+[\s\S]+)$/.exec(str);

  if (letteredMatch && /\(b\)\s+/.test(letteredMatch[2])) {
    const intro = letteredMatch[1];
    const items = letteredMatch[2].split(/;\s+(?=\([a-z]\)\s+)/);

    if (items.length >= 2) {
      return (
        <div className="space-y-3">
          <p className="legal-prose text-justify hyphens-auto">{renderVerbatimText(intro)}</p>
          <ol className="space-y-2.5 pl-4 sm:pl-5 border-l-2 border-slate-200 dark:border-gray-700/80 list-none">
            {items.map((item, idx) => {
              const cleaned = idx < items.length - 1 ? `${item};` : item;
              const markerMatch = /^(\([a-z]\))\s+([\s\S]+)$/.exec(cleaned);
              if (markerMatch) {
                return (
                  <li key={idx} className="legal-prose flex items-start gap-2.5">
                    <span className="font-semibold text-[#12304A] dark:text-teal-300 tabular-nums shrink-0">
                      {markerMatch[1]}
                    </span>
                    <span className="min-w-0 flex-1 text-justify hyphens-auto">{renderVerbatimText(markerMatch[2])}</span>
                  </li>
                );
              }
              return (
                <li key={idx} className="legal-prose text-justify hyphens-auto">
                  {renderVerbatimText(cleaned)}
                </li>
              );
            })}
          </ol>
        </div>
      );
    }
  }

  return <p className="legal-prose text-justify hyphens-auto">{renderVerbatimText(str)}</p>;
}

/**
 * Splits leading section numbers (e.g., "1. Introduction") for clean tabular alignment
 * while keeping the exact heading string intact for screen readers and text matching.
 */
function renderSectionHeading(heading) {
  const str = String(heading ?? '');
  const match = /^(\d+\.)\s+([\s\S]+)$/.exec(str);
  if (!match) return str;
  return (
    <>
      <span className="text-[#0F766E] dark:text-teal-400 tabular-nums mr-1.5">{match[1]}</span>{' '}
      <span>{match[2]}</span>
    </>
  );
}

export function LegalDocumentSection({ section, isFirst = false }) {
  const paragraphs = Array.isArray(section?.paragraphs) ? section.paragraphs : [];
  const items = Array.isArray(section?.items) ? section.items : [];
  const subsections = Array.isArray(section?.subsections) ? section.subsections : [];

  return (
    <section
      id={section.id}
      className={`legal-section scroll-mt-24 ${
        isFirst
          ? 'pt-8'
          : 'pt-8 mt-8 border-t border-slate-200/80 dark:border-gray-700/75'
      }`}
    >
      <h2 className="legal-heading text-[1.125rem] sm:text-[1.25rem] font-semibold tracking-[-0.01em] leading-[1.35] text-[#12304A] dark:text-gray-50 mb-4">
        {renderSectionHeading(section.heading)}
      </h2>

      <div className="space-y-4 text-[0.9375rem] sm:text-[1rem] leading-[1.78] text-slate-700 dark:text-gray-300 break-words">
        {paragraphs.map((paragraph, index) => (
          <React.Fragment key={index}>{renderParagraphContent(paragraph)}</React.Fragment>
        ))}

        {items.length > 0 && (
          <ul className="list-disc pl-5 sm:pl-6 space-y-2 marker:text-slate-400 dark:marker:text-gray-500">
            {items.map((item, idx) => (
              <li key={idx} className="legal-prose text-justify hyphens-auto">
                {renderVerbatimText(item)}
              </li>
            ))}
          </ul>
        )}

        {subsections.map((sub, subIdx) => (
          <div key={sub.id || subIdx} id={sub.id || undefined} className="pt-3 space-y-2.5">
            {sub.heading && (
              <h3 className="legal-heading text-[0.9375rem] sm:text-[1.0625rem] font-semibold text-[#12304A] dark:text-gray-100 leading-[1.4]">
                {sub.heading}
              </h3>
            )}
            {(sub.paragraphs || []).map((p, pIdx) => (
              <React.Fragment key={pIdx}>{renderParagraphContent(p)}</React.Fragment>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export default LegalDocumentSection;
