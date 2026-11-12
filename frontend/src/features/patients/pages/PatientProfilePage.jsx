import React, { useEffect, useMemo, useState } from 'react';
import {
  User,
  Phone,
  Mail,
  MapPin,
  HeartPulse,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Save,
  RefreshCw,
  Calendar,
  Lock,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import { patientsApi } from '../api';
import { ProfilePhotoUploader } from '../../../components/ui/ProfilePhotoUploader';

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  gender: 'PREFER_NOT_TO_SAY',
  phone: '',
  address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  medical_alerts: '',
};

function mapProfileToForm(data) {
  return {
    first_name: data?.first_name || '',
    last_name: data?.last_name || '',
    date_of_birth: data?.date_of_birth ? String(data.date_of_birth).slice(0, 10) : '',
    gender: data?.gender || 'PREFER_NOT_TO_SAY',
    phone: data?.phone || '',
    address: data?.address || '',
    emergency_contact_name: data?.emergency_contact_name || '',
    emergency_contact_phone: data?.emergency_contact_phone || '',
    medical_alerts: data?.medical_alerts || '',
  };
}

function getFieldInputClasses(hasError, extra = '') {
  const base =
    'w-full px-3.5 py-2.5 min-h-[44px] rounded-xl text-sm text-[#12304A] bg-white border transition-colors focus:outline-none focus-visible:ring-2';
  const state = hasError
    ? 'border-red-400 focus-visible:ring-red-200 focus:border-red-500'
    : 'border-slate-300 hover:border-slate-400 focus-visible:ring-teal-500/25 focus:border-[#0D9488]';
  return `${base} ${state} ${extra}`.trim();
}

