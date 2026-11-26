import { useEffect, useState } from 'react';
import { systemApi } from './api';

export const DEFAULT_CLINIC_SETTINGS = {
  clinic_name: 'ToothCare Hub',
  clinic_tagline: 'Healthier Smiles, Brighter Futures.',
  clinic_phone: '+63 912 345 6789',
  clinic_email: 'contact@toothcarehub.example.com',
  clinic_address: '123 Dental Wellness Plaza, Manila, Philippines',
  clinic_timezone: 'Asia/Manila',
  booking_advance_days_max: 60,
  cancellation_cutoff_hours: 24,
  slot_duration_default_minutes: 30,
};

let cachedSettings = null;
let inflightPromise = null;

function normalizeSettings(raw = {}) {
  const getVal = (key, fallback) => {
    const entry = raw[key];
    if (entry && typeof entry === 'object' && 'value' in entry) {
      return entry.value ?? fallback;
    }
    return entry ?? fallback;
  };

  return {
    clinic_name: String(getVal('clinic_name', DEFAULT_CLINIC_SETTINGS.clinic_name) || DEFAULT_CLINIC_SETTINGS.clinic_name),
    clinic_tagline: String(getVal('clinic_tagline', DEFAULT_CLINIC_SETTINGS.clinic_tagline) ?? ''),
    clinic_phone: String(getVal('clinic_phone', DEFAULT_CLINIC_SETTINGS.clinic_phone) ?? ''),
    clinic_email: String(getVal('clinic_email', DEFAULT_CLINIC_SETTINGS.clinic_email) ?? ''),
    clinic_address: String(getVal('clinic_address', DEFAULT_CLINIC_SETTINGS.clinic_address) ?? ''),
    clinic_timezone: String(getVal('clinic_timezone', DEFAULT_CLINIC_SETTINGS.clinic_timezone) || 'Asia/Manila'),
    booking_advance_days_max:
      Number(getVal('booking_advance_days_max', DEFAULT_CLINIC_SETTINGS.booking_advance_days_max)) || 60,
    cancellation_cutoff_hours:
      Number(getVal('cancellation_cutoff_hours', DEFAULT_CLINIC_SETTINGS.cancellation_cutoff_hours)) ?? 24,
    slot_duration_default_minutes:
      Number(getVal('slot_duration_default_minutes', DEFAULT_CLINIC_SETTINGS.slot_duration_default_minutes)) || 30,
  };
}

export function broadcastClinicSettingsUpdate(rawSettings) {
  const normalized = normalizeSettings(rawSettings);
  cachedSettings = normalized;
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toothcare:clinic-settings-updated', { detail: normalized }));
    }
  } catch {
    // Ignore in non-browser environments
  }
  return normalized;
}

export function useClinicSettings() {
  const [settings, setSettings] = useState(() => cachedSettings || DEFAULT_CLINIC_SETTINGS);

  useEffect(() => {
    let mounted = true;

    if (!cachedSettings && typeof systemApi?.getPublicSettings === 'function') {
      if (!inflightPromise) {
        inflightPromise = systemApi
          .getPublicSettings()
          .then((data) => {
            cachedSettings = normalizeSettings(data);
            return cachedSettings;
          })
          .catch(() => DEFAULT_CLINIC_SETTINGS)
          .finally(() => {
            inflightPromise = null;
          });
      }
      inflightPromise.then((resolved) => {
        if (mounted && resolved) {
          setSettings(resolved);
        }
      });
    }

    const handleUpdated = (event) => {
      if (mounted && event?.detail) {
        setSettings(normalizeSettings(event.detail));
      }
    };

    window.addEventListener('toothcare:clinic-settings-updated', handleUpdated);
    return () => {
      mounted = false;
      window.removeEventListener('toothcare:clinic-settings-updated', handleUpdated);
    };
  }, []);

  return settings;
}
