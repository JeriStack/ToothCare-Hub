import React, { useEffect, useMemo, useState } from 'react';
import {
  User,
  Phone,
  Mail,
  Stethoscope,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Save,
  RefreshCw,
  Lock,
  Award,
  Building2,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import { dentistsApi } from '../api';
import { ProfilePhotoUploader } from '../../../components/ui/ProfilePhotoUploader';
import { ProfileSkeleton } from '../../../components/skeletons';

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  specialization: '',
  phone: '',
  default_operatory_chair: 'Chair 1',
  bio: '',
};

function mapProfileToForm(data) {
  return {
    first_name: data?.first_name || '',
    last_name: data?.last_name || '',
    specialization: data?.specialization || '',
    phone: data?.phone || '',
    default_operatory_chair: data?.default_operatory_chair || 'Chair 1',
    bio: data?.bio || '',
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

export function DentistProfilePage({ onProfileUpdated }) {
  const { user, refreshUser, updateUser } = useAuth();

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
      const data = await dentistsApi.getMyProfile();
      setProfile(data);
      const mapped = mapProfileToForm(data);
      setFormData(mapped);
      setSavedSnapshot(mapped);
    } catch (err) {
      setErrorMsg(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to load your dentist profile.'
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
      formData.specialization,
      formData.phone,
      formData.default_operatory_chair,
      formData.bio,
    ];
    const filled = trackedFields.filter((v) => String(v || '').trim().length > 0).length;
    return {
      filled,
      total: trackedFields.length,
      percent: Math.round((filled / trackedFields.length) * 100),
    };
  }, [formData]);

  const fullName =
    `Dr. ${`${formData.first_name || profile?.first_name || ''} ${
      formData.last_name || profile?.last_name || ''
    }`.trim()}`.replace(/^Dr\.\s*$/, 'Dentist Account');

  const initials =
    `${(formData.first_name || profile?.first_name || 'D')[0] || ''}${
      (formData.last_name || profile?.last_name || '')[0] || ''
    }`.toUpperCase() || 'DR';

  const serverAvatarUrl = profile?.avatar_url || user?.dentist?.avatar_url || null;

  const handleAvatarChangeSuccess = async (message, updated) => {
    if (updated) {
      setProfile(updated);
      updateUser?.((prev) => (prev ? {
        ...prev,
        avatar_url: updated.avatar_url,
        dentist: { ...(prev.dentist || {}), avatar_url: updated.avatar_url },
      } : prev));
    } else {
      setProfile((prev) =>
        prev ? { ...prev, avatar_url: message.includes('removed') ? null : prev.avatar_url } : prev
      );
      if (message.includes('removed')) {
        updateUser?.((prev) => (prev ? {
          ...prev,
          avatar_url: null,
          dentist: { ...(prev.dentist || {}), avatar_url: null },
        } : prev));
      }
    }
    await refreshUser?.();
    if (onProfileUpdated) {
      onProfileUpdated(message);
    }
  };

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

  const validate = () => {
    const errors = {};
    if (!formData.first_name.trim()) {
      errors.first_name = 'First name is required.';
    }
    if (!formData.last_name.trim()) {
      errors.last_name = 'Last name is required.';
    }
    if (!formData.specialization.trim()) {
      errors.specialization = 'Specialization is required.';
    }
    if (!formData.phone.trim()) {
      errors.phone = 'Contact phone is required.';
    } else if (formData.phone.trim().length < 7) {
      errors.phone = 'Please enter a valid contact phone number.';
    }

    setFormErrors(errors);
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      document.getElementById(errorKeys[0])?.focus?.();
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        specialization: formData.specialization.trim(),
        phone: formData.phone.trim(),
        default_operatory_chair: formData.default_operatory_chair.trim() || 'Chair 1',
        bio: formData.bio.trim() || null,
      };

      const updated = await dentistsApi.updateMyProfile(payload);
      setProfile(updated);
      const mapped = mapProfileToForm(updated);
      setFormData(mapped);
      setSavedSnapshot(mapped);
      setSuccessMsg('Your practitioner profile details have been updated.');
      await refreshUser?.();
      if (onProfileUpdated) {
        onProfileUpdated('Your practitioner profile has been updated.');
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
    return <ProfileSkeleton title="Dentist Profile" />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#12304A] tracking-tight">My Profile</h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Manage your practitioner credentials, clinic assignment, contact details, and public bio.
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

      {/* Main Split Layout */}
      <div className="portal-split-1-2 gap-6 items-start">
        {/* LEFT COLUMN: Practitioner Summary Card */}
        <aside>
          <section
            aria-label="Practitioner Profile Summary"
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="h-20 bg-gradient-to-r from-[#12304A] via-[#134E4A] to-[#0D9488]" />

            <div className="px-5 pb-6 -mt-11">
              <ProfilePhotoUploader
                fullName={fullName}
                initials={initials}
                serverAvatarUrl={serverAvatarUrl}
                badgeText={formData.specialization || profile?.specialization || 'Dentist'}
                subtitle={profile?.email || user?.email || ''}
                onUploadFile={(file) => dentistsApi.uploadMyAvatar(file)}
                onRemoveFile={() => dentistsApi.deleteMyAvatar()}
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
                  {profile?.license_number && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-slate-600">PRC License</dt>
                      <dd className="font-semibold text-[#12304A]">{profile.license_number}</dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-600">Assigned Chair</dt>
                    <dd className="font-semibold text-[#12304A]">
                      {formData.default_operatory_chair || 'Chair 1'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-600">Practice Status</dt>
                    <dd className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {profile?.is_active === 0 ? 'Inactive' : 'Active & Licensed'}
                    </dd>
                  </div>
                  {typeof profile?.appointment_count === 'number' && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-slate-600">Assigned Visits</dt>
                      <dd className="font-semibold text-[#12304A]">{profile.appointment_count}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </section>
        </aside>

        {/* RIGHT COLUMN: Editable Clinical Profile Form */}
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

          {/* 1. Practitioner Identity & Specialization */}
          <section
            aria-labelledby="dentist-identity-heading"
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5"
          >
            <div className="pb-3.5 border-b border-slate-100">
              <h2
                id="dentist-identity-heading"
                className="text-sm font-bold text-[#12304A] flex items-center gap-2"
              >
                <span className="w-7 h-7 rounded-lg bg-[#F0FDFA] text-[#0D9488] flex items-center justify-center">
                  <User className="w-4 h-4" />
                </span>
                Professional Credentials
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Displayed across patient booking rosters, treatment records, and clinic schedules.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="first_name"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  First Name
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
                  Last Name
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
                  htmlFor="specialization"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Dental Specialization
                </label>
                <div className="relative">
                  <Stethoscope className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="specialization"
                    type="text"
                    name="specialization"
                    required
                    value={formData.specialization}
                    onChange={handleChange}
                    aria-invalid={Boolean(formErrors.specialization)}
                    aria-describedby={formErrors.specialization ? 'specialization-error' : undefined}
                    placeholder="e.g. General & Cosmetic Dentistry"
                    className={getFieldInputClasses(Boolean(formErrors.specialization), 'pl-10')}
                  />
                </div>
                {formErrors.specialization && (
                  <p id="specialization-error" className="text-xs text-red-600 font-medium mt-1">
                    {formErrors.specialization}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="license_number"
                    className="text-xs font-semibold text-slate-700"
                  >
                    PRC License Number
                  </label>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F766E]">
                    <Award className="w-3.5 h-3.5" />
                    Verified
                  </span>
                </div>
                <div className="relative">
                  <Award className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="license_number"
                    type="text"
                    value={profile?.license_number || ''}
                    readOnly
                    aria-describedby="license-help"
                    className="w-full pl-10 pr-10 py-2.5 min-h-[44px] rounded-xl text-sm text-slate-600 bg-slate-50 border border-slate-200 cursor-not-allowed focus:outline-none"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p id="license-help" className="text-xs text-slate-600 mt-1.5">
                  License number updates are verified and managed by clinic administration.
                </p>
              </div>
            </div>
          </section>

          {/* 2. Contact & Operatory Assignment */}
          <section
            aria-labelledby="dentist-contact-heading"
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5"
          >
            <div className="pb-3.5 border-b border-slate-100">
              <h2
                id="dentist-contact-heading"
                className="text-sm font-bold text-[#12304A] flex items-center gap-2"
              >
                <span className="w-7 h-7 rounded-lg bg-[#F0FDFA] text-[#0D9488] flex items-center justify-center">
                  <Phone className="w-4 h-4" />
                </span>
                Contact &amp; Clinic Assignment
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Used by front-desk staff for scheduling coordination and operatory room setup.
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
                    className="w-full pl-10 pr-10 py-2.5 min-h-[44px] rounded-xl text-sm text-slate-600 bg-slate-50 border border-slate-200 cursor-not-allowed focus:outline-none"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Contact Phone
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

              <div>
                <label
                  htmlFor="default_operatory_chair"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Default Operatory Chair
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="default_operatory_chair"
                    type="text"
                    name="default_operatory_chair"
                    value={formData.default_operatory_chair}
                    onChange={handleChange}
                    placeholder="e.g. Chair 1"
                    className={getFieldInputClasses(false, 'pl-10')}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 3. Clinical Biography */}
          <section
            aria-labelledby="dentist-bio-heading"
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4"
          >
            <div className="pb-3 border-b border-slate-100">
              <h2
                id="dentist-bio-heading"
                className="text-sm font-bold text-[#12304A]"
              >
                Clinical Biography &amp; Patient Notes
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Shown on the clinic&apos;s public dentist directory when patients choose a provider.
              </p>
            </div>

            <div>
              <label
                htmlFor="bio"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Practitioner Bio
              </label>
              <textarea
                id="bio"
                name="bio"
                rows={4}
                value={formData.bio}
                onChange={handleChange}
                placeholder="Share your clinical background, education, and areas of focus..."
                className="w-full px-3.5 py-2.5 rounded-xl text-sm text-[#12304A] bg-white border border-slate-300 hover:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/25 focus:border-[#0D9488] resize-y"
              />
            </div>
          </section>

          {/* Form Action Footer */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-slate-600">
              {isDirty
                ? 'Review your updates above, then save to sync your practitioner profile.'
                : 'Your practitioner profile is up to date.'}
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

export default DentistProfilePage;
