import React from 'react';
import { LandingNavbar } from './components/LandingNavbar';
import { HeroSection } from './components/HeroSection';
import { TrustSection } from './components/TrustSection';
import { AboutSection } from './components/AboutSection';
import { ServicesSection } from './components/ServicesSection';
import { DentistsSection } from './components/DentistsSection';
import { HowItWorksSection } from './components/HowItWorksSection';
import { BookingCTA } from './components/BookingCTA';
import { BenefitsSection } from './components/BenefitsSection';
import { FAQSection } from './components/FAQSection';
import { ContactSection } from './components/ContactSection';
import { LandingFooter } from './components/LandingFooter';

export function LandingPage({ onBookAppointment, onLogin, onAdminLogin }) {
  const handleScrollToServices = () => {
    const el = document.getElementById('services');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans selection:bg-[#CCFBF1] selection:text-[#0F766E]">
      {/* 1. Header Navigation */}
      <LandingNavbar
        onBookAppointment={() => onBookAppointment?.()}
        onLogin={() => onLogin?.()}
      />

      {/* Main Content Area */}
      <main>
        {/* 2. Hero Section */}
        <HeroSection
          onBookAppointment={() => onBookAppointment?.()}
          onExploreServices={handleScrollToServices}
        />

        {/* 3. Trust & Core Value Props */}
        <TrustSection />

        {/* 4. About Platform */}
        <AboutSection
          onBookAppointment={() => onBookAppointment?.()}
        />

        {/* 5. Dental Services Catalog */}
        <ServicesSection
          onBookService={(service) => onBookAppointment?.(service)}
        />

        {/* 6. Our Certified Dentists */}
        <DentistsSection
          onSelectDentist={(dentist) => onBookAppointment?.(null, dentist)}
        />

        {/* 7. How It Works */}
        <HowItWorksSection
          onBookAppointment={() => onBookAppointment?.()}
        />

        {/* 8. Call To Action Banner */}
        <BookingCTA
          onBookAppointment={() => onBookAppointment?.()}
          onLogin={() => onLogin?.()}
        />

        {/* 9. Patient Benefits & Experience */}
        <BenefitsSection />

        {/* 10. Frequently Asked Questions */}
        <FAQSection />

        {/* 11. Practice Hours & Support */}
        <ContactSection
          onBookAppointment={() => onBookAppointment?.()}
        />
      </main>

      {/* 12. Footer */}
      <LandingFooter
        onLogin={() => onLogin?.()}
        onBookAppointment={() => onBookAppointment?.()}
        onAdminLogin={() => onAdminLogin?.()}
      />
    </div>
  );
}
export default LandingPage;
