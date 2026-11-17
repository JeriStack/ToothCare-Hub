import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Phone,
  Mail,
  AlertCircle,
  Calendar,
  ArrowRight,
  Copy,
  Check,
  Headphones,
} from 'lucide-react';

const CLINIC_PHONE = '+63 (02) 8123-4567';
const CLINIC_PHONE_HREF = 'tel:+63281234567';
const CLINIC_EMAIL = 'reception@toothcarehub.local';
const CLINIC_EMAIL_HREF = 'mailto:reception@toothcarehub.local';

function getManilaClinicStatus(now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(now);

    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const weekday = map.weekday;
    const rawHour = Number(map.hour);
    const hour = rawHour === 24 ? 0 : rawHour;
    const minute = Number(map.minute);
    const totalMinutes = hour * 60 + minute;

    const isSunday = weekday === 'Sun';
    const isSaturday = weekday === 'Sat';
    const activeGroup = isSunday ? 'sun' : isSaturday ? 'sat' : 'mon-fri';
    const isWithinHours = !isSunday && totalMinutes >= 8 * 60 && totalMinutes < 17 * 60;

    return {
      activeGroup,
      isOpen: isWithinHours,
      statusLabel: isSunday ? 'Closed Today' : isWithinHours ? 'Open Now' : 'Closed Now',
    };
  } catch {
    return {
      activeGroup: 'mon-fri',
      isOpen: false,
      statusLabel: '08:00 AM – 05:00 PM',
    };
  }
}

