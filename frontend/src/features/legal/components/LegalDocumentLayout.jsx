import React, { useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  FileText,
  Shield,
  AlertTriangle,
  List,
  Mail,
  Phone,
  MapPin,
  Clock,
  LogIn,
  User,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../auth';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';
import { LandingFooter } from '../../landing/components/LandingFooter';
import { CLINIC_CONTACT } from '../../help/data/clinicContact';

function formatDisplayDate(rawDate) {
  if (!rawDate) return 'Pending confirmation';
  const normalized = String(rawDate).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return normalized;
  const dateObj = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (isNaN(dateObj.getTime())) return normalized;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function LegalDocumentLayout({
  documentData,
  isLoading,
  loadError,
  activeType, // 'TERMS_OF_SERVICE' | 'PRIVACY_POLICY'
  cameFromRegister = false,
  onNavigateHome,
  onNavigateRegister,
  onNavigateLogin,
  onNavigateTerms,
  onNavigatePrivacy,
  onHelpSupport,
  onBookAppointment,
  onAdminLogin,
  onNavigateLandingSection,
}) {
  const { user, isAuthenticated } = useAuth();
  const isPrivacy = activeType === 'PRIVACY_POLICY';
  const docTitle = documentData?.title || (isPrivacy ? 'Privacy Policy' : 'Terms of Service');
  const sections = Array.isArray(documentData?.content?.sections) ? documentData.content.sections : [];
  const draftNotice = documentData?.content?.draft_notice || null;
  const introduction = documentData?.content?.introduction || '';

  useEffect(() => {
    const prevTitle = document.title;
    document.title = `${docTitle} — ToothCare Hub`;
    window.scrollTo?.({ top: 0, behavior: 'auto' });
    return () => {
      document.title = prevTitle;
    };
  }, [docTitle]);

  return (
    <div className="min-h-dvh flex flex-col bg-[#F5F8FA] dark:bg-gray-900 text-slate-800 dark:text-gray-100 font-sans overflow-x-clip transition-colors">
      <a
        href="#legal-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#12304A] dark:focus:bg-teal-700 focus:text-white focus:text-xs focus:font-semibold focus:shadow-lg"
      >
        Skip to document content
      </a>

      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-gray-800 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigateHome?.();
              }}
              className="flex items-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded-lg shrink-0"
            >
              <img
                src="/images/logo-icon.png"
                alt="ToothCare Hub Emblem"
                width="36"
                height="36"
                decoding="async"
                className="w-9 h-9 object-contain"
              />
              <span className="font-bold text-base sm:text-lg tracking-tight text-[#12304A] dark:text-white whitespace-nowrap">
                Tooth<span className="text-[#0D9488] dark:text-teal-400">Care</span> Hub
              </span>
            </a>

            <nav aria-label="Legal documents navigation" className="hidden md:flex items-center gap-1 ml-2 pl-3 border-l border-slate-200 dark:border-gray-700">
              <a
                href="/terms-of-service"
                aria-current={!isPrivacy ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigateTerms?.();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
                  !isPrivacy
                    ? 'bg-[#CCFBF1] dark:bg-teal-500/20 text-[#0F766E] dark:text-teal-200'
                    : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800'
                }`}
              >
                Terms of Service
              </a>
              <a
                href="/privacy-policy"
                aria-current={isPrivacy ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigatePrivacy?.();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
                  isPrivacy
                    ? 'bg-[#CCFBF1] dark:bg-teal-500/20 text-[#0F766E] dark:text-teal-200'
                    : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800'
                }`}
              >
                Privacy Policy
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle variant="surface" />
            {cameFromRegister && (
              <button
                type="button"
                onClick={onNavigateRegister}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#0D9488] hover:bg-[#0F766E] text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Back to Registration</span>
              </button>
            )}
            {!cameFromRegister && (
              <button
                type="button"
                onClick={onNavigateLogin}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#0D9488]/30 dark:border-teal-400/40 bg-teal-50/90 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-500/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
              >
                {isAuthenticated ? <User className="w-3.5 h-3.5" aria-hidden="true" /> : <LogIn className="w-3.5 h-3.5" aria-hidden="true" />}
                <span>{isAuthenticated ? (user?.first_name || 'Portal') : 'Sign In'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="legal-main-content" className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Top Action Breadcrumb Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigateHome?.();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-gray-300 hover:text-[#0D9488] dark:hover:text-teal-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded-md px-1 py-0.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Back to Home</span>
            </a>
            {!isAuthenticated && (
              <>
                <span className="text-slate-300 dark:text-gray-600" aria-hidden="true">•</span>
                <a
                  href="/register"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigateRegister?.();
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D9488] dark:text-teal-400 hover:text-[#0F766E] dark:hover:text-teal-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded-md px-1 py-0.5"
                >
                  <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{cameFromRegister ? 'Return to Patient Registration' : 'Patient Registration'}</span>
                </a>
              </>
            )}
          </div>

          {/* Mobile Document Switcher */}
          <div className="flex md:hidden items-center gap-1.5">
            <a
              href="/terms-of-service"
              aria-current={!isPrivacy ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                onNavigateTerms?.();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                !isPrivacy
                  ? 'bg-[#CCFBF1] dark:bg-teal-500/20 border-[#0D9488]/30 text-[#0F766E] dark:text-teal-200'
                  : 'bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300'
              }`}
            >
              Terms
            </a>
            <a
              href="/privacy-policy"
              aria-current={isPrivacy ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                onNavigatePrivacy?.();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                isPrivacy
                  ? 'bg-[#CCFBF1] dark:bg-teal-500/20 border-[#0D9488]/30 text-[#0F766E] dark:text-teal-200'
                  : 'bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300'
              }`}
            >
              Privacy
            </a>
          </div>
        </div>

        {/* Hero / Document Metadata Card */}
        <section className="rounded-2xl bg-white dark:bg-gray-800 border border-slate-200/90 dark:border-gray-700 p-6 sm:p-8 shadow-sm mb-6">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#E6F7F5] dark:bg-teal-900/50 text-[#0D9488] dark:text-teal-300 flex items-center justify-center shrink-0">
              {isPrivacy ? <Shield className="w-5 h-5" aria-hidden="true" /> : <FileText className="w-5 h-5" aria-hidden="true" />}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#12304A] dark:text-white">
                {docTitle}
              </h1>
              {introduction && (
                <p className="mt-2.5 text-sm text-slate-600 dark:text-gray-300 leading-relaxed max-w-3xl">
                  {introduction}
                </p>
              )}
            </div>
          </div>

          {/* Version, Effective Date & Status Metadata */}
          <dl className="mt-5 pt-5 border-t border-slate-100 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200/70 dark:border-gray-700">
              <FileText className="w-4 h-4 text-[#0D9488] dark:text-teal-400 shrink-0" aria-hidden="true" />
              <div>
                <dt className="text-[11px] text-slate-500 dark:text-gray-400">Document Version</dt>
                <dd className="font-bold text-slate-800 dark:text-gray-100">v{documentData?.version || '1.0'}</dd>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200/70 dark:border-gray-700">
              <Calendar className="w-4 h-4 text-[#0D9488] dark:text-teal-400 shrink-0" aria-hidden="true" />
              <div>
                <dt className="text-[11px] text-slate-500 dark:text-gray-400">Effective Date</dt>
                <dd className="font-bold text-slate-800 dark:text-gray-100">{formatDisplayDate(documentData?.effective_date)}</dd>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200/70 dark:border-gray-700">
              <Clock className="w-4 h-4 text-[#0D9488] dark:text-teal-400 shrink-0" aria-hidden="true" />
              <div>
                <dt className="text-[11px] text-slate-500 dark:text-gray-400">Last Updated</dt>
                <dd className="font-bold text-slate-800 dark:text-gray-100">{formatDisplayDate(documentData?.updated_at || documentData?.published_at || documentData?.effective_date)}</dd>
              </div>
            </div>
          </dl>

          {/* Draft / Pending Clinic & Legal Review Notice */}
          {(!documentData?.is_approved || draftNotice) && (
            <div
              role="note"
              className="mt-5 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-bold uppercase tracking-wide text-[11px]">
                  Draft — Pending Clinic &amp; Legal/Privacy Approval
                </p>
                <p className="leading-relaxed">
                  {draftNotice ||
                    'This document is a structured draft aligned with current ToothCare Hub software capabilities and requires formal review and approval by clinic leadership and a qualified legal/privacy adviser prior to production publication.'}
                </p>
              </div>
            </div>
          )}

          {loadError && (
            <p role="status" className="mt-3 text-xs text-slate-500 dark:text-gray-400">
              Showing bundled document version v{documentData?.version || '1.0'} while live policy metadata could not be reached.
            </p>
          )}
        </section>

        {/* Two-Column Document Layout: Sticky TOC + Structured Article */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Mobile Collapsible Table of Contents */}
          {sections.length > 0 && (
            <details className="lg:hidden rounded-2xl bg-white dark:bg-gray-800 border border-slate-200/90 dark:border-gray-700 p-4 shadow-xs">
              <summary className="flex items-center gap-2 text-xs font-bold text-[#12304A] dark:text-white cursor-pointer select-none">
                <List className="w-4 h-4 text-[#0D9488] dark:text-teal-400" aria-hidden="true" />
                <span>Table of Contents ({sections.length} sections)</span>
              </summary>
              <nav aria-label="Document sections" className="mt-3 pt-3 border-t border-slate-100 dark:border-gray-700">
                <ul className="space-y-1.5 text-xs">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className="block py-1 text-slate-600 dark:text-gray-300 hover:text-[#0D9488] dark:hover:text-teal-300 transition-colors"
                      >
                        {section.heading}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </details>
          )}

          {/* Desktop Sticky Table of Contents */}
          {sections.length > 0 && (
            <aside className="hidden lg:block lg:col-span-4 sticky top-20">
              <div className="rounded-2xl bg-white dark:bg-gray-800 border border-slate-200/90 dark:border-gray-700 p-5 shadow-xs">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#12304A] dark:text-gray-100 mb-3">
                  <List className="w-4 h-4 text-[#0D9488] dark:text-teal-400" aria-hidden="true" />
                  <span>Table of Contents</span>
                </h2>
                <nav aria-label="Table of Contents" className="max-h-[65vh] overflow-y-auto pr-1">
                  <ul className="space-y-1 text-xs">
                    {sections.map((section) => (
                      <li key={section.id}>
                        <a
                          href={`#${section.id}`}
                          className="block px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-gray-300 hover:text-[#0F766E] dark:hover:text-teal-200 hover:bg-teal-50/80 dark:hover:bg-teal-900/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
                        >
                          {section.heading}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            </aside>
          )}

          {/* Main Document Article */}
          <article
            aria-busy={isLoading}
            className="lg:col-span-8 space-y-5 min-w-0"
          >
            {isLoading && sections.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-gray-800 border border-slate-200/90 dark:border-gray-700 p-8 space-y-4 animate-pulse">
                <div className="h-5 w-1/3 rounded bg-slate-200 dark:bg-gray-700" />
                <div className="h-3.5 w-full rounded bg-slate-100 dark:bg-gray-700/70" />
                <div className="h-3.5 w-5/6 rounded bg-slate-100 dark:bg-gray-700/70" />
              </div>
            ) : (
              sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-24 rounded-2xl bg-white dark:bg-gray-800 border border-slate-200/90 dark:border-gray-700 p-5 sm:p-6 shadow-xs"
                >
                  <h2 className="text-base sm:text-lg font-bold text-[#12304A] dark:text-white mb-3">
                    {section.heading}
                  </h2>
                  <div className="space-y-3 text-sm text-slate-700 dark:text-gray-300 leading-relaxed break-words">
                    {(section.paragraphs || []).map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))
            )}

            {/* Clinic / Privacy Contact Verification Box */}
            <section className="rounded-2xl bg-white dark:bg-gray-800 border border-slate-200/90 dark:border-gray-700 p-5 sm:p-6 shadow-xs space-y-3">
              <h2 className="text-base font-bold text-[#12304A] dark:text-white">
                {isPrivacy ? 'Clinic & Privacy Contact Details' : 'Clinic Contact Details'}
              </h2>
              {CLINIC_CONTACT.isDevPlaceholderContact ? (
                <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl px-3.5 py-2.5 leading-relaxed">
                  <strong>Pending Clinic Confirmation:</strong> Official clinic contact details, registered physical address, and designated Data Protection Officer (DPO) contact information must be configured via production environment settings and approved by clinic leadership before deployment.
                </p>
              ) : (
                <ul className="space-y-2 text-sm text-slate-700 dark:text-gray-300">
                  <li className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#0D9488] dark:text-teal-400 shrink-0" aria-hidden="true" />
                    <a href={CLINIC_CONTACT.emailHref} className="underline hover:text-[#0D9488] dark:hover:text-teal-300">
                      {CLINIC_CONTACT.email}
                    </a>
                  </li>
                  <li className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#0D9488] dark:text-teal-400 shrink-0" aria-hidden="true" />
                    <a href={CLINIC_CONTACT.phoneHref} className="underline hover:text-[#0D9488] dark:hover:text-teal-300">
                      {CLINIC_CONTACT.phone}
                    </a>
                  </li>
                  {CLINIC_CONTACT.address && (
                    <li className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#0D9488] dark:text-teal-400 shrink-0" aria-hidden="true" />
                      <span>{CLINIC_CONTACT.address}</span>
                    </li>
                  )}
                </ul>
              )}

              <div className="pt-2 flex flex-wrap items-center gap-3">
                {cameFromRegister && (
                  <button
                    type="button"
                    onClick={onNavigateRegister}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Return to Registration</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={isPrivacy ? onNavigateTerms : onNavigatePrivacy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-900 text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
                >
                  {isPrivacy ? 'Read Terms of Service' : 'Read Privacy Policy'}
                </button>
              </div>
            </section>
          </article>
        </div>
      </main>

      <LandingFooter
        onLogin={onNavigateLogin}
        onBookAppointment={onBookAppointment}
        onAdminLogin={onAdminLogin}
        onHelpSupport={onHelpSupport}
        onTermsOfService={onNavigateTerms}
        onPrivacyPolicy={onNavigatePrivacy}
        onNavigateSection={onNavigateLandingSection}
      />
    </div>
  );
}

export default LegalDocumentLayout;
