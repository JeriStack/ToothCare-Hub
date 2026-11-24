import React, { useState, useMemo, useRef, useCallback, useEffect, useDeferredValue } from 'react';
import {
  Search,
  X,
  UserCheck,
  CalendarCheck,
  Stethoscope,
  BellRing,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Clock,
  Phone,
  Mail,
  MapPin,
  Copy,
  Check,
  AlertCircle,
  LifeBuoy,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Headphones,
  ChevronRight,
} from 'lucide-react';
import { HelpNavbar } from '../components/HelpNavbar';
import { HelpAccordionItem } from '../components/HelpAccordionItem';
import { LandingFooter } from '../../landing/components/LandingFooter';
import { useScrollReveal } from '../../landing/hooks/useScrollReveal';
import { EmptyState } from '../../../components/ui/EmptyState';
import {
  HELP_CATEGORIES,
  FAQ_FILTER_TABS,
  HELP_FAQS,
  HELP_GUIDES,
} from '../data/helpContent';
import { CLINIC_CONTACT } from '../data/clinicContact';

const CATEGORY_ICONS = {
  UserCheck,
  CalendarCheck,
  Stethoscope,
  BellRing,
};

const QUICK_SEARCH_TERMS = [
  'Reset password',
  'Book appointment',
  'Cancel',
  'Pending',
  'Missing email',
];

// Precomputed static lookup maps and lowercase search haystacks for zero per-render allocation
const GUIDES_BY_ID = Object.fromEntries(HELP_GUIDES.map((guide) => [guide.id, guide]));
const FAQS_BY_ID = Object.fromEntries(HELP_FAQS.map((faq) => [faq.id, faq]));
const CATEGORY_FAQ_COUNTS = HELP_FAQS.reduce((acc, faq) => {
  acc[faq.category] = (acc[faq.category] || 0) + 1;
  return acc;
}, {});
const FAQ_SEARCH_INDEX = new Map(
  HELP_FAQS.map((faq) => [
    faq.id,
    [faq.question, faq.answer, ...(faq.keywords || [])].filter(Boolean).join(' ').toLowerCase(),
  ])
);
const GUIDE_SEARCH_INDEX = new Map(
  HELP_GUIDES.map((guide) => [
    guide.id,
    [guide.title, guide.summary, ...guide.steps].filter(Boolean).join(' ').toLowerCase(),
  ])
);
const RELATED_GUIDES_BY_FAQ_ID = Object.fromEntries(
  HELP_FAQS.map((faq) => [
    faq.id,
    (faq.relatedGuideIds || []).map((id) => GUIDES_BY_ID[id]).filter(Boolean),
  ])
);

function matchesIndexedHaystack(haystack, tokens) {
  if (tokens.length === 0) return true;
  return tokens.every((token) => haystack.includes(token));
}

