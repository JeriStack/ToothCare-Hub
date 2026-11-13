import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);

  const faqs = [
    {
      q: 'How do I book an appointment?',
      a: 'Select your desired dental service, choose your preferred dentist, and pick an available date and time slot in our live scheduling picker. Once you review your details and submit, your booking request is immediately recorded.',
    },
    {
      q: 'Do I need an account to request an appointment?',
      a: 'Yes. Registering a patient account ensures that your appointment records, health notes, and visit history remain private, secure, and easily accessible from any device.',
    },
    {
      q: 'Can I choose my preferred dentist?',
      a: 'Absolutely. You can explore each certified dentist profile, including their clinical specialty, assigned operatory chair, and active working shift days before choosing your provider.',
    },
    {
      q: 'How do I know if my appointment is confirmed?',
      a: 'When you submit a request, its initial status is Pending. Our clinic reception team reviews chair allocation and dentist availability to approve the slot. Once approved, the status advances to Confirmed, and you can track this directly in your portal.',
    },
    {
      q: 'Can I cancel or reschedule an appointment?',
      a: 'Yes. You can cancel or reschedule any appointment currently in Pending or Confirmed status through your My Appointments page. When you reschedule, our system cancels the original slot and seamlessly creates a new linked appointment referencing your previous booking.',
    },
    {
      q: 'How can I view my appointment status and history?',
      a: 'Sign in to your patient account and navigate to My Appointments. Each consultation card shows its current state along with an immutable chronological status timeline detailing every review update.',
    },
  ];

  const toggleFAQ = (idx) => {
    setOpenIndex(openIndex === idx ? -1 : idx);
  };

  return (
    <section className="py-20 bg-slate-50/60 border-t border-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="text-center space-y-3">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#12304A] tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-normal">
            Everything you need to know about our scheduling process, dentist availability, and visit policies.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden transition-all shadow-xs"
              >
                <button
                  type="button"
                  id={`faq-btn-${idx}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-content-${idx}`}
                  onClick={() => toggleFAQ(idx)}
                  className="w-full text-left p-5 sm:p-6 flex items-center justify-between gap-4 font-bold text-slate-900 text-sm sm:text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
                >
                  <span>{faq.q}</span>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-slate-200 text-slate-500 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 bg-slate-100 text-slate-800' : 'bg-white'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div
                    id={`faq-content-${idx}`}
                    role="region"
                    aria-labelledby={`faq-btn-${idx}`}
                    className="px-5 pb-5 sm:px-6 sm:pb-6 text-xs sm:text-sm text-slate-600 leading-relaxed font-normal border-t border-slate-100 pt-3"
                  >
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
