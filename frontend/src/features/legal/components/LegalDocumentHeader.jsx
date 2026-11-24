import React, { useState } from 'react';
import { Printer, Link2, Check, AlertTriangle } from 'lucide-react';

export function formatLegalDate(rawDate) {
  if (!rawDate) return 'Pending confirmation';
  const normalized = String(rawDate).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return normalized;
  const dateObj = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(dateObj.getTime())) return normalized;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function LegalDocumentHeader({
  documentData,
  docTitle,
  isPrivacy,
  introduction,
  draftNotice,
  loadError,
}) {
  const [copied, setCopied] = useState(false);

  const version = documentData?.version || '1.0';
  const effectiveDate = formatLegalDate(documentData?.effective_date);
  const lastUpdated = formatLegalDate(
    documentData?.updated_at || documentData?.published_at || documentData?.effective_date
  );
  const isApproved = Boolean(documentData?.is_approved);
  const publicationStatus = isApproved
    ? 'Published'
    : 'Draft — Pending Approval';

  const handlePrint = () => {
    window.print?.();
  };

  const handleCopyLink = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (!url) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const tempInput = document.createElement('input');
        tempInput.value = url;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <header className="pb-8 border-b border-slate-200 dark:border-gray-700/80">
      {/* Institutional Publisher Line */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/images/logo-icon.png"
            alt=""
            aria-hidden="true"
            width="24"
            height="24"
            decoding="async"
            className="w-6 h-6 object-contain shrink-0"
          />
          <p className="text-xs font-medium tracking-wide text-slate-500 dark:text-gray-400">
            ToothCare Hub — Dental Appointment and Clinic Management System
          </p>
        </div>

        {/* Document Utilities (hidden in print) */}
        <div className="legal-no-print flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="tch-tap inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-gray-700 bg-transparent hover:bg-slate-50 dark:hover:bg-gray-800 text-xs font-medium text-slate-600 dark:text-gray-300 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488]"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500 dark:text-gray-400" aria-hidden="true" />
            <span>Print</span>
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="tch-tap inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-gray-700 bg-transparent hover:bg-slate-50 dark:hover:bg-gray-800 text-xs font-medium text-slate-600 dark:text-gray-300 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488]"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-[#0D9488] dark:text-teal-400" aria-hidden="true" />
            ) : (
              <Link2 className="w-3.5 h-3.5 text-slate-500 dark:text-gray-400" aria-hidden="true" />
            )}
            <span>{copied ? 'Link copied' : 'Copy link'}</span>
          </button>
          <span className="sr-only" role="status" aria-live="polite">
            {copied ? `${docTitle} link copied to clipboard.` : ''}
          </span>
        </div>
      </div>

      {/* Document Classification & Title */}
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[#0F766E] dark:text-teal-400 mb-2">
        {isPrivacy ? 'Official Privacy Notice' : 'Official Terms & Conditions'}
      </p>
      <h1
        id="legal-document-title"
        tabIndex={-1}
        className="legal-heading text-[1.75rem] sm:text-[2.125rem] font-bold tracking-[-0.02em] leading-[1.2] text-[#12304A] dark:text-gray-50 focus:outline-none"
      >
        {docTitle}
      </h1>

      {introduction && (
        <p className="legal-prose mt-4 text-[0.9375rem] sm:text-base leading-[1.78] text-slate-600 dark:text-gray-300 text-justify hyphens-auto">
          {introduction}
        </p>
      )}

      {/* Formal Metadata Ledger */}
      <dl
        aria-label="Document metadata"
        className="mt-6 pt-5 border-t border-slate-200/80 dark:border-gray-700/80 grid grid-cols-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-x-6 gap-y-4 text-[0.8125rem]"
      >
        <div>
          <dt className="text-[0.72rem] font-medium uppercase tracking-wider text-slate-500 dark:text-gray-400">
            Document Version
          </dt>
          <dd className="mt-1 font-semibold text-slate-900 dark:text-gray-100 tabular-nums">
            v{version}
          </dd>
        </div>
        <div>
          <dt className="text-[0.72rem] font-medium uppercase tracking-wider text-slate-500 dark:text-gray-400">
            Effective Date
          </dt>
          <dd className="mt-1 font-semibold text-slate-900 dark:text-gray-100">
            {effectiveDate}
          </dd>
        </div>
        <div>
          <dt className="text-[0.72rem] font-medium uppercase tracking-wider text-slate-500 dark:text-gray-400">
            Last Updated
          </dt>
          <dd className="mt-1 font-semibold text-slate-900 dark:text-gray-100">
            {lastUpdated}
          </dd>
        </div>
        <div>
          <dt className="text-[0.72rem] font-medium uppercase tracking-wider text-slate-500 dark:text-gray-400">
            Publication Status
          </dt>
          <dd className="mt-1">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap border ${
                isApproved
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/25'
                  : 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-500/25'
              }`}
            >
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                  isApproved
                    ? 'bg-emerald-600 dark:bg-emerald-400'
                    : 'bg-amber-500 dark:bg-amber-400'
                }`}
                aria-hidden="true"
              />
              <span>{publicationStatus}</span>
            </span>
          </dd>
        </div>
      </dl>

      {/* Restrained Formal Draft / Pending Approval Notice */}
      {(!isApproved || draftNotice) && (
        <div
          role="note"
          className="legal-notice mt-6 rounded-xl border border-amber-200/90 dark:border-amber-500/25 border-l-4 border-l-amber-500 dark:border-l-amber-400 bg-amber-50/75 dark:bg-amber-500/[0.08] px-5 py-4 text-[0.875rem] leading-[1.72] text-amber-950 dark:text-amber-100"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="font-semibold text-[0.78rem] uppercase tracking-[0.07em] text-amber-900 dark:text-amber-300">
                Draft — Pending Clinic &amp; Legal/Privacy Approval
              </p>
              <p className="text-amber-950/90 dark:text-amber-100/90 legal-prose text-justify hyphens-auto">
                {draftNotice ||
                  'This document is a structured draft aligned with current ToothCare Hub software capabilities and requires formal review and approval by clinic leadership and a qualified legal/privacy adviser prior to production publication.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {loadError && (
        <p
          role="status"
          className="legal-no-print mt-4 text-xs text-slate-500 dark:text-gray-400"
        >
          Showing bundled document version v{version} while live policy metadata could not be reached.
        </p>
      )}
    </header>
  );
}

export default LegalDocumentHeader;