export function HelpCenterPage({
  onNavigateHome,
  onNavigateLandingSection,
  onBookAppointment,
  onLogin,
  onRegister,
  onForgotPassword,
  onViewAppointments,
  onAdminLogin,
  onTermsOfService,
  onPrivacyPolicy,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [openFaqIds, setOpenFaqIds] = useState(() => new Set([HELP_FAQS[0].id]));
  const [openGuideIds, setOpenGuideIds] = useState(() => new Set());
  const [activeGuideId, setActiveGuideId] = useState(HELP_GUIDES[0].id);
  const [copiedField, setCopiedField] = useState(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const helpRootRef = useRef(null);
  const searchInputRef = useRef(null);
  const faqSectionRef = useRef(null);
  const copyTimerRef = useRef(null);

  useScrollReveal(helpRootRef);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Help & Support — ToothCare Hub';
    window.scrollTo?.({ top: 0, behavior: 'auto' });

    const handleKeyShortcut = (event) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      searchInputRef.current?.focus();
    };

    let rafId = null;
    const handleScrollVisibility = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        setShowBackToTop((window.scrollY || 0) > 420);
      });
    };

    document.addEventListener('keydown', handleKeyShortcut);
    window.addEventListener('scroll', handleScrollVisibility, { passive: true });
    handleScrollVisibility();

    return () => {
      document.title = previousTitle;
      document.removeEventListener('keydown', handleKeyShortcut);
      window.removeEventListener('scroll', handleScrollVisibility);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const normalizedQuery = deferredSearchQuery.trim().toLowerCase();
  const searchTokens = useMemo(
    () => (normalizedQuery ? normalizedQuery.split(/\s+/).filter(Boolean) : []),
    [normalizedQuery]
  );

  const filteredFaqs = useMemo(() => {
    return HELP_FAQS.filter((faq) => {
      if (selectedCategory !== 'all' && faq.category !== selectedCategory) {
        return false;
      }
      return matchesIndexedHaystack(FAQ_SEARCH_INDEX.get(faq.id) || '', searchTokens);
    });
  }, [selectedCategory, searchTokens]);

  const filteredGuides = useMemo(() => {
    return HELP_GUIDES.filter((guide) => {
      if (selectedCategory === 'services') {
        if (guide.id !== 'guide-book-appointment') return false;
      } else if (selectedCategory === 'notifications') {
        if (guide.id !== 'guide-check-status' && guide.id !== 'guide-book-appointment') {
          return false;
        }
      } else if (
        selectedCategory !== 'all' &&
        selectedCategory !== 'general' &&
        guide.category !== selectedCategory
      ) {
        return false;
      }
      return matchesIndexedHaystack(GUIDE_SEARCH_INDEX.get(guide.id) || '', searchTokens);
    });
  }, [selectedCategory, searchTokens]);

  const allVisibleFaqsOpen =
    filteredFaqs.length > 0 && filteredFaqs.every((faq) => openFaqIds.has(faq.id));

  const allVisibleGuidesOpen =
    filteredGuides.length > 0 && filteredGuides.every((guide) => openGuideIds.has(guide.id));

  const handleToggleAllGuides = () => {
    if (allVisibleGuidesOpen) {
      setOpenGuideIds((prev) => {
        const next = new Set(prev);
        filteredGuides.forEach((guide) => next.delete(guide.id));
        return next;
      });
    } else {
      setOpenGuideIds((prev) => {
        const next = new Set(prev);
        filteredGuides.forEach((guide) => next.add(guide.id));
        return next;
      });
    }
  };

  const handleToggleFaq = useCallback((faqId) => {
    setOpenFaqIds((prev) => {
      const next = new Set(prev);
      if (next.has(faqId)) {
        next.delete(faqId);
      } else {
        next.add(faqId);
      }
      return next;
    });
  }, []);

  const handleForceOpenFaq = useCallback((faqId) => {
    setOpenFaqIds((prev) => {
      if (prev.has(faqId)) return prev;
      const next = new Set(prev);
      next.add(faqId);
      return next;
    });
  }, []);

  const handleToggleAllFaqs = () => {
    if (allVisibleFaqsOpen) {
      setOpenFaqIds((prev) => {
        const next = new Set(prev);
        filteredFaqs.forEach((faq) => next.delete(faq.id));
        return next;
      });
    } else {
      setOpenFaqIds((prev) => {
        const next = new Set(prev);
        filteredFaqs.forEach((faq) => next.add(faq.id));
        return next;
      });
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    searchInputRef.current?.focus();
  };

  const scrollElementIntoView = useCallback((element) => {
    if (!element) return;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    element.scrollIntoView?.({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }, []);

  const handleCategoryCardClick = (categoryId) => {
    setSelectedCategory(categoryId);
    const firstMatchingFaq = HELP_FAQS.find((faq) => faq.category === categoryId);
    if (firstMatchingFaq) {
      handleForceOpenFaq(firstMatchingFaq.id);
    }
    scrollElementIntoView(faqSectionRef.current);
  };

  const handleJumpToGuide = useCallback((guideId) => {
    setActiveGuideId(guideId);
    setOpenGuideIds((prev) => {
      if (prev.has(guideId)) return prev;
      const next = new Set(prev);
      next.add(guideId);
      return next;
    });
    const guideEl = document.getElementById(guideId);
    if (guideEl) {
      scrollElementIntoView(guideEl);
    } else {
      setSelectedCategory('all');
      setSearchQuery('');
      window.requestAnimationFrame?.(() => {
        scrollElementIntoView(document.getElementById(guideId));
      });
    }
  }, [scrollElementIntoView]);

  const handleJumpToFaq = (faqId) => {
    const targetFaq = FAQS_BY_ID[faqId];
    if (!targetFaq) return;
    if (selectedCategory !== 'all' && targetFaq.category !== selectedCategory) {
      setSelectedCategory('all');
    }
    if (normalizedQuery) {
      setSearchQuery('');
    }
    handleForceOpenFaq(faqId);
    window.requestAnimationFrame?.(() => {
      const faqEl = document.getElementById(faqId);
      scrollElementIntoView(faqEl);
      document.getElementById(`help-faq-btn-${faqId}`)?.focus?.({ preventScroll: true });
    });
  };

  const handleGuideNextAction = (actionKey) => {
    if (actionKey === 'register') {
      onRegister?.();
    } else if (actionKey === 'appointments') {
      if (onViewAppointments) {
        onViewAppointments();
      } else {
        onLogin?.();
      }
    } else if (actionKey === 'login') {
      onLogin?.();
    } else if (actionKey === 'forgot-password') {
      onForgotPassword?.();
    } else {
      onBookAppointment?.();
    }
  };

  const handleCopy = async (field, value) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      }
      setCopiedField(field);
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedField(null);
      }, 2000);
    } catch {
      // Ignore clipboard failures in restricted browsing contexts
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (filteredFaqs.length > 0) {
      handleForceOpenFaq(filteredFaqs[0].id);
    }
    scrollElementIntoView(faqSectionRef.current);
  };

  return (
    <div
      ref={helpRootRef}
      className="landing-animated-root min-h-dvh flex flex-col bg-[#F5F8FA] dark:bg-gray-900 text-slate-800 dark:text-gray-100 font-sans overflow-x-clip selection:bg-[#CCFBF1] selection:text-[#0F766E] dark:selection:bg-teal-900/70 dark:selection:text-teal-100"
    >
      <a
        href="#help-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#12304A] dark:focus:bg-teal-700 focus:text-white focus:text-xs focus:font-semibold focus:shadow-lg"
      >
        Skip to Help Center content
      </a>

      <HelpNavbar
        onNavigateHome={onNavigateHome}
        onLogin={onLogin}
      />

      <main id="help-main-content" className="flex-1">
        {/* Section A — Help Center Hero */}
        <section
          id="help-hero"
          aria-labelledby="help-hero-heading"
          className="relative landing-parallax-scope bg-gradient-to-b from-[#F5F8FA] via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 border-b border-slate-200/80 dark:border-gray-800 py-14 sm:py-20"
        >
          {/* Ambient Parallax Glow Orbs */}
          <div
            aria-hidden="true"
            style={{ '--parallax-offset': '32px' }}
            className="landing-parallax-layer pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[34rem] h-[18rem] rounded-full bg-teal-400/12 dark:bg-teal-500/12 blur-3xl"
          />

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <span
              style={{ '--hero-delay': '0ms' }}
              className="landing-hero-enter inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-teal-50 dark:bg-teal-500/15 border border-[#0D9488]/20 dark:border-teal-400/30 text-[#0F766E] dark:text-teal-300 text-xs font-semibold"
            >
              <LifeBuoy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>ToothCare Hub Public Help Center</span>
            </span>

            <div style={{ '--hero-delay': '80ms' }} className="landing-hero-enter space-y-3">
              <h1
                id="help-hero-heading"
                className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#12304A] dark:text-white tracking-tight leading-tight"
              >
                How can we help you?
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
                Find answers and guidance for using ToothCare Hub.
              </p>
            </div>

            {/* Working Help Center Search & Category Filter Form */}
            <form
              role="search"
              aria-label="Search Help Center articles and FAQs"
              onSubmit={handleSearchSubmit}
              style={{ '--hero-delay': '160ms' }}
              className="landing-hero-enter max-w-3xl mx-auto pt-2"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1 flex items-center">
                  <label htmlFor="help-center-search" className="sr-only">
                    Search help articles, FAQs, and user guides
                  </label>
                  <Search
                    className="w-5 h-5 text-slate-400 dark:text-gray-400 absolute left-4 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchInputRef}
                    id="help-center-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape' && searchQuery) {
                        e.preventDefault();
                        setSearchQuery('');
                      }
                    }}
                    placeholder="Search by topic, e.g., book appointment, reset password, cancel..."
                    className="w-full min-h-12 sm:min-h-14 pl-12 pr-14 py-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 text-slate-900 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:focus:ring-teal-400 focus:border-[#0D9488] dark:focus:border-teal-400 transition-shadow text-sm sm:text-base"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      aria-label="Clear search query"
                      className="absolute right-3 inline-flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-100 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <kbd
                      aria-hidden="true"
                      className="hidden sm:inline-flex items-center justify-center absolute right-3.5 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-400 dark:text-gray-400 bg-slate-100 dark:bg-gray-900/80 border border-slate-200 dark:border-gray-700 pointer-events-none"
                    >
                      /
                    </kbd>
                  )}
                </div>

                <div className="sm:w-60 shrink-0">
                  <label htmlFor="help-center-category" className="sr-only">
                    Filter help topics by category
                  </label>
                  <select
                    id="help-center-category"
                    aria-label="Filter help topics by category"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full min-h-12 sm:min-h-14 px-4 py-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 text-slate-900 dark:text-gray-100 shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:focus:ring-teal-400 focus:border-[#0D9488] dark:focus:border-teal-400"
                  >
                    {FAQ_FILTER_TABS.map((tab) => {
                      const count =
                        tab.id === 'all'
                          ? HELP_FAQS.length
                          : CATEGORY_FAQ_COUNTS[tab.id] || 0;
                      return (
                        <option key={tab.id} value={tab.id}>
                          {tab.label} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Quick-search suggestion chips */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-500 dark:text-gray-400 mr-1">
                  Popular:
                </span>
                {QUICK_SEARCH_TERMS.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setSearchQuery(term);
                      setSelectedCategory('all');
                      searchInputRef.current?.focus();
                    }}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/90 dark:bg-gray-800/90 border border-slate-200/90 dark:border-gray-700 text-slate-600 dark:text-gray-300 hover:border-[#0D9488]/45 dark:hover:border-teal-400/45 hover:text-[#0F766E] dark:hover:text-teal-300 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
                  >
                    {term}
                  </button>
                ))}
              </div>

              <div
                aria-live="polite"
                className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-gray-400"
              >
                {normalizedQuery || selectedCategory !== 'all' ? (
                  <>
                    <span>
                      Showing <strong className="text-slate-800 dark:text-gray-100">{filteredFaqs.length}</strong>{' '}
                      {filteredFaqs.length === 1 ? 'FAQ' : 'FAQs'} and{' '}
                      <strong className="text-slate-800 dark:text-gray-100">{filteredGuides.length}</strong>{' '}
                      {filteredGuides.length === 1 ? 'guide' : 'guides'}
                    </span>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="inline-flex items-center gap-1 font-semibold text-[#0F766E] dark:text-teal-300 hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded px-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Reset filters</span>
                    </button>
                  </>
                ) : (
                  <span>
                    Browse {HELP_CATEGORIES.length} core topics, {HELP_FAQS.length} answers, and {HELP_GUIDES.length} step-by-step guides.
                  </span>
                )}
              </div>
            </form>
          </div>
        </section>

        {/* Section B — Browse Help Topics */}
        <section
          id="help-topics"
          aria-labelledby="help-topics-heading"
          className="py-14 sm:py-16 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-gray-800"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div
              data-reveal="fade"
              className="landing-reveal flex flex-col sm:flex-row sm:items-end justify-between gap-4"
            >
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-500/15 border border-[#0D9488]/20 dark:border-teal-400/30 text-[#0F766E] dark:text-teal-300 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Browse Help Topics</span>
                </span>
                <h2
                  id="help-topics-heading"
                  className="text-2xl sm:text-3xl font-extrabold text-[#12304A] dark:text-white tracking-tight"
                >
                  Choose a Category
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 max-w-2xl">
                  Select any category below to filter relevant questions and step-by-step instructions.
                </p>
              </div>

              {selectedCategory !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className="self-start sm:self-auto inline-flex items-center gap-1.5 min-h-10 px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-xs font-semibold text-slate-700 dark:text-gray-200 hover:border-[#0D9488]/40 dark:hover:border-teal-400/40 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Show All Topics</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {HELP_CATEGORIES.map((category, idx) => {
                const Icon = CATEGORY_ICONS[category.icon] || LifeBuoy;
                const isSelected = selectedCategory === category.id;
                const faqCount = CATEGORY_FAQ_COUNTS[category.id] || 0;

                return (
                  <article
                    key={category.id}
                    style={{ '--reveal-index': idx }}
                    className={`landing-reveal landing-card-hover group p-5 sm:p-6 rounded-2xl border flex flex-col justify-between gap-4 ${
                      isSelected
                        ? 'bg-teal-50/75 dark:bg-teal-950/35 border-[#0D9488] dark:border-teal-400 shadow-md shadow-teal-900/10'
                        : 'bg-[#F8FAFC] dark:bg-gray-800/90 border-slate-200/90 dark:border-gray-700/80 hover:border-[#0D9488]/45 dark:hover:border-teal-400/45 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md'
                    }`}
                  >
                    <div className="space-y-4">
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleCategoryCardClick(category.id)}
                        className="w-full text-left space-y-3.5 rounded-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-colors ${
                              isSelected
                                ? 'bg-[#0D9488] border-[#0D9488] text-white'
                                : 'bg-teal-50 dark:bg-teal-500/15 border-[#0D9488]/20 dark:border-teal-400/30 text-[#0D9488] dark:text-teal-300 group-hover:bg-[#0D9488] group-hover:text-white'
                            }`}
                          >
                            <Icon className="w-5 h-5" aria-hidden="true" />
                          </div>
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white dark:bg-gray-900/80 text-slate-600 dark:text-gray-300 border border-slate-200/80 dark:border-gray-700">
                            {faqCount} {faqCount === 1 ? 'FAQ' : 'FAQs'}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <h3 className="font-bold text-base text-slate-900 dark:text-gray-100 group-hover:text-[#0F766E] dark:group-hover:text-teal-200 transition-colors">
                            {category.title}
                          </h3>
                          <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed text-justify">
                            {category.description}
                          </p>
                        </div>
                      </button>

                      {/* Collapsible native disclosure for sub-topics */}
                      <details className="group/details rounded-xl bg-white/80 dark:bg-gray-900/55 border border-slate-200/80 dark:border-gray-700/75 px-3 py-2">
                        <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-gray-200 cursor-pointer select-none rounded-lg py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400">
                          <ChevronRight
                            className="w-3.5 h-3.5 text-[#0D9488] dark:text-teal-400 shrink-0 transition-transform duration-200 motion-reduce:transition-none group-open/details:rotate-90"
                            aria-hidden="true"
                          />
                          <span>Included topics ({category.highlights.length})</span>
                        </summary>
                        <ul className="space-y-1.5 pt-2.5 mt-2 border-t border-slate-200/70 dark:border-gray-700/70">
                          {category.highlights.map((item) => (
                            <li
                              key={item}
                              className="flex items-start gap-2 text-xs text-slate-600 dark:text-gray-300"
                            >
                              <CheckCircle2
                                className="w-3.5 h-3.5 text-[#0D9488] dark:text-teal-400 shrink-0 mt-0.5"
                                aria-hidden="true"
                              />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCategoryCardClick(category.id)}
                      className="w-full pt-3 border-t border-slate-200/70 dark:border-gray-700/70 flex items-center justify-between text-xs font-semibold text-[#0F766E] dark:text-teal-300 cursor-pointer rounded-b-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
                    >
                      <span>{isSelected ? 'Viewing topic' : 'View topic answers'}</span>
                      <ArrowRight
                        className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
                        aria-hidden="true"
                      />
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Section C — Frequently Asked Questions */}
        <section
          id="help-faq"
          ref={faqSectionRef}
          aria-labelledby="help-faq-heading"
          className="py-14 sm:py-16 bg-slate-50/70 dark:bg-gray-950/60 border-b border-slate-100 dark:border-gray-800 scroll-mt-20"
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div
              data-reveal="fade"
              className="landing-reveal flex flex-col sm:flex-row sm:items-end justify-between gap-4"
            >
              <div className="space-y-2">
                <h2
                  id="help-faq-heading"
                  className="text-2xl sm:text-3xl font-extrabold text-[#12304A] dark:text-white tracking-tight"
                >
                  Frequently Asked Questions
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300">
                  Filter by category or search above to find verified answers about using ToothCare Hub.
                </p>
              </div>

              {filteredFaqs.length > 0 && (
                <button
                  type="button"
                  aria-expanded={allVisibleFaqsOpen}
                  onClick={handleToggleAllFaqs}
                  className="self-start sm:self-auto inline-flex items-center justify-center min-h-10 px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-slate-700 dark:text-gray-200 hover:border-[#0D9488]/45 dark:hover:border-teal-400/45 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
                >
                  {allVisibleFaqsOpen ? 'Collapse all' : 'Expand all'}
                </button>
              )}
            </div>

            {/* FAQ Search & Category Filter Dropdown */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <label htmlFor="help-faq-search" className="sr-only">
                  Filter FAQs by keyword
                </label>
                <Search
                  className="w-4 h-4 text-slate-400 dark:text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="help-faq-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter FAQs by keyword..."
                  className="w-full min-h-11 sm:min-h-0 pl-10 pr-9 py-2.5 rounded-xl bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:focus:ring-teal-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear FAQ search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="sm:w-64 shrink-0">
                <label htmlFor="help-faq-category" className="sr-only">
                  Filter FAQs by category
                </label>
                <select
                  id="help-faq-category"
                  aria-label="Filter FAQs by category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full min-h-11 sm:min-h-0 px-3.5 py-2.5 rounded-xl bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
                >
                  {FAQ_FILTER_TABS.map((tab) => {
                    const count =
                      tab.id === 'all'
                        ? HELP_FAQS.length
                        : CATEGORY_FAQ_COUNTS[tab.id] || 0;
                    return (
                      <option key={tab.id} value={tab.id}>
                        {tab.label} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* FAQ Accordion List or Empty State */}
            {filteredFaqs.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 border border-slate-200/90 dark:border-gray-700 rounded-2xl p-6">
                <EmptyState
                  icon={Search}
                  title="No matching FAQ answers found"
                  description={
                    normalizedQuery
                      ? `We could not find an FAQ matching "${searchQuery.trim()}". Try a different keyword or reset your filters to view all help articles.`
                      : 'No FAQs match the currently selected category.'
                  }
                  action={
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="inline-flex items-center gap-2 min-h-10 px-5 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
                    >
                      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Clear search &amp; reset filters</span>
                    </button>
                  }
                />
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFaqs.map((faq) => (
                  <HelpAccordionItem
                    key={faq.id}
                    faq={faq}
                    isOpen={openFaqIds.has(faq.id)}
                    onToggle={handleToggleFaq}
                    onForceOpen={handleForceOpenFaq}
                    relatedGuides={RELATED_GUIDES_BY_FAQ_ID[faq.id]}
                    onSelectGuide={handleJumpToGuide}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Section D — Step-by-Step User Guides */}
        <section
          id="help-guides"
          aria-labelledby="help-guides-heading"
          className="landing-deferred-section py-14 sm:py-16 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-gray-800 scroll-mt-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div
              data-reveal="fade"
              className="landing-reveal flex flex-col sm:flex-row sm:items-end justify-between gap-4"
            >
              <div className="space-y-2 max-w-2xl">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-500/15 border border-[#0D9488]/20 dark:border-teal-400/30 text-[#0F766E] dark:text-teal-300 text-xs font-semibold">
                  <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Step-by-Step User Guides</span>
                </span>
                <h2
                  id="help-guides-heading"
                  className="text-2xl sm:text-3xl font-extrabold text-[#12304A] dark:text-white tracking-tight"
                >
                  Common Workflows Made Simple
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300">
                  Open any guide below for numbered step-by-step instructions tailored to ToothCare Hub.
                </p>
              </div>

              {filteredGuides.length > 0 && (
                <button
                  type="button"
                  aria-expanded={allVisibleGuidesOpen}
                  onClick={handleToggleAllGuides}
                  className="self-start sm:self-auto inline-flex items-center justify-center min-h-10 px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-slate-700 dark:text-gray-200 hover:border-[#0D9488]/45 dark:hover:border-teal-400/45 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
                >
                  {allVisibleGuidesOpen ? 'Collapse all guides' : 'Expand all guides'}
                </button>
              )}
            </div>

            {filteredGuides.length === 0 ? (
              <div className="bg-[#F8FAFC] dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 rounded-2xl p-6 text-center space-y-3">
                <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">
                  No step-by-step guides match your current search.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 min-h-10 px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Show all {HELP_GUIDES.length} guides</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
                {filteredGuides.map((guide, idx) => {
                  const isHighlighted = activeGuideId === guide.id;
                  const isGuideOpen = openGuideIds.has(guide.id);
                  const relatedFaqs = (guide.relatedFaqIds || [])
                    .map((id) => FAQS_BY_ID[id])
                    .filter(Boolean);

                  return (
                    <article
                      key={guide.id}
                      id={guide.id}
                      style={{ '--reveal-index': idx % 3 }}
                      onClick={() => setActiveGuideId(guide.id)}
                      className={`landing-reveal landing-card-hover scroll-mt-24 rounded-2xl p-5 border flex flex-col gap-4 ${
                        isHighlighted
                          ? 'bg-white dark:bg-gray-800 border-[#0D9488]/45 dark:border-teal-400/45 shadow-sm shadow-teal-900/5'
                          : 'bg-[#F8FAFC] dark:bg-gray-800/85 border-slate-200/90 dark:border-gray-700/80 hover:border-[#0D9488]/35 dark:hover:border-teal-400/35 hover:shadow-md'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-300 border border-[#0D9488]/20 dark:border-teal-400/30">
                            {guide.steps.length} steps
                          </span>
                          <span className="inline-flex items-center gap-1 font-medium text-slate-500 dark:text-gray-400">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            <span>{guide.estimatedTime}</span>
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-[#12304A] dark:text-white leading-snug">
                          {guide.title}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed text-justify min-h-10">
                          {guide.summary}
                        </p>
                      </div>

                      <details
                        open={isGuideOpen}
                        onToggle={(e) => {
                          const nextOpen = e.currentTarget.open;
                          setOpenGuideIds((prev) => {
                            if (prev.has(guide.id) === nextOpen) return prev;
                            const next = new Set(prev);
                            if (nextOpen) {
                              next.add(guide.id);
                            } else {
                              next.delete(guide.id);
                            }
                            return next;
                          });
                        }}
                        className="group/guide rounded-xl bg-white/80 dark:bg-gray-900/50 border border-slate-200/80 dark:border-gray-700/70"
                      >
                        <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-gray-200 hover:text-[#0F766E] dark:hover:text-teal-300 cursor-pointer select-none rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400">
                          <ChevronRight
                            className="w-3.5 h-3.5 shrink-0 text-[#0D9488] dark:text-teal-400 transition-transform duration-200 group-open/guide:rotate-90 motion-reduce:transition-none"
                            aria-hidden="true"
                          />
                          <span>{isGuideOpen ? 'Hide steps' : 'View steps'}</span>
                        </summary>

                        <div className="px-3 pb-3 pt-2 border-t border-slate-200/70 dark:border-gray-700/60 space-y-3.5">
                          <ol className="space-y-2">
                            {guide.steps.map((stepText, idx) => (
                              <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-gray-200 leading-relaxed">
                                <span
                                  aria-hidden="true"
                                  className="w-5 h-5 rounded-full bg-[#CCFBF1] dark:bg-teal-500/20 border border-[#0D9488]/25 dark:border-teal-400/35 text-[#0F766E] dark:text-teal-300 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5"
                                >
                                  {idx + 1}
                                </span>
                                <span>{stepText}</span>
                              </li>
                            ))}
                          </ol>

                          {relatedFaqs.length > 0 && (
                            <div className="pt-2.5 border-t border-slate-200/60 dark:border-gray-700/60 space-y-1.5">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
                                Related FAQs
                              </p>
                              <div className="flex flex-col gap-1.5">
                                {relatedFaqs.map((faq) => (
                                  <button
                                    key={faq.id}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleJumpToFaq(faq.id);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-50 dark:bg-gray-800/80 border border-slate-200/80 dark:border-gray-700 text-slate-700 dark:text-gray-200 hover:border-[#0D9488]/45 dark:hover:border-teal-400/45 hover:text-[#0F766E] dark:hover:text-teal-300 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
                                  >
                                    {faq.question}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </details>

                      {guide.nextAction && (
                        <div className="pt-3 border-t border-slate-200/70 dark:border-gray-700/70">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGuideNextAction(guide.nextAction.actionKey);
                            }}
                            className="landing-cta-shine group/btn w-full inline-flex items-center justify-between gap-2 min-h-9 px-3.5 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] dark:bg-[#0F766E] dark:hover:bg-[#0D9488] text-white text-xs font-semibold shadow-xs active:scale-[0.99] transition-all duration-200 motion-reduce:transition-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800"
                          >
                            <span>{guide.nextAction.label}</span>
                            <ArrowRight
                              className="w-3.5 h-3.5 shrink-0 transition-transform duration-200 group-hover/btn:translate-x-0.5 motion-reduce:transform-none"
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Section E — Contact Support */}
        <section
          id="help-contact"
          aria-labelledby="help-contact-heading"
          className="landing-deferred-section py-14 sm:py-16 bg-slate-50/70 dark:bg-gray-950/60 scroll-mt-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              {/* Contact Details Card */}
              <div
                data-reveal="left"
                className="landing-reveal lg:col-span-7 bg-[#12304A] dark:bg-gradient-to-br dark:from-slate-800/95 dark:to-gray-900 border border-[#1E4668] dark:border-teal-500/25 text-white rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col justify-between gap-6"
              >
                <div className="space-y-5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-400/15 border border-teal-400/25 text-teal-300 text-[11px] font-semibold">
                    <Headphones className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Clinic Reception Assistance</span>
                  </span>

                  <div className="space-y-2">
                    <h2
                      id="help-contact-heading"
                      className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white"
                    >
                      Still need assistance?
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                      Contact the clinic for assistance with your account or appointment concerns.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* Clinic Telephone */}
                    <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.06] border border-white/10">
                      <a
                        href={CLINIC_CONTACT.phoneHref}
                        className="flex items-center gap-3.5 min-w-0 flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 rounded-lg"
                      >
                        <div className="w-10 h-10 rounded-xl bg-teal-400/15 border border-teal-400/25 text-teal-300 flex items-center justify-center shrink-0">
                          <Phone className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[11px] text-slate-400 block">Clinic Telephone</span>
                          <span className="font-bold text-sm text-white tabular-nums">
                            {CLINIC_CONTACT.phone}
                          </span>
                        </div>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopy('phone', CLINIC_CONTACT.phone)}
                        aria-label="Copy clinic telephone number"
                        className="inline-flex items-center gap-1 min-h-9 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-medium text-slate-200 transition-colors shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
                      >
                        {copiedField === 'phone' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
                            <span className="text-teal-300">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Clinic Email */}
                    <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.06] border border-white/10">
                      <a
                        href={CLINIC_CONTACT.emailHref}
                        className="flex items-center gap-3.5 min-w-0 flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 rounded-lg"
                      >
                        <div className="w-10 h-10 rounded-xl bg-teal-400/15 border border-teal-400/25 text-teal-300 flex items-center justify-center shrink-0">
                          <Mail className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[11px] text-slate-400 block">Clinic Support Email</span>
                          <span className="font-bold text-sm text-white truncate block">
                            {CLINIC_CONTACT.email}
                          </span>
                        </div>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopy('email', CLINIC_CONTACT.email)}
                        aria-label="Copy clinic support email"
                        className="inline-flex items-center gap-1 min-h-9 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-medium text-slate-200 transition-colors shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
                      >
                        {copiedField === 'email' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
                            <span className="text-teal-300">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Approved Clinic Address (displayed only when explicitly configured) */}
                    {CLINIC_CONTACT.address && (
                      <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.06] border border-white/10">
                        <div className="w-10 h-10 rounded-xl bg-teal-400/15 border border-teal-400/25 text-teal-300 flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[11px] text-slate-400 block">Clinic Address</span>
                          <span className="font-semibold text-sm text-white">
                            {CLINIC_CONTACT.address}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-slate-300/90 leading-relaxed border-t border-white/10 pt-4">
                  For your security, clinic staff will never ask for your ToothCare Hub password, verification links, or session tokens.
                </p>
              </div>

              {/* Operating Hours & Safety Card */}
              <div
                data-reveal="right"
                className="landing-reveal lg:col-span-5 bg-white dark:bg-gray-800/95 border border-slate-200/90 dark:border-gray-700/80 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col justify-between gap-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-500/15 border border-[#0D9488]/20 dark:border-teal-400/30 text-[#0D9488] dark:text-teal-300 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-gray-100 text-lg leading-snug">
                        Clinic Operating Hours
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-gray-400">
                        {CLINIC_CONTACT.timezone}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs sm:text-sm">
                    {CLINIC_CONTACT.operatingHours.map((row) => (
                      <div
                        key={row.id}
                        className={`px-3.5 py-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
                          row.closed
                            ? 'bg-rose-50/70 dark:bg-rose-950/25 border-rose-200/70 dark:border-rose-800/50'
                            : 'bg-[#F8FAFC] dark:bg-gray-900/50 border-slate-200/80 dark:border-gray-700/70'
                        }`}
                      >
                        <span
                          className={`font-semibold ${
                            row.closed
                              ? 'text-rose-700 dark:text-rose-300'
                              : 'text-slate-700 dark:text-gray-200'
                          }`}
                        >
                          {row.day}
                        </span>
                        <span
                          className={`font-bold tabular-nums ${
                            row.closed
                              ? 'text-rose-700 dark:text-rose-300 text-xs'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {row.hours}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-50/90 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-400/30 rounded-2xl p-4 flex items-start gap-3 text-xs">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertCircle className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-amber-900 dark:text-amber-200">Dental Emergencies</p>
                    <p className="text-amber-800/90 dark:text-amber-200/85 leading-relaxed text-justify">
                      If you are experiencing severe oral pain, trauma, or swelling outside operating hours, please proceed directly to your nearest emergency medical facility.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter
        onLogin={onLogin}
        onBookAppointment={onBookAppointment}
        onAdminLogin={onAdminLogin}
        onHelpSupport={() => window.scrollTo?.({ top: 0, behavior: 'smooth' })}
        onTermsOfService={onTermsOfService}
        onPrivacyPolicy={onPrivacyPolicy}
        onNavigateSection={(sectionId) => {
          if (onNavigateLandingSection) {
            onNavigateLandingSection(sectionId);
          } else {
            onNavigateHome?.();
          }
        }}
        emergencyContactHref="#help-contact"
      />

      {/* Floating Back-to-Top Button */}
      <button
        type="button"
        aria-label="Back to top"
        tabIndex={showBackToTop ? 0 : -1}
        aria-hidden={!showBackToTop}
        onClick={() => {
          const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
          window.scrollTo?.({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
        }}
        className={`fixed bottom-5 right-5 z-40 inline-flex items-center justify-center w-11 h-11 rounded-full bg-[#0D9488] hover:bg-[#0F766E] dark:bg-teal-600 dark:hover:bg-teal-500 text-white shadow-lg shadow-teal-900/20 dark:shadow-black/40 border border-white/15 cursor-pointer transition-[opacity,transform,background-color] duration-200 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${
          showBackToTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        <ArrowUp className="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  );
}

export default HelpCenterPage;
