import React, { useEffect, useState } from 'react';
import { FileText, Shield, AlertCircle, Loader2, LogOut, ChevronDown, ChevronUp } from 'lucide-react';
import legalApi from '../api';
import { DialogOverlay } from '../../../components/ui/DialogOverlay';

export function LegalReacceptanceModal({ isOpen, onCompleted, onSignOut }) {
  const [pendingDocs, setPendingDocs] = useState([]);
  const [checkedMap, setCheckedMap] = useState({});
  const [expandedMap, setExpandedMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    setIsLoading(true);
    setError(null);

    legalApi
      .getMyAcceptances({ background: true })
      .then((data) => {
        if (!active) return;
        const docs = Array.isArray(data?.pending_documents) ? data.pending_documents : [];
        setPendingDocs(docs);
        const initialChecked = {};
        const initialExpanded = {};
        docs.forEach((doc, idx) => {
          initialChecked[doc.document_type] = false;
          initialExpanded[doc.document_type] = idx === 0;
        });
        setCheckedMap(initialChecked);
        setExpandedMap(initialExpanded);
      })
      .catch(() => {
        if (active) {
          setError('Unable to load updated legal documents. Please refresh and try again.');
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const allChecked =
    pendingDocs.length > 0 && pendingDocs.every((doc) => Boolean(checkedMap[doc.document_type]));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!allChecked) {
      setError('Please review and confirm each updated legal document before continuing.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = pendingDocs.map((doc) => ({
        document_type: doc.document_type,
        document_version: doc.version,
        acceptance_action: doc.required_action,
        accepted: true,
      }));
      await legalApi.submitAcceptances(payload);
      onCompleted?.();
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Could not record your policy confirmation. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogOverlay
      onClose={() => {}}
      className="fixed inset-0 z-[70] bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-reacceptance-title"
        className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-800 dark:text-gray-100 rounded-2xl max-w-2xl w-full max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-700 bg-slate-50/80 dark:bg-gray-900/60">
          <h2 id="legal-reacceptance-title" className="text-base sm:text-lg font-bold text-[#12304A] dark:text-white">
            Updated Legal Documents Require Your Confirmation
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-gray-300 leading-relaxed">
            A material update has been published. Please review the updated version(s) below and confirm your agreement or acknowledgment to continue using your ToothCare Hub account. Your previous acceptance history remains preserved.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-10 flex flex-col items-center justify-center gap-2 text-xs text-slate-500 dark:text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin text-[#0D9488]" aria-hidden="true" />
              <span>Loading updated legal documents...</span>
            </div>
          ) : (
            pendingDocs.map((doc) => {
              const isPrivacy = doc.document_type === 'PRIVACY_POLICY';
              const isExpanded = Boolean(expandedMap[doc.document_type]);
              const sections = Array.isArray(doc.content?.sections) ? doc.content.sections : [];

              return (
                <div
                  key={doc.document_type}
                  className="rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-900/50 overflow-hidden"
                >
                  <div className="p-4 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#E6F7F5] dark:bg-teal-900/50 text-[#0D9488] dark:text-teal-300 flex items-center justify-center shrink-0">
                        {isPrivacy ? <Shield className="w-4 h-4" aria-hidden="true" /> : <FileText className="w-4 h-4" aria-hidden="true" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[#12304A] dark:text-white">
                          {doc.title} <span className="text-[#0D9488] dark:text-teal-400">v{doc.version}</span>
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
                          Effective date: {doc.effective_date}
                          {doc.change_summary ? ` — ${doc.change_summary}` : ''}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setExpandedMap((prev) => ({
                          ...prev,
                          [doc.document_type]: !prev[doc.document_type],
                        }))
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[11px] font-semibold text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 shrink-0"
                    >
                      <span>{isExpanded ? 'Hide text' : 'Read document'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <div className="max-h-48 overflow-y-auto rounded-lg bg-white dark:bg-gray-900 border border-slate-200/80 dark:border-gray-700 p-3.5 text-xs text-slate-700 dark:text-gray-300 space-y-2.5 leading-relaxed">
                        {doc.content?.introduction && <p className="font-medium">{doc.content.introduction}</p>}
                        {sections.map((section) => (
                          <div key={section.id} className="space-y-1">
                            <p className="font-bold text-[#12304A] dark:text-white">{section.heading}</p>
                            {(section.paragraphs || []).map((p, idx) => (
                              <p key={idx}>{p}</p>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="px-4 py-3 bg-white dark:bg-gray-800/80 border-t border-slate-200 dark:border-gray-700">
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700 dark:text-gray-200 select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(checkedMap[doc.document_type])}
                        onChange={(e) => {
                          setCheckedMap((prev) => ({
                            ...prev,
                            [doc.document_type]: e.target.checked,
                          }));
                          setError(null);
                        }}
                        className="tch-check mt-0.5 rounded border-slate-300 dark:border-gray-600 text-[#0D9488] focus:ring-[#0D9488]"
                      />
                      <span>
                        {isPrivacy
                          ? `I acknowledge that I have read the updated ToothCare Hub Privacy Policy (v${doc.version}).`
                          : `I agree to the updated ToothCare Hub Terms of Service (v${doc.version}).`}
                      </span>
                    </label>
                  </div>
                </div>
              );
            })
          )}

          <div className="pt-3 border-t border-slate-200 dark:border-gray-700 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={onSignOut}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700 text-xs font-semibold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>

            <button
              type="submit"
              disabled={isLoading || isSubmitting || pendingDocs.length === 0}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  <span>Recording confirmation...</span>
                </>
              ) : (
                <span>Confirm &amp; Continue</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </DialogOverlay>
  );
}

export default LegalReacceptanceModal;
