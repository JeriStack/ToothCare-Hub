import React, { useEffect } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  LogIn,
  User,
  UserPlus,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../../auth';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';
import { LandingFooter } from '../../landing/components/LandingFooter';
import { CLINIC_CONTACT } from '../../help/data/clinicContact';
import { LegalDocumentHeader } from './LegalDocumentHeader';
import { LegalTableOfContents } from './LegalTableOfContents';
import { LegalDocumentSection } from './LegalDocumentSection';

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
  const sections = Array.isArray(documentData?.content?.sections)
    ? documentData.content.sections
    : [];
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
    <div className="min-h-dvh flex flex-col bg-canvas text-foreground font-sans overflow-x-clip transition-colors">
      {/* Skip link targets the document heading directly for keyboard & magnifier clarity */}
      <a
        href="#legal-document-title"
        className="legal-no-print sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-md focus:bg-[#12304A] dark:focus:bg-teal-700 focus:text-white focus:text-xs focus:font-semibold focus:shadow-lg"
      >
        Skip to document content
      </a>

      {/* Restrained Sticky Top Navigation Bar */}
      <header className="legal-no-print sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-line">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigateHome?.();
              }}
              className="flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488] shrink-0"
            >
              <img
                src="/images/logo-icon.png"
                alt="ToothCare Hub Emblem"
                width="30"
                height="30"
                decoding="async"
                className="w-7 h-7 object-contain"
              />
              <span className="font-bold text-[0.9375rem] sm:text-base tracking-tight text-[#12304A] dark:text-white whitespace-nowrap">
                Tooth<span className="text-[#0D9488] dark:text-teal-400">Care</span> Hub
              </span>
            </a>

            <nav
              aria-label="Legal documents"
              className="hidden md:flex items-center gap-1 pl-4 border-l border-line h-7"
            >
              <a
                href="/terms-of-service"
                aria-current={!isPrivacy ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigateTerms?.();
                }}
                className={`tch-tap px-3 py-1.5 rounded-md text-[0.8125rem] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488] ${
                  !isPrivacy
                    ? 'bg-slate-100 dark:bg-gray-800 text-[#12304A] dark:text-teal-300 font-semibold border border-slate-200/80 dark:border-gray-700'
                    : 'text-slate-600 dark:text-gray-300 hover:text-[#12304A] dark:hover:text-white hover:bg-slate-50 dark:hover:bg-gray-800/60'
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
                className={`tch-tap px-3 py-1.5 rounded-md text-[0.8125rem] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488] ${
                  isPrivacy
                    ? 'bg-slate-100 dark:bg-gray-800 text-[#12304A] dark:text-teal-300 font-semibold border border-slate-200/80 dark:border-gray-700'
                    : 'text-slate-600 dark:text-gray-300 hover:text-[#12304A] dark:hover:text-white hover:bg-slate-50 dark:hover:bg-gray-800/60'
                }`}
              >
                Privacy Policy
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle variant="surface" />
            {cameFromRegister ? (
              <button
                type="button"
                onClick={onNavigateRegister}
                className="tch-tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#0D9488] hover:bg-[#0F766E] text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488]"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Back to Registration</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onNavigateLogin}
                className="tch-tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-line bg-surface hover:bg-slate-50 dark:hover:bg-gray-800 text-[#12304A] dark:text-gray-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488]"
              >
                {isAuthenticated ? (
                  <User className="w-3.5 h-3.5 text-[#0D9488] dark:text-teal-400" aria-hidden="true" />
                ) : (
                  <LogIn className="w-3.5 h-3.5 text-[#0D9488] dark:text-teal-400" aria-hidden="true" />
                )}
                <span>{isAuthenticated ? user?.first_name || 'Portal' : 'Sign In'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Formal Document Workspace */}
      <main
        id="legal-main-content"
        tabIndex={-1}
        className="flex-1 max-w-[1160px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 focus:outline-none"
      >
        {/* Contextual Return Links & Mobile Policy Switcher */}
        <div className="legal-no-print flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigateHome?.();
              }}
              className="tch-tap inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-slate-600 dark:text-gray-300 hover:text-[#0F766E] dark:hover:text-teal-300 transition-colors rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488]"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Back to Home</span>
            </a>

            {!isAuthenticated && (
              <>
                <span className="text-slate-300 dark:text-gray-600" aria-hidden="true">
                  /
                </span>
                <a
                  href="/register"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigateRegister?.();
                  }}
                  className="tch-tap inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-[#0F766E] dark:text-teal-400 hover:underline transition-colors rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488]"
                >
                  <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {cameFromRegister ? 'Return to Patient Registration' : 'Patient Registration'}
                  </span>
                </a>
              </>
            )}
          </div>

          {/* Mobile Document Switcher */}
          <nav aria-label="Switch legal document" className="flex md:hidden items-center gap-1.5">
            <a
              href="/terms-of-service"
              aria-current={!isPrivacy ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                onNavigateTerms?.();
              }}
              className={`tch-tap px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                !isPrivacy
                  ? 'bg-surface border-[#0D9488] dark:border-teal-400 text-[#12304A] dark:text-teal-300 font-semibold'
                  : 'bg-transparent border-line text-slate-600 dark:text-gray-300'
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
              className={`tch-tap px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                isPrivacy
                  ? 'bg-surface border-[#0D9488] dark:border-teal-400 text-[#12304A] dark:text-teal-300 font-semibold'
                  : 'bg-transparent border-line text-slate-600 dark:text-gray-300'
              }`}
            >
              Privacy Policy
            </a>
          </nav>
        </div>

        {/* Mobile Collapsible Table of Contents */}
        <LegalTableOfContents sections={sections} variant="mobile" />

        {/* Two-Column Formal Layout: Main Document Sheet (<= 840px) + Subordinate Sticky TOC */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,52.5rem)_minmax(14rem,16.5rem)] lg:justify-between gap-8 lg:gap-10 items-start">
          {/* Unified Formal Document Sheet */}
          <article
            aria-busy={isLoading}
            className="legal-document-sheet min-w-0 bg-surface border border-line rounded-xl px-5 py-7 sm:px-10 sm:py-11 lg:px-12 lg:py-12"
          >
            <LegalDocumentHeader
              documentData={documentData}
              docTitle={docTitle}
              isPrivacy={isPrivacy}
              introduction={introduction}
              draftNotice={draftNotice}
              loadError={loadError}
            />

            {/* Structured Document Body */}
            {isLoading && sections.length === 0 ? (
              <div className="pt-8 space-y-5 animate-pulse" aria-label="Loading document">
                <div className="h-5 w-1/3 rounded bg-slate-200 dark:bg-gray-700" />
                <div className="h-3.5 w-full rounded bg-slate-100 dark:bg-gray-700/70" />
                <div className="h-3.5 w-11/12 rounded bg-slate-100 dark:bg-gray-700/70" />
                <div className="h-3.5 w-4/5 rounded bg-slate-100 dark:bg-gray-700/70" />
              </div>
            ) : (
              <div>
                {sections.map((section, index) => (
                  <LegalDocumentSection
                    key={section.id}
                    section={section}
                    isFirst={index === 0}
                  />
                ))}
              </div>
            )}

            {/* Integrated Clinic & Privacy Contact Details */}
            <section className="legal-section pt-8 mt-8 border-t border-slate-200 dark:border-gray-700/80 space-y-4">
              <h2 className="legal-heading text-[1.125rem] sm:text-[1.25rem] font-semibold tracking-[-0.01em] text-[#12304A] dark:text-gray-50">
                {isPrivacy ? 'Clinic & Privacy Contact Details' : 'Clinic Contact Details'}
              </h2>

              {CLINIC_CONTACT.isDevPlaceholderContact ? (
                <div
                  role="note"
                  className="legal-notice border-l-[3px] border-amber-600/80 dark:border-amber-400/80 bg-amber-50/60 dark:bg-amber-950/30 px-4 py-3 rounded-r-md text-[0.875rem] leading-[1.65] text-amber-950 dark:text-amber-100 max-w-[68ch]"
                >
                  <strong className="font-semibold">Pending Clinic Confirmation:</strong> Official
                  clinic contact details, registered physical address, and designated Data
                  Protection Officer (DPO) contact information must be configured via production
                  environment settings and approved by clinic leadership before deployment.
                </div>
              ) : (
                <ul className="space-y-2.5 text-[0.9375rem] text-slate-700 dark:text-gray-300">
                  <li className="flex items-center gap-2.5">
                    <Mail
                      className="w-4 h-4 text-[#0F766E] dark:text-teal-400 shrink-0"
                      aria-hidden="true"
                    />
                    <a
                      href={CLINIC_CONTACT.emailHref}
                      className="underline decoration-slate-300 dark:decoration-gray-600 underline-offset-4 hover:text-[#0F766E] dark:hover:text-teal-300"
                    >
                      {CLINIC_CONTACT.email}
                    </a>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Phone
                      className="w-4 h-4 text-[#0F766E] dark:text-teal-400 shrink-0"
                      aria-hidden="true"
                    />
                    <a
                      href={CLINIC_CONTACT.phoneHref}
                      className="underline decoration-slate-300 dark:decoration-gray-600 underline-offset-4 hover:text-[#0F766E] dark:hover:text-teal-300"
                    >
                      {CLINIC_CONTACT.phone}
                    </a>
                  </li>
                  {CLINIC_CONTACT.address && (
                    <li className="flex items-start gap-2.5">
                      <MapPin
                        className="w-4 h-4 text-[#0F766E] dark:text-teal-400 shrink-0 mt-1"
                        aria-hidden="true"
                      />
                      <span>{CLINIC_CONTACT.address}</span>
                    </li>
                  )}
                </ul>
              )}
            </section>

            {/* Bottom Document Navigation Actions */}
            <div className="legal-no-print pt-8 mt-8 border-t border-slate-200 dark:border-gray-700/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                {cameFromRegister && (
                  <button
                    type="button"
                    onClick={onNavigateRegister}
                    className="tch-tap inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0D9488] hover:bg-[#0F766E] text-white text-[0.8125rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488]"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Return to Registration</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={isPrivacy ? onNavigateTerms : onNavigatePrivacy}
                  className="tch-tap inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-line bg-surface hover:bg-slate-50 dark:hover:bg-gray-800 text-slate-700 dark:text-gray-200 text-[0.8125rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488]"
                >
                  {isPrivacy ? 'Read Terms of Service' : 'Read Privacy Policy'}
                </button>
              </div>

              <a
                href="#legal-document-title"
                className="tch-tap inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-slate-500 dark:text-gray-400 hover:text-[#12304A] dark:hover:text-gray-100 transition-colors rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488]"
              >
                <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Back to top</span>
              </a>
            </div>
          </article>

          {/* Desktop Subordinate Sticky Table of Contents */}
          <LegalTableOfContents sections={sections} variant="desktop" />
        </div>
      </main>

      <div className="legal-no-print">
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
    </div>
  );
}

export default LegalDocumentLayout;
