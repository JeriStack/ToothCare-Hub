/**
 * Centralized public clinic contact configuration for ToothCare Hub.
 *
 * Reads optional build-time Vite environment overrides (`VITE_CLINIC_*`) when
 * configured for production deployments. Development defaults mirror the
 * existing public Landing Page (`ContactSection.jsx`) and must be confirmed
 * by clinic management before public production publication.
 */
const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

const rawPhone = (env.VITE_CLINIC_PHONE || '+63 (02) 8123-4567').trim();
const rawPhoneHref = (
  env.VITE_CLINIC_PHONE_HREF ||
  `tel:${rawPhone.replace(/[^+\d]/g, '')}`
).trim();
const rawEmail = (env.VITE_CLINIC_EMAIL || 'reception@toothcarehub.local').trim();
const rawAddress = (env.VITE_CLINIC_ADDRESS || '').trim();
const rawTimezone = (env.VITE_CLINIC_TIMEZONE || 'Asia/Manila (UTC+08:00)').trim();

export const CLINIC_CONTACT = {
  phone: rawPhone,
  phoneHref: rawPhoneHref,
  email: rawEmail,
  emailHref: `mailto:${rawEmail}`,
  /** Only displayed publicly when explicitly approved and configured via VITE_CLINIC_ADDRESS. */
  address: rawAddress || null,
  timezone: rawTimezone,
  isDevPlaceholderContact:
    !env.VITE_CLINIC_EMAIL || rawEmail.endsWith('.local') || rawEmail.endsWith('.example.com'),
  operatingHours: [
    { id: 'mon-fri', day: 'Monday – Friday', hours: '08:00 AM – 05:00 PM', closed: false },
    { id: 'sat', day: 'Saturday', hours: '08:00 AM – 05:00 PM', closed: false },
    { id: 'sun', day: 'Sunday', hours: 'Closed (Facility Sanitization)', closed: true },
  ],
};
