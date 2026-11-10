import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  HeartPulse,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Save,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { patientsApi } from '../api';
import { useAuth } from '../../auth';

export function PatientProfilePage({ onProfileUpdated } = {}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    date_of_birth: '',
    phone: '',
    gender: 'PREFER_NOT_TO_SAY',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    medical_alerts: '',
  });

  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setFetchError(null);

    patientsApi
      .getMyProfile()
      .then((data) => {
        if (!isMounted || !data) return;
        setFormData({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          email: data.email || user?.email || '',
          date_of_birth: data.date_of_birth || '',
          phone: data.phone || '',
          gender: data.gender || 'PREFER_NOT_TO_SAY',
          address: data.address || '',
          emergency_contact_name: data.emergency_contact_name || '',
          emergency_contact_phone: data.emergency_contact_phone || '',
          medical_alerts: data.medical_alerts || '',
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        // Fallback to user context data if offline
        if (user?.patient) {
          setFormData({
            first_name: user.patient.first_name || user.first_name || '',
            last_name: user.patient.last_name || user.last_name || '',
            email: user.email || '',
            date_of_birth: user.patient.date_of_birth || '',
            phone: user.patient.phone || '',
            gender: user.patient.gender || 'PREFER_NOT_TO_SAY',
            address: user.patient.address || '',
            emergency_contact_name: user.patient.emergency_contact_name || '',
            emergency_contact_phone: user.patient.emergency_contact_phone || '',
            medical_alerts: user.patient.medical_alerts || '',
          });
        } else {
          setFetchError(err.response?.data?.error?.message || err.message || 'Unable to load profile.');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  const validate = () => {
    const errs = {};
    if (!formData.first_name.trim()) errs.first_name = 'First name is required.';
    if (!formData.last_name.trim()) errs.last_name = 'Last name is required.';
    if (!formData.phone.trim()) {
      errs.phone = 'Phone number is required.';
    } else if (!/^[0-9+\s\-()]{7,30}$/.test(formData.phone.trim())) {
      errs.phone = 'Please enter a valid phone number format.';
    }

    if (formData.date_of_birth) {
      const d = new Date(formData.date_of_birth);
      if (isNaN(d.getTime()) || d > new Date()) {
        errs.date_of_birth = 'Date of birth must be a past date.';
      }
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError(null);

    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        date_of_birth: formData.date_of_birth,
        phone: formData.phone.trim(),
        gender: formData.gender,
        address: formData.address.trim() || null,
        emergency_contact_name: formData.emergency_contact_name.trim() || null,
        emergency_contact_phone: formData.emergency_contact_phone.trim() || null,
        medical_alerts: formData.medical_alerts.trim() || null,
      };

      await patientsApi.updateMyProfile(payload);
      setSaveSuccess(true);
      onProfileUpdated?.();
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err) {
      setSaveError(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to update profile. Please review your input.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-4 animate-pulse">
          <div className="h-10 bg-slate-100 rounded" />
          <div className="h-10 bg-slate-100 rounded" />
          <div className="h-10 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#12304A]">My Profile</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage your personal patient record, contact details, and medical disclosure.
        </p>
      </div>

      {/* Success Notification */}
      {saveSuccess && (
        <div
          role="status"
          className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-[#0F766E] text-xs font-semibold flex items-center gap-2 animate-in fade-in"
        >
          <CheckCircle2 className="w-4 h-4 text-[#0D9488] shrink-0" />
          <span>Your patient profile has been updated successfully.</span>
        </div>
      )}

      {/* Error Alert */}
      {(saveError || fetchError) && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{saveError || fetchError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Section 1: Demographics */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <User className="w-4 h-4 text-[#0D9488]" />
            <h3 className="text-sm font-bold text-[#12304A]">Personal Demographics</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="first_name" className="block text-xs font-bold text-[#12304A] mb-1.5">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
                  formErrors.first_name ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                }`}
              />
              {formErrors.first_name && (
                <p className="mt-1 text-xs text-rose-600">{formErrors.first_name}</p>
              )}
            </div>

            <div>
              <label htmlFor="last_name" className="block text-xs font-bold text-[#12304A] mb-1.5">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="last_name"
                name="last_name"
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
                  formErrors.last_name ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                }`}
              />
              {formErrors.last_name && (
                <p className="mt-1 text-xs text-rose-600">{formErrors.last_name}</p>
              )}
            </div>

            <div>
              <label htmlFor="date_of_birth" className="block text-xs font-bold text-[#12304A] mb-1.5">
                Date of Birth
              </label>
              <input
                id="date_of_birth"
                name="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
              />
              {formErrors.date_of_birth && (
                <p className="mt-1 text-xs text-rose-600">{formErrors.date_of_birth}</p>
              )}
            </div>

            <div>
              <label htmlFor="gender" className="block text-xs font-bold text-[#12304A] mb-1.5">
                Gender
              </label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] bg-white"
              >
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Contact Information */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Phone className="w-4 h-4 text-[#0D9488]" />
            <h3 className="text-sm font-bold text-[#12304A]">Contact Information</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-[#12304A] mb-1.5 flex items-center justify-between">
                <span>Account Email</span>
                <span className="text-[11px] font-semibold text-[#0D9488] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified
                </span>
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  disabled
                  value={formData.email}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500 cursor-not-allowed select-none"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                To update your login email, please request administrative re-verification at the clinic reception.
              </p>
            </div>

            <div>
              <label htmlFor="phone" className="block text-xs font-bold text-[#12304A] mb-1.5">
                Contact Phone <span className="text-rose-500">*</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                placeholder="+63 917 123 4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
                  formErrors.phone ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                }`}
              />
              {formErrors.phone && (
                <p className="mt-1 text-xs text-rose-600">{formErrors.phone}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="address" className="block text-xs font-bold text-[#12304A] mb-1.5">
                Residential Address
              </label>
              <input
                id="address"
                name="address"
                type="text"
                placeholder="Street address, Barangay, City, Metro Manila"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Emergency & Medical History */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <HeartPulse className="w-4 h-4 text-[#0D9488]" />
            <h3 className="text-sm font-bold text-[#12304A]">Emergency Contact & Medical History</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="emergency_contact_name" className="block text-xs font-bold text-[#12304A] mb-1.5">
                Emergency Contact Name
              </label>
              <input
                id="emergency_contact_name"
                name="emergency_contact_name"
                type="text"
                placeholder="e.g. Maria Dela Cruz (Spouse)"
                value={formData.emergency_contact_name}
                onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
              />
            </div>

            <div>
              <label htmlFor="emergency_contact_phone" className="block text-xs font-bold text-[#12304A] mb-1.5">
                Emergency Contact Phone
              </label>
              <input
                id="emergency_contact_phone"
                name="emergency_contact_phone"
                type="tel"
                placeholder="+63 917 987 6543"
                value={formData.emergency_contact_phone}
                onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="medical_alerts" className="block text-xs font-bold text-[#12304A] mb-1.5">
                Medical History & Allergies Disclosure
              </label>
              <textarea
                id="medical_alerts"
                name="medical_alerts"
                rows={3}
                placeholder="List any drug allergies (e.g. Penicillin), medical conditions (hypertension, diabetes), bleeding disorders, or current medications."
                value={formData.medical_alerts}
                onChange={(e) => setFormData({ ...formData, medical_alerts: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] resize-none"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                This information is kept confidential and only shared with your attending dentist for clinical safety.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving profile...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Profile Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