export function PatientProfilePage({ onProfileUpdated }) {
  const { user, refreshUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [savedSnapshot, setSavedSnapshot] = useState(EMPTY_FORM);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [formErrors, setFormErrors] = useState({});

  const loadProfile = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await patientsApi.getMyProfile();
      setProfile(data);
      const mapped = mapProfileToForm(data);
      setFormData(mapped);
      setSavedSnapshot(mapped);
    } catch (err) {
      setErrorMsg(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to load your patient profile.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const isDirty = useMemo(
    () => Object.keys(EMPTY_FORM).some((key) => formData[key] !== savedSnapshot[key]),
    [formData, savedSnapshot]
  );

  const completeness = useMemo(() => {
    const trackedFields = [
      formData.first_name,
      formData.last_name,
      formData.date_of_birth,
      formData.phone,
      formData.address,
      formData.emergency_contact_name,
      formData.emergency_contact_phone,
      formData.medical_alerts,
    ];
    const filled = trackedFields.filter((v) => String(v || '').trim().length > 0).length;
    return {
      filled,
      total: trackedFields.length,
      percent: Math.round((filled / trackedFields.length) * 100),
    };
  }, [formData]);

  const fullName = `${formData.first_name || profile?.first_name || ''} ${
    formData.last_name || profile?.last_name || ''
  }`.trim() || 'Patient Account';

  const initials =
    `${(formData.first_name || profile?.first_name || 'P')[0] || ''}${
      (formData.last_name || profile?.last_name || '')[0] || ''
    }`.toUpperCase() || 'PT';

  const serverAvatarUrl = profile?.avatar_url || user?.patient?.avatar_url || null;

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (successMsg) setSuccessMsg('');
    if (errorMsg) setErrorMsg('');
  };

  const handleDiscardChanges = () => {
    setFormData(savedSnapshot);
    setFormErrors({});
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleAvatarChangeSuccess = async (message, updated) => {
    setProfile((prev) =>
      updated
        ? updated
        : prev
        ? { ...prev, avatar_url: message.includes('removed') ? null : prev.avatar_url }
        : prev
    );
    await refreshUser?.();
    if (onProfileUpdated) {
      onProfileUpdated(message);
    }
  };

  const validate = () => {
    const errors = {};
    if (!formData.first_name.trim()) {
      errors.first_name = 'First name is required.';
    }
    if (!formData.last_name.trim()) {
      errors.last_name = 'Last name is required.';
    }
    if (!formData.phone.trim()) {
      errors.phone = 'Contact phone is required.';
    } else if (formData.phone.trim().length < 7) {
      errors.phone = 'Please enter a valid contact phone number.';
    }

    if (formData.date_of_birth) {
      const dob = new Date(formData.date_of_birth);
      const today = new Date();
      if (Number.isNaN(dob.getTime()) || dob >= today) {
        errors.date_of_birth = 'Date of birth must be in the past.';
      }
    }

    setFormErrors(errors);
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      const firstInvalidEl = document.getElementById(errorKeys[0]);
      firstInvalidEl?.focus?.();
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender || 'PREFER_NOT_TO_SAY',
        phone: formData.phone.trim(),
        address: formData.address.trim() || null,
        emergency_contact_name: formData.emergency_contact_name.trim() || null,
        emergency_contact_phone: formData.emergency_contact_phone.trim() || null,
        medical_alerts: formData.medical_alerts.trim() || null,
      };

      const updated = await patientsApi.updateMyProfile(payload);
      setProfile(updated);
      const mapped = mapProfileToForm(updated);
      setFormData(mapped);
      setSavedSnapshot(mapped);
      setSuccessMsg('Your patient profile details have been updated.');
      await refreshUser?.();
      if (onProfileUpdated) {
        onProfileUpdated('Your clinical profile has been updated.');
      }
    } catch (err) {
      const details = err.response?.data?.error?.details;
      if (details && typeof details === 'object') {
        const mappedErrors = {};
        Object.keys(details).forEach((key) => {
          mappedErrors[key] = Array.isArray(details[key]) ? details[key][0] : details[key];
        });
        setFormErrors(mappedErrors);
      }
      setErrorMsg(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to save profile changes.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-lg bg-slate-200" />
          <div className="h-4 w-80 max-w-full rounded-lg bg-slate-200" />
        </div>
        <div className="portal-split-1-2 gap-6 items-start">
          <div className="h-80 rounded-2xl bg-white border border-slate-200" />
          <div className="space-y-5">
            <div className="h-56 rounded-2xl bg-white border border-slate-200" />
            <div className="h-56 rounded-2xl bg-white border border-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#12304A] tracking-tight">My Profile</h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Manage your personal patient record, profile photo, contact details, and medical disclosure.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isDirty && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Unsaved changes
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F0FDFA] text-[#0F766E] border border-[#CCFBF1]">
            <ShieldCheck className="w-3.5 h-3.5" />
            {completeness.percent}% Complete
          </span>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="portal-split-1-2 gap-6 items-start">
        {/* LEFT COLUMN: Profile Photo & Patient Identity Summary */}
        <aside className="space-y-5">
          <section
            aria-label="Profile Photo and Account Summary"
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="h-20 bg-gradient-to-r from-[#12304A] via-[#134E4A] to-[#0D9488]" />

            <div className="px-5 pb-6 -mt-11">
              <ProfilePhotoUploader
                fullName={fullName}
                initials={initials}
                serverAvatarUrl={serverAvatarUrl}
                subtitle={profile?.email || user?.email || 'Verified Patient Account'}
                onUploadFile={(file) => patientsApi.uploadMyAvatar(file)}
                onRemoveFile={() => patientsApi.deleteMyAvatar()}
                onSuccess={handleAvatarChangeSuccess}
              />

              <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">Profile Completeness</span>
                  <span className="font-semibold text-[#12304A]">
                    {completeness.filled}/{completeness.total} fields
                  </span>
                </div>
                <div
                  className="w-full h-2 rounded-full bg-slate-100 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={completeness.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Profile completeness"
                >
                  <div
                    className="h-full rounded-full bg-[#0D9488] transition-all duration-300"
                    style={{ width: `${completeness.percent}%` }}
                  />
                </div>

                <dl className="pt-2 space-y-2 text-xs">
                  {profile?.id && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-slate-600">Patient Record</dt>
                      <dd className="font-semibold text-[#12304A]">#{profile.id}</dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-600">Account Status</dt>
                    <dd className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Active &amp; Verified
                    </dd>
                  </div>
                  {typeof profile?.appointment_count === 'number' && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-slate-600">Total Appointments</dt>
                      <dd className="font-semibold text-[#12304A]">{profile.appointment_count}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </section>
        </aside>

        {/* RIGHT COLUMN: Form Sections */}
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-xs font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-800 text-xs font-medium"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. Personal Demographics */}
          <section
            aria-labelledby="demographics-heading"
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5"
          >
            <div className="pb-3.5 border-b border-slate-100">
              <h2
                id="demographics-heading"
                className="text-sm font-bold text-[#12304A] flex items-center gap-2"
              >
                <span className="w-7 h-7 rounded-lg bg-[#F0FDFA] text-[#0D9488] flex items-center justify-center">
                  <User className="w-4 h-4" />
                </span>
                Personal Demographics
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Used on clinical dental charts, prescriptions, and appointment records.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="first_name"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  First Name <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="first_name"
                  type="text"
                  name="first_name"
                  autoComplete="given-name"
                  required
                  value={formData.first_name}
                  onChange={handleChange}
                  aria-invalid={Boolean(formErrors.first_name)}
                  aria-describedby={formErrors.first_name ? 'first_name-error' : undefined}
                  placeholder="First name"
                  className={getFieldInputClasses(Boolean(formErrors.first_name))}
                />
                {formErrors.first_name && (
                  <p id="first_name-error" className="text-xs text-red-600 font-medium mt-1">
                    {formErrors.first_name}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="last_name"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Last Name <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="last_name"
                  type="text"
                  name="last_name"
                  autoComplete="family-name"
                  required
                  value={formData.last_name}
                  onChange={handleChange}
                  aria-invalid={Boolean(formErrors.last_name)}
                  aria-describedby={formErrors.last_name ? 'last_name-error' : undefined}
                  placeholder="Last name"
                  className={getFieldInputClasses(Boolean(formErrors.last_name))}
                />
                {formErrors.last_name && (
                  <p id="last_name-error" className="text-xs text-red-600 font-medium mt-1">
                    {formErrors.last_name}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="date_of_birth"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Date of Birth
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="date_of_birth"
                    type="date"
                    name="date_of_birth"
                    autoComplete="bday"
                    max={todayIso}
                    value={formData.date_of_birth}
                    onChange={handleChange}
                    aria-invalid={Boolean(formErrors.date_of_birth)}
                    aria-describedby={formErrors.date_of_birth ? 'date_of_birth-error' : undefined}
                    className={getFieldInputClasses(Boolean(formErrors.date_of_birth), 'pl-10')}
                  />
                </div>
                {formErrors.date_of_birth && (
                  <p id="date_of_birth-error" className="text-xs text-red-600 font-medium mt-1">
                    {formErrors.date_of_birth}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="gender"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Gender
                </label>
                <select
                  id="gender"
                  name="gender"
                  autoComplete="sex"
                  value={formData.gender}
                  onChange={handleChange}
                  className={getFieldInputClasses(false)}
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                </select>
              </div>
            </div>
          </section>

          {/* 2. Contact & Residential Info */}
          <section
            aria-labelledby="contact-heading"
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5"
          >
            <div className="pb-3.5 border-b border-slate-100">
              <h2
                id="contact-heading"
                className="text-sm font-bold text-[#12304A] flex items-center gap-2"
              >
                <span className="w-7 h-7 rounded-lg bg-[#F0FDFA] text-[#0D9488] flex items-center justify-center">
                  <Phone className="w-4 h-4" />
                </span>
                Contact Information
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Keep your mobile number and address current for appointment reminders.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="email"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Account Email
                  </label>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F766E]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified
                  </span>
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={profile?.email || user?.email || ''}
                    readOnly
                    aria-describedby="email-help"
                    className="w-full pl-10 pr-10 py-2.5 min-h-[44px] rounded-xl text-sm text-slate-600 bg-slate-50 border border-slate-200 cursor-not-allowed focus:outline-none"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p id="email-help" className="text-xs text-slate-600 mt-1.5">
                  To update your login email, please request administrative re-verification at the clinic reception.
                </p>
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Contact Phone <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="phone"
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    aria-invalid={Boolean(formErrors.phone)}
                    aria-describedby={formErrors.phone ? 'phone-error' : undefined}
                    placeholder="+63 917 123 4567"
                    className={getFieldInputClasses(Boolean(formErrors.phone), 'pl-10')}
                  />
                </div>
                {formErrors.phone && (
                  <p id="phone-error" className="text-xs text-red-600 font-medium mt-1">
                    {formErrors.phone}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="address"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Residential Address
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="address"
                    type="text"
                    name="address"
                    autoComplete="street-address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Street, Barangay, City"
                    className={getFieldInputClasses(false, 'pl-10')}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 3. Emergency Contact & Medical History */}
          <section
            aria-labelledby="medical-heading"
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5"
          >
            <div className="pb-3.5 border-b border-slate-100">
              <h2
                id="medical-heading"
                className="text-sm font-bold text-[#12304A] flex items-center gap-2"
              >
                <span className="w-7 h-7 rounded-lg bg-[#F0FDFA] text-[#0D9488] flex items-center justify-center">
                  <HeartPulse className="w-4 h-4" />
                </span>
                Emergency Contact &amp; Medical History
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Emergency reach details and clinical safety alerts for your care team.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="emergency_contact_name"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Emergency Contact Name
                </label>
                <input
                  id="emergency_contact_name"
                  type="text"
                  name="emergency_contact_name"
                  value={formData.emergency_contact_name}
                  onChange={handleChange}
                  placeholder="e.g. Maria Dela Cruz (Spouse)"
                  className={getFieldInputClasses(false)}
                />
              </div>

              <div>
                <label
                  htmlFor="emergency_contact_phone"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Emergency Contact Phone
                </label>
                <input
                  id="emergency_contact_phone"
                  type="tel"
                  name="emergency_contact_phone"
                  value={formData.emergency_contact_phone}
                  onChange={handleChange}
                  placeholder="+63 917 765 4321"
                  className={getFieldInputClasses(false)}
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="medical_alerts"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Medical History &amp; Allergies Disclosure
                </label>
                <textarea
                  id="medical_alerts"
                  name="medical_alerts"
                  rows={3}
                  value={formData.medical_alerts}
                  onChange={handleChange}
                  aria-describedby="medical_alerts-help"
                  placeholder="Disclose known allergies (e.g., Penicillin, Latex), chronic conditions, or regular medications..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm text-[#12304A] bg-white border border-slate-300 hover:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/25 focus:border-[#0D9488] resize-y"
                />
                <p id="medical_alerts-help" className="text-xs text-slate-600 mt-1.5">
                  This information is kept confidential and only shared with your attending dentist for clinical safety.
                </p>
              </div>
            </div>
          </section>

          {/* Form Action Footer */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-slate-600">
              {isDirty
                ? 'Review your updates above, then save to sync your patient chart.'
                : 'Your patient record is up to date.'}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleDiscardChanges}
                disabled={!isDirty || isSaving}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Discard Changes
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold text-white bg-[#0D9488] hover:bg-[#0F766E] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Profile Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PatientProfilePage;
