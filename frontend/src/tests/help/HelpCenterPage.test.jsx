import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { HelpCenterPage, HELP_FAQS, HELP_GUIDES, HELP_CATEGORIES } from '../../features/help';
import { LandingFooter } from '../../features/landing/components/LandingFooter';
import { LandingNavbar } from '../../features/landing/components/LandingNavbar';
import { ThemeProvider } from '../../contexts/ThemeContext';
import App from '../../app/App';

vi.mock('../../features/auth', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useAuth: () => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      logout: vi.fn(),
      hasPermission: () => false,
      refreshUser: vi.fn(),
    }),
  };
});

describe('Public Help Center & Support (/help-support)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.dataset.theme = 'light';
    window.history.pushState({}, '', '/');
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  function renderHelpCenter(props = {}) {
    return render(
      <ThemeProvider>
        <HelpCenterPage
          onNavigateHome={vi.fn()}
          onBookAppointment={vi.fn()}
          onLogin={vi.fn()}
          onRegister={vi.fn()}
          onForgotPassword={vi.fn()}
          onAdminLogin={vi.fn()}
          {...props}
        />
      </ThemeProvider>
    );
  }

  it('renders Help & Support in landing header (desktop + mobile drawer) and footer and invokes navigation', () => {
    const onHelpSupport = vi.fn();
    render(
      <ThemeProvider>
        <LandingNavbar
          onBookAppointment={vi.fn()}
          onLogin={vi.fn()}
          onHelpSupport={onHelpSupport}
        />
        <LandingFooter
          onLogin={vi.fn()}
          onBookAppointment={vi.fn()}
          onAdminLogin={vi.fn()}
          onHelpSupport={onHelpSupport}
        />
      </ThemeProvider>
    );

    const primaryNav = screen.getByRole('navigation', { name: 'Primary' });
    const headerLink = within(primaryNav).getByRole('link', { name: /Help & Support/i });
    expect(headerLink).toHaveAttribute('href', '/help-support');
    fireEvent.click(headerLink);
    expect(onHelpSupport).toHaveBeenCalledTimes(1);

    // Open mobile drawer and verify Help & Support link exists there too
    fireEvent.click(screen.getByRole('button', { name: /Toggle navigation menu/i }));
    const mobileNav = screen.getByRole('navigation', { name: 'Mobile navigation' });
    const mobileHelpLink = within(mobileNav).getByRole('link', { name: /Help & Support/i });
    expect(mobileHelpLink).toHaveAttribute('href', '/help-support');
    fireEvent.click(mobileHelpLink);
    expect(onHelpSupport).toHaveBeenCalledTimes(2);

    // Verify footer link
    const footer = screen.getByRole('contentinfo');
    const footerLink = within(footer).getByRole('link', { name: /Help & Support/i });
    expect(footerLink).toHaveAttribute('href', '/help-support');
    fireEvent.click(footerLink);
    expect(onHelpSupport).toHaveBeenCalledTimes(3);
  });

  it('loads /help-support publicly without authentication via App routing', async () => {
    window.history.pushState({}, '', '/help-support');
    render(<App />);

    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: /How can we help you\?/i },
        { timeout: 5000 }
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Find answers and guidance for using ToothCare Hub\./i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Help & Support/i, current: 'page' })).toBeInTheDocument();
  });

  it('renders Hero, Browse Help Topics, FAQ section, User Guides, and Contact Support with semantic landmarks', () => {
    const { container } = renderHelpCenter();

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('search', { name: /Search Help Center/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'How can we help you?' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Choose a Category' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Frequently Asked Questions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Common Workflows Made Simple' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Still need assistance?' })).toBeInTheDocument();

    // Verify all 4 categories and 6 user guides render
    HELP_CATEGORIES.forEach((cat) => {
      expect(screen.getByRole('heading', { level: 3, name: cat.title })).toBeInTheDocument();
    });
    HELP_GUIDES.forEach((guide) => {
      expect(screen.getByRole('heading', { level: 3, name: guide.title })).toBeInTheDocument();
    });

    // No horizontal overflow container safeguard
    expect(container.firstChild).toHaveClass('overflow-x-clip');
  });

  it('searches across FAQ titles and answer body text, shows empty state for no matches, and resets cleanly', () => {
    renderHelpCenter();

    const faqSection = document.getElementById('help-faq');
    const searchInput = screen.getByLabelText(/Search help articles, FAQs, and user guides/i);

    // Match text inside an answer body ("sanitization buffers")
    fireEvent.change(searchInput, { target: { value: 'sanitization buffers' } });
    expect(
      within(faqSection).getByRole('button', {
        name: /How are dental service durations, fees, and dentist availability determined\?/i,
      })
    ).toBeInTheDocument();
    expect(
      within(faqSection).queryByRole('button', { name: /How do I log in\?/i })
    ).not.toBeInTheDocument();

    // No-results empty state
    fireEvent.change(searchInput, { target: { value: 'zzzz-unmatched-topic' } });
    expect(screen.getByText('No matching FAQ answers found')).toBeInTheDocument();

    // Reset button restores full FAQ list
    fireEvent.click(screen.getByRole('button', { name: /Clear search & reset filters/i }));
    expect(searchInput).toHaveValue('');
    expect(within(faqSection).getByRole('button', { name: /How do I log in\?/i })).toBeInTheDocument();
  });

  it('filters FAQs by category cards and pills and combines category filters with search', () => {
    renderHelpCenter();

    const topicsSection = document.getElementById('help-topics');
    const faqSection = document.getElementById('help-faq');

    // Click Notifications category card
    fireEvent.click(within(topicsSection).getByRole('button', { name: /Notifications/i }));

    expect(
      within(faqSection).getByRole('button', { name: /Will I receive an email after booking\?/i })
    ).toBeInTheDocument();
    expect(
      within(faqSection).queryByRole('button', { name: /How do I log in\?/i })
    ).not.toBeInTheDocument();

    // Combine with search — unmatched query filters both FAQs and Guides even under Notifications category
    const searchInput = screen.getByLabelText(/Search help articles, FAQs, and user guides/i);
    fireEvent.change(searchInput, { target: { value: 'spam' } });
    expect(
      within(faqSection).getByRole('button', { name: /What should I do if I do not receive an email\?/i })
    ).toBeInTheDocument();
    expect(
      within(faqSection).queryByRole('button', { name: /Will I receive an email after booking\?/i })
    ).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'zzzz-no-guide-match' } });
    expect(screen.getByText(/No step-by-step guides match your current search\./i)).toBeInTheDocument();
  });

  it('supports non-exclusive FAQ accordions, Expand all / Collapse all toggle, and related guide/FAQ navigation', () => {
    renderHelpCenter();

    const faqSection = document.getElementById('help-faq');
    const firstFaqBtn = within(faqSection).getByRole('button', {
      name: new RegExp(HELP_FAQS[0].question.replace(/[?]/g, '\\?'), 'i'),
    });
    const secondFaqBtn = within(faqSection).getByRole('button', {
      name: new RegExp(HELP_FAQS[1].question.replace(/[?]/g, '\\?'), 'i'),
    });

    expect(firstFaqBtn).toHaveAttribute('aria-expanded', 'true');
    expect(secondFaqBtn).toHaveAttribute('aria-expanded', 'false');

    // Opening second FAQ keeps first open (non-exclusive)
    fireEvent.click(secondFaqBtn);
    expect(firstFaqBtn).toHaveAttribute('aria-expanded', 'true');
    expect(secondFaqBtn).toHaveAttribute('aria-expanded', 'true');

    // Expand all / Collapse all syncs aria-expanded
    const toggleAllBtn = within(faqSection).getByRole('button', { name: /Expand all/i });
    expect(toggleAllBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggleAllBtn);
    expect(within(faqSection).getByRole('button', { name: /Collapse all/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    fireEvent.click(within(faqSection).getByRole('button', { name: /Collapse all/i }));
    expect(firstFaqBtn).toHaveAttribute('aria-expanded', 'false');

    // Clicking a related FAQ link inside a guide opens that FAQ
    const resetGuide = document.getElementById('guide-reset-password');
    const relatedFaqJump = within(resetGuide).getByRole('button', {
      name: /What should I do if I forget my password\?/i,
    });
    fireEvent.click(relatedFaqJump);
    expect(
      document.getElementById('help-faq-btn-faq-forgot-password')
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('wires guide next-step actions and renders verified contact links and copy actions', async () => {
    const onRegister = vi.fn();
    const onLogin = vi.fn();
    const onForgotPassword = vi.fn();
    const onBookAppointment = vi.fn();

    renderHelpCenter({
      onRegister,
      onLogin,
      onForgotPassword,
      onBookAppointment,
    });

    const guidesSection = document.getElementById('help-guides');

    fireEvent.click(within(guidesSection).getByRole('button', { name: /Go to Registration/i }));
    expect(onRegister).toHaveBeenCalledTimes(1);

    fireEvent.click(within(guidesSection).getByRole('button', { name: /Open Sign In Page/i }));
    expect(onLogin).toHaveBeenCalledTimes(1);

    fireEvent.click(within(guidesSection).getByRole('button', { name: /Reset Forgotten Password/i }));
    expect(onForgotPassword).toHaveBeenCalledTimes(1);

    fireEvent.click(within(guidesSection).getByRole('button', { name: /^Book an Appointment$/i }));
    expect(onBookAppointment).toHaveBeenCalledTimes(1);

    // Contact links and clipboard copy
    const phoneLink = screen.getByRole('link', { name: /Clinic Telephone/i });
    const emailLink = screen.getByRole('link', { name: /Clinic Support Email/i });
    expect(phoneLink).toHaveAttribute('href', expect.stringMatching(/^tel:/));
    expect(emailLink).toHaveAttribute('href', expect.stringMatching(/^mailto:/));

    fireEvent.click(screen.getByRole('button', { name: /Copy clinic support email/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });
  });

  it('supports Light Mode default and Dark Mode theme toggling cleanly without separate theme state', () => {
    renderHelpCenter();

    expect(document.documentElement.classList.contains('dark')).toBe(false);

    const themeButtons = screen.getAllByRole('button', { name: /Switch to dark mode/i });
    fireEvent.click(themeButtons[0]);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('toothcare_theme')).toBe('dark');
  });

  it('tracks active section indicator on scroll and renders the scroll progress bar', async () => {
    renderHelpCenter();

    expect(screen.getByTestId('help-scroll-progress')).toHaveClass('landing-scroll-progress');

    const helpNav = screen.getByRole('navigation', { name: 'Help Center Navigation' });
    const faqsLink = within(helpNav).getByRole('link', { name: 'FAQs' });
    const guidesLink = within(helpNav).getByRole('link', { name: 'User Guides' });

    // Initially at top: Help & Support is current page, in-page links have no location indicator
    expect(faqsLink).not.toHaveAttribute('aria-current');

    // Simulate scrolling into the FAQs section
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 700 });
    const mockRect = (top) => ({
      top,
      bottom: top + 500,
      left: 0,
      right: 1000,
      width: 1000,
      height: 500,
      x: 0,
      y: top,
      toJSON: () => {},
    });
    vi.spyOn(document.getElementById('help-hero'), 'getBoundingClientRect').mockReturnValue(mockRect(-700));
    vi.spyOn(document.getElementById('help-topics'), 'getBoundingClientRect').mockReturnValue(mockRect(-300));
    vi.spyOn(document.getElementById('help-faq'), 'getBoundingClientRect').mockReturnValue(mockRect(80));
    vi.spyOn(document.getElementById('help-guides'), 'getBoundingClientRect').mockReturnValue(mockRect(900));
    vi.spyOn(document.getElementById('help-contact'), 'getBoundingClientRect').mockReturnValue(mockRect(1600));

    fireEvent.scroll(window);

    await waitFor(() => {
      expect(faqsLink).toHaveAttribute('aria-current', 'location');
    });
    expect(guidesLink).not.toHaveAttribute('aria-current');
  });

  it('supports quick-search chips and "/" keyboard shortcut to focus search', () => {
    renderHelpCenter();

    const searchInput = screen.getByLabelText(/Search help articles, FAQs, and user guides/i);
    expect(document.activeElement).not.toBe(searchInput);

    // Press "/" outside an input to focus the search box
    fireEvent.keyDown(document, { key: '/' });
    expect(document.activeElement).toBe(searchInput);

    // Clicking a quick-search chip populates search and filters FAQs
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(searchInput).toHaveValue('Reset password');

    // Escape clears the active search query
    fireEvent.keyDown(searchInput, { key: 'Escape' });
    expect(searchInput).toHaveValue('');
  });
});