export function ContactSection({ onBookAppointment }) {
  const [clinicStatus, setClinicStatus] = useState(() => getManilaClinicStatus());
  const [copiedField, setCopiedField] = useState(null);
  const copyTimerRef = useRef(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClinicStatus(getManilaClinicStatus());
    }, 60000);
    return () => {
      window.clearInterval(intervalId);
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

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
      // Clipboard may be unavailable in restricted contexts; ignore silently
    }
  };

  const scheduleRows = [
    {
      id: 'mon-fri',
      day: 'Monday – Friday',
      hours: '08:00 AM – 05:00 PM',
      closed: false,
    },
    {
      id: 'sat',
      day: 'Saturday',
      hours: '08:00 AM – 05:00 PM',
      closed: false,
    },
    {
      id: 'sun',
      day: 'Sunday',
      hours: 'Closed (Facility Sanitization)',
      closed: true,
    },
  ];

  return (
    <section
      id="contact"
      className="py-20 bg-white dark:bg-gray-900 border-t border-slate-100 dark:border-gray-800"
      aria-labelledby="contact-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="landing-reveal text-center max-w-2xl mx-auto space-y-3">
          <h2
            id="contact-heading"
            className="text-3xl sm:text-4xl font-extrabold text-[#12304A] dark:text-white tracking-tight"
          >
            Clinic Hours &amp; Support
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-gray-300 font-normal">
            We are here to support your dental health journey. Contact reception or book directly online.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Operating Hours Card */}
          <div
            className="landing-reveal lg:col-span-6 bg-[#F8FAFC] dark:bg-gray-800/95 border border-slate-200/90 dark:border-gray-700/80 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-lg dark:shadow-black/20 flex flex-col justify-between space-y-6"
            style={{ '--reveal-index': 0 }}
          >
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-500/15 border border-[#0D9488]/20 dark:border-teal-400/30 text-[#0D9488] dark:text-teal-300 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-gray-100 text-lg leading-snug">
                      Practice Operating Hours
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-gray-400">
                      Asia/Manila (UTC+08:00) Clinic Timezone
                    </p>
                  </div>
                </div>

                <span
                  data-testid="clinic-live-status"
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                    clinicStatus.isOpen
                      ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-400/35'
                      : 'bg-slate-100 dark:bg-gray-700/70 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-600'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      clinicStatus.isOpen ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-slate-400 dark:bg-gray-400'
                    }`}
                    aria-hidden="true"
                  />
                  <span>{clinicStatus.statusLabel}</span>
                </span>
              </div>

              <div className="space-y-2.5 text-xs sm:text-sm">
                {scheduleRows.map((row) => {
                  const isToday = clinicStatus.activeGroup === row.id;
                  return (
                    <div
                      key={row.id}
                      className={`px-3.5 py-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 transition-colors ${
                        row.closed
                          ? 'bg-rose-50/60 dark:bg-rose-950/25 border-rose-200/70 dark:border-rose-800/50'
                          : isToday
                          ? 'bg-teal-50/75 dark:bg-teal-500/10 border-[#0D9488]/30 dark:border-teal-400/35'
                          : 'bg-white/80 dark:bg-gray-900/40 border-slate-200/70 dark:border-gray-700/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold ${
                            row.closed
                              ? 'text-rose-700 dark:text-rose-300'
                              : 'text-slate-700 dark:text-gray-200'
                          }`}
                        >
                          {row.day}
                        </span>
                        {isToday && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[#CCFBF1] dark:bg-teal-500/20 text-[#0F766E] dark:text-teal-300">
                            Today
                          </span>
                        )}
                      </div>

                      {row.closed ? (
                        <span className="font-bold bg-rose-100/80 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 px-2.5 py-1 rounded-lg text-xs border border-rose-200 dark:border-rose-800/70">
                          {row.hours}
                        </span>
                      ) : (
                        <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                          {row.hours}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-amber-50/90 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-400/30 rounded-2xl p-4 flex items-start gap-3 text-xs">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-amber-900 dark:text-amber-200">Dental Emergencies</p>
                <p className="text-amber-800/90 dark:text-amber-200/85 leading-relaxed font-normal">
                  If you are experiencing severe oral pain, trauma, or swelling outside standard hours, please proceed
                  to your nearest emergency medical facility.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Reception & Booking Assistance */}
          <div
            className="landing-reveal lg:col-span-6 bg-[#12304A] dark:bg-gradient-to-br dark:from-slate-800/95 dark:to-gray-900 border border-[#1E4668] dark:border-teal-500/25 text-white rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-lg dark:shadow-black/25 flex flex-col justify-between space-y-7"
            style={{ '--reveal-index': 1 }}
          >
            <div className="space-y-6">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-400/15 border border-teal-400/25 text-teal-300 text-[11px] font-semibold">
                  <Headphones className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Reception &amp; Scheduling Desk</span>
                </span>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-2xl text-white tracking-tight">Need Assistance?</h3>
                  <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed">
                    Our reception team is available during operating hours to assist with appointment adjustments,
                    first-time registration inquiries, or special accommodation requirements.
                  </p>
                </div>
              </div>

              <div className="space-y-3.5 text-xs sm:text-sm">
                <div className="group flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.09] border border-white/10 hover:border-teal-400/35 transition-all">
                  <a
                    href={CLINIC_PHONE_HREF}
                    className="flex items-center gap-3.5 min-w-0 flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded-lg"
                  >
                    <div className="w-10 h-10 rounded-xl bg-teal-400/15 border border-teal-400/25 text-teal-300 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] text-slate-400 block">Reception Desk</span>
                      <span className="font-bold text-white tabular-nums group-hover:text-teal-200 transition-colors">
                        {CLINIC_PHONE}
                      </span>
                    </div>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy('phone', CLINIC_PHONE)}
                    aria-label="Copy reception phone number"
                    title="Copy phone number"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[11px] font-medium text-slate-300 hover:text-white transition-colors shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
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

                <div className="group flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.09] border border-white/10 hover:border-teal-400/35 transition-all">
                  <a
                    href={CLINIC_EMAIL_HREF}
                    className="flex items-center gap-3.5 min-w-0 flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded-lg"
                  >
                    <div className="w-10 h-10 rounded-xl bg-teal-400/15 border border-teal-400/25 text-teal-300 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] text-slate-400 block">Clinic Support Email</span>
                      <span className="font-bold text-white truncate block group-hover:text-teal-200 transition-colors">
                        {CLINIC_EMAIL}
                      </span>
                    </div>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy('email', CLINIC_EMAIL)}
                    aria-label="Copy clinic support email"
                    title="Copy email address"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[11px] font-medium text-slate-300 hover:text-white transition-colors shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
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
              </div>
            </div>

            <button
              type="button"
              onClick={onBookAppointment}
              className="group w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] dark:hover:bg-teal-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-teal-950/30 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#12304A] dark:focus-visible:ring-offset-gray-900"
            >
              <Calendar className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Book Consultation Online</span>
              <ArrowRight
                className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
export default ContactSection;
