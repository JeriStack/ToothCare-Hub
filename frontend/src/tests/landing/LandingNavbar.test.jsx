import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LandingNavbar } from '../../features/landing/components/LandingNavbar';

vi.mock('../../features/auth', () => ({
  useAuth: () => ({ user: null, isAuthenticated: false }),
}));

vi.mock('../../components/ui/ThemeToggle', () => ({
  ThemeToggle: () => <button type="button">ThemeToggle</button>,
}));

function mountSections(offsets = {
  home: 0,
  about: 650,
  services: 1300,
  dentists: 2000,
  'how-it-works': 2700,
  contact: 3400,
}) {
  const container = document.createElement('div');
  Object.entries(offsets).forEach(([id, top]) => {
    const section = document.createElement('section');
    section.id = id;
    section.getBoundingClientRect = () => ({
      top: top - window.scrollY,
      bottom: top + 600 - window.scrollY,
      left: 0,
      right: 1200,
      width: 1200,
      height: 600,
    });
    container.appendChild(section);
  });
  document.body.appendChild(container);
  return container;
}

describe('LandingNavbar Section Navigation & Active Highlight', () => {
  let sectionsRoot = null;

  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 900, writable: true, configurable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 4200,
      writable: true,
      configurable: true,
    });
    window.scrollTo = vi.fn(({ top }) => {
      window.scrollY = top;
    });
    window.requestAnimationFrame = (cb) => {
      cb();
      return 1;
    };
    window.cancelAnimationFrame = () => {};
    sectionsRoot = mountSections();
  });

  afterEach(() => {
    sectionsRoot?.remove();
    sectionsRoot = null;
  });

  it('renders navigation links in exact vertical landing page section order', () => {
    render(<LandingNavbar onBookAppointment={vi.fn()} onLogin={vi.fn()} />);

    const primaryNav = screen.getByRole('navigation', { name: 'Primary' });
    const linkLabels = Array.from(primaryNav.querySelectorAll('a')).map((el) => el.textContent);

    expect(linkLabels).toEqual([
      'Home',
      'About',
      'Services',
      'Our Dentists',
      'How It Works',
      'Contact',
    ]);
  });

  it('marks Home active initially and switches aria-current & highlight cleanly on click', () => {
    render(<LandingNavbar onBookAppointment={vi.fn()} onLogin={vi.fn()} />);

    const primaryNav = screen.getByRole('navigation', { name: 'Primary' });
    const homeLink = Array.from(primaryNav.querySelectorAll('a')).find((a) => a.textContent === 'Home');
    const contactLink = Array.from(primaryNav.querySelectorAll('a')).find((a) => a.textContent === 'Contact');

    expect(homeLink).toHaveAttribute('aria-current', 'location');
    expect(contactLink).not.toHaveAttribute('aria-current');

    fireEvent.click(contactLink);

    expect(contactLink).toHaveAttribute('aria-current', 'location');
    expect(homeLink).not.toHaveAttribute('aria-current');
    expect(window.scrollTo).toHaveBeenCalled();

    // Intermediate scroll events during smooth scroll must not flicker back to Services/About
    window.scrollY = 1350;
    fireEvent(window, new Event('scroll'));
    expect(contactLink).toHaveAttribute('aria-current', 'location');
  });

  it('updates active highlight on scroll and selects Contact near the bottom of the page', () => {
    render(<LandingNavbar onBookAppointment={vi.fn()} onLogin={vi.fn()} />);

    const primaryNav = screen.getByRole('navigation', { name: 'Primary' });
    const getLink = (label) => Array.from(primaryNav.querySelectorAll('a')).find((a) => a.textContent === label);

    window.scrollY = 600; // #about top = 50 (<= 140)
    fireEvent(window, new Event('scroll'));
    expect(getLink('About')).toHaveAttribute('aria-current', 'location');

    window.scrollY = 1250; // #services top = 50 (<= 140)
    fireEvent(window, new Event('scroll'));
    expect(getLink('Services')).toHaveAttribute('aria-current', 'location');

    // Bottom of page where #contact top might still be > 140px
    window.scrollY = 3300; // 3300 + 900 >= 4200 - 24
    fireEvent(window, new Event('scroll'));
    expect(getLink('Contact')).toHaveAttribute('aria-current', 'location');
  });
});
