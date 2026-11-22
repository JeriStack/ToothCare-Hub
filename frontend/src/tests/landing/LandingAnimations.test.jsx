import React, { useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LandingNavbar } from '../../features/landing/components/LandingNavbar';
import { FAQSection } from '../../features/landing/components/FAQSection';
import { HowItWorksSection } from '../../features/landing/components/HowItWorksSection';
import { BookingCTA } from '../../features/landing/components/BookingCTA';
import { useScrollReveal } from '../../features/landing/hooks/useScrollReveal';

vi.mock('../../features/auth', () => ({
  useAuth: () => ({ user: null, isAuthenticated: false }),
}));

vi.mock('../../components/ui/ThemeToggle', () => ({
  ThemeToggle: () => <button type="button">ThemeToggle</button>,
}));

function RevealTestHarness() {
  const rootRef = useRef(null);
  useScrollReveal(rootRef);

  return (
    <div ref={rootRef} className="landing-animated-root" data-testid="reveal-root">
      <div className="landing-reveal" data-reveal="left" data-testid="below-fold-item">
        Animated Block
      </div>
      <div className="landing-line-draw" data-testid="connector-line" aria-hidden="true" />
    </div>
  );
}

describe('Landing Page Animations', () => {
  const originalCSS = globalThis.CSS;
  const originalIO = globalThis.IntersectionObserver;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 2800,
      writable: true,
      configurable: true,
    });
    window.requestAnimationFrame = (cb) => {
      cb();
      return 1;
    };
    window.cancelAnimationFrame = () => {};
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  afterEach(() => {
    globalThis.CSS = originalCSS;
    globalThis.IntersectionObserver = originalIO;
    window.matchMedia = originalMatchMedia;
  });

  it('activates IntersectionObserver fallback when native view() timeline is unsupported and reveals elements when entering viewport', () => {
    let observerCallback = null;
    const observeMock = vi.fn();
    const unobserveMock = vi.fn();

    globalThis.CSS = { supports: vi.fn(() => false) };
    globalThis.IntersectionObserver = vi.fn(function (cb) {
      observerCallback = cb;
      return {
        observe: observeMock,
        unobserve: unobserveMock,
        disconnect: vi.fn(),
      };
    });

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 1200,
      bottom: 1400,
      left: 0,
      right: 100,
      width: 100,
      height: 200,
    });

    render(<RevealTestHarness />);

    const root = screen.getByTestId('reveal-root');
    const item = screen.getByTestId('below-fold-item');
    const line = screen.getByTestId('connector-line');

    expect(root).toHaveAttribute('data-reveal-fallback', 'true');
    expect(observeMock).toHaveBeenCalledWith(item);
    expect(observeMock).toHaveBeenCalledWith(line);
    expect(item).not.toHaveClass('is-revealed');
    expect(line).not.toHaveClass('is-revealed');

    observerCallback([
      { isIntersecting: true, boundingClientRect: { top: 400 }, target: item },
      { isIntersecting: true, boundingClientRect: { top: 420 }, target: line },
    ]);

    expect(item).toHaveClass('is-revealed');
    expect(line).toHaveClass('is-revealed');
    expect(unobserveMock).toHaveBeenCalledWith(item);
    expect(unobserveMock).toHaveBeenCalledWith(line);
  });

  it('skips JS fallback when native CSS view() timeline is supported or reduced motion is preferred', () => {
    globalThis.CSS = { supports: vi.fn(() => true) };
    const { unmount } = render(<RevealTestHarness />);
    expect(screen.getByTestId('reveal-root')).not.toHaveAttribute('data-reveal-fallback');
    unmount();

    globalThis.CSS = { supports: vi.fn(() => false) };
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(<RevealTestHarness />);
    expect(screen.getByTestId('reveal-root')).not.toHaveAttribute('data-reveal-fallback');
  });

  it('renders scroll progress indicator and updates scaleX fallback during scroll', () => {
    globalThis.CSS = { supports: vi.fn(() => false) };

    const { container } = render(
      <LandingNavbar onBookAppointment={vi.fn()} onLogin={vi.fn()} />
    );

    const progressBar = container.querySelector('.landing-scroll-progress');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-hidden', 'true');
    expect(progressBar.style.transform).toBe('scaleX(0)');

    window.scrollY = 1000;
    fireEvent.scroll(window);

    expect(progressBar.style.transform).toBe('scaleX(0.5)');
  });

  it('animates FAQ accordion panels via intrinsic data-open state transitions', () => {
    render(<FAQSection />);

    const firstButton = screen.getByRole('button', { name: /How do I book an appointment\?/i });
    const secondButton = screen.getByRole('button', { name: /Do I need an account/i });
    const firstPanel = document.getElementById('faq-content-0');
    const secondPanel = document.getElementById('faq-content-1');

    expect(firstButton).toHaveAttribute('aria-expanded', 'true');
    expect(firstPanel).toHaveAttribute('data-open', 'true');
    expect(secondPanel).toHaveAttribute('data-open', 'false');
    expect(secondPanel).toHaveAttribute('aria-hidden', 'true');

    fireEvent.click(secondButton);

    expect(firstPanel).toHaveAttribute('data-open', 'false');
    expect(secondButton).toHaveAttribute('aria-expanded', 'true');
    expect(secondPanel).toHaveAttribute('data-open', 'true');
    expect(secondPanel).toHaveAttribute('aria-hidden', 'false');
  });

  it('wires scroll-drawn connector, directional reveals, parallax scopes, and CTA shine effects', () => {
    const { container: stepsContainer } = render(
      <HowItWorksSection onBookAppointment={vi.fn()} />
    );
    expect(stepsContainer.querySelector('.landing-line-draw')).toBeInTheDocument();
    expect(stepsContainer.querySelectorAll('.landing-reveal[data-reveal="up"]').length).toBeGreaterThanOrEqual(4);
    expect(stepsContainer.querySelector('.landing-reveal[data-reveal="scale"]')).toBeInTheDocument();

    const { container: ctaContainer } = render(
      <BookingCTA onBookAppointment={vi.fn()} />
    );
    expect(ctaContainer.querySelector('.landing-parallax-scope')).toBeInTheDocument();
    expect(ctaContainer.querySelectorAll('.landing-parallax-layer').length).toBeGreaterThanOrEqual(2);
    expect(ctaContainer.querySelector('.landing-cta-shine')).toBeInTheDocument();
  });
});
