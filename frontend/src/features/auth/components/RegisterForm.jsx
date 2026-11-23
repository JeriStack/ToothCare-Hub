import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Check,
  User,
  Mail,
  Phone,
  Calendar,
  Lock,
  ChevronDown,
  ChevronUp,
  MapPin,
  HeartPulse,
  Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  PASSWORD_RULES,
  sanitizeNameInput,
  sanitizePhoneInput,
  validateName,
  validatePassword,
  validateEmail,
  validatePhone,
  validateDateOfBirth,
} from '../schemas/authSchema';

const SHORT_PASSWORD_RULE_LABELS = {
  length: '8+ chars',
  uppercase: 'Uppercase',
  lowercase: 'Lowercase',
  number: 'Number',
  symbol: 'Symbol',
};

const OPTIONAL_FIELD_KEYS = new Set([
  'address',
  'emergencyContactName',
  'emergencyContactPhone',
  'medicalAlerts',
]);

const FIELD_ID_MAP = {
  firstName: 'reg-first-name',
  lastName: 'reg-last-name',
  email: 'reg-email',
  phone: 'reg-phone',
  dateOfBirth: 'reg-dob',
  address: 'reg-address',
  emergencyContactName: 'reg-emergency-name',
  emergencyContactPhone: 'reg-emergency-phone',
  password: 'reg-password',
  confirmPassword: 'reg-confirm-password',
  agreeTerms: 'reg-agree-terms',
};

function getTodayIsoLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function RegisterForm({ onNavigateLogin, onSuccess }) {
  const { register, resendVerification, isLoading } = useAuth();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    medicalAlerts: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  });

  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [registeredSuccessEmail, setRegisteredSuccessEmail] = useState(null);
  const [resendStatus, setResendStatus] = useState(null);

  const passwordAnalysis = validatePassword(formData.password);
  const todayIso = getTodayIsoLocal();
  const passwordsMatch = Boolean(formData.password && formData.confirmPassword && formData.password === formData.confirmPassword);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: null }));
    }
    if (field === 'password' && fieldErrors.confirmPassword && value === formData.confirmPassword) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: null }));
    }
    setFormError(null);
  };

  const handleNameKeyDown = (e) => {
    if (e.nativeEvent?.isComposing || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }
    if (e.key && /\p{Nd}/u.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleNameChange = (field, rawValue) => {
    handleChange(field, sanitizeNameInput(rawValue));
  };

  const handleNameBlur = (field, label, options) => {
    const value = formData[field];
    if (value.trim() !== '') {
      const err = validateName(value, label, options);
      if (err) {
        setFieldErrors((prev) => ({ ...prev, [field]: err }));
      }
    }
  };

  const handlePhoneKeyDown = (e) => {
    if (e.nativeEvent?.isComposing || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }
    const key = e.key;
    if (!key || key.length > 1) {
      return;
    }
    if (!/^[0-9+\s\-()]$/.test(key)) {
      e.preventDefault();
      return;
    }
    if (key === '+') {
      const input = e.currentTarget;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      const value = input.value ?? '';
      const remaining = value.slice(0, start) + value.slice(end);
      if (start !== 0 || remaining.includes('+')) {
        e.preventDefault();
      }
    }
  };

  const handlePhoneChange = (field, rawValue) => {
    handleChange(field, sanitizePhoneInput(rawValue));
  };

  const handleFieldBlur = (field) => {
    const value = formData[field];
    if (typeof value !== 'string' || value.trim() === '') return;

    let err = null;
    if (field === 'email') {
      err = validateEmail(value);
    } else if (field === 'phone') {
      err = validatePhone(value);
    } else if (field === 'emergencyContactPhone') {
      err = validatePhone(value, { required: false }) ? 'Emergency phone format is invalid.' : null;
    } else if (field === 'dateOfBirth') {
      err = validateDateOfBirth(value);
    } else if (field === 'address' && value.trim().length > 255) {
      err = 'Address cannot exceed 255 characters.';
    } else if (field === 'password' && !validatePassword(value).isValid) {
      err = 'Password does not meet the security criteria.';
    } else if (field === 'confirmPassword' && value !== formData.password) {
      err = 'Passwords do not match.';
    }

    if (err) {
      setFieldErrors((prev) => ({ ...prev, [field]: err }));
    }
  };

  const focusFirstInvalidField = (errorsObj) => {
    const firstErrorField = Object.keys(errorsObj)[0];
    if (!firstErrorField) return;
    if (Object.keys(errorsObj).some((key) => OPTIONAL_FIELD_KEYS.has(key))) {
      setShowOptionalFields(true);
    }
    const targetId = FIELD_ID_MAP[firstErrorField];
    if (targetId) {
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.focus();
      } else {
        requestAnimationFrame(() => {
          document.getElementById(targetId)?.focus();
        });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const errors = {};
    const firstNameErr = validateName(formData.firstName, 'First name');
    if (firstNameErr) errors.firstName = firstNameErr;

    const lastNameErr = validateName(formData.lastName, 'Last name');
    if (lastNameErr) errors.lastName = lastNameErr;

    const emailErr = validateEmail(formData.email);
    if (emailErr) errors.email = emailErr;

    const phoneErr = validatePhone(formData.phone);
    if (phoneErr) errors.phone = phoneErr;

    const dobErr = validateDateOfBirth(formData.dateOfBirth);
    if (dobErr) errors.dateOfBirth = dobErr;

    if (formData.address?.trim() && formData.address.trim().length > 255) {
      errors.address = 'Address cannot exceed 255 characters.';
    }

    if (formData.emergencyContactName?.trim()) {
      const emergencyNameErr = validateName(formData.emergencyContactName, 'Emergency contact name', {
        required: false,
        maxLength: 150,
      });
      if (emergencyNameErr) errors.emergencyContactName = emergencyNameErr;
    }

    if (formData.emergencyContactPhone?.trim()) {
      const emergencyPhoneErr = validatePhone(formData.emergencyContactPhone, { required: false });
      if (emergencyPhoneErr) errors.emergencyContactPhone = 'Emergency phone format is invalid.';
    }

    if (!formData.password) {
      errors.password = 'Password is required.';
    } else if (!passwordAnalysis.isValid) {
      errors.password = 'Password does not meet the security criteria.';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (!formData.agreeTerms) {
      errors.agreeTerms = 'You must agree to the Terms of Service and Privacy Policy.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      focusFirstInvalidField(errors);
      return;
    }
    setFieldErrors({});

    const payload = {
      first_name: formData.firstName.trim(),
      last_name: formData.lastName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      date_of_birth: formData.dateOfBirth,
      gender: formData.gender || 'PREFER_NOT_TO_SAY',
      password: formData.password,
      ...(formData.address?.trim() ? { address: formData.address.trim() } : {}),
      ...(formData.emergencyContactName?.trim() ? { emergency_contact_name: formData.emergencyContactName.trim() } : {}),
      ...(formData.emergencyContactPhone?.trim() ? { emergency_contact_phone: formData.emergencyContactPhone.trim() } : {}),
      ...(formData.medicalAlerts?.trim() ? { medical_alerts: formData.medicalAlerts.trim() } : {}),
    };

    const res = await register(payload);
    if (res.success) {
      setRegisteredSuccessEmail(formData.email.trim());
      onSuccess?.(res.data);
    } else {
      if (res.details && typeof res.details === 'object') {
        const mappedErrors = {};
        for (const [key, msg] of Object.entries(res.details)) {
          const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
          mappedErrors[camelKey] = msg;
        }
        setFieldErrors(mappedErrors);
        focusFirstInvalidField(mappedErrors);
      }
      setFormError(res.error || 'Failed to register. Please check your information.');
    }
  };

  const handleResend = async () => {
    if (!registeredSuccessEmail) return;
    setResendStatus('loading');
    const res = await resendVerification(registeredSuccessEmail);
    if (res.success) {
      setResendStatus('sent');
    } else {
      setResendStatus('error');
    }
  };

  // 1. Success State View
  if (registeredSuccessEmail) {
    return (
      <div className="text-center py-4 space-y-5 animate-in fade-in duration-300">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#CCFBF1] dark:bg-teal-900/50 text-[#0D9488] dark:text-teal-300 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-[#12304A] dark:text-gray-50">Account Created Successfully</h2>
          <p className="mt-2 text-xs text-slate-600 dark:text-gray-300 leading-relaxed max-w-sm mx-auto">
            We sent a verification link to <strong className="text-slate-800 dark:text-white">{registeredSuccessEmail}</strong>.
            Please verify your email address to confirm your account and book dental appointments.
          </p>
        </div>

        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={onNavigateLogin}
            className="w-full py-3 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] dark:bg-[#0F766E] dark:hover:bg-[#0D9488] text-white font-semibold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
          >
            Sign In to Your Account
          </button>

          <div className="pt-2">
            {resendStatus === 'sent' ? (
              <p className="text-xs text-[#0D9488] dark:text-teal-400 font-medium">Verification link resent! Check your inbox.</p>
            ) : (
              <button
                type="button"
                disabled={resendStatus === 'loading'}
                onClick={handleResend}
                className="text-xs text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200 transition-colors underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded"
              >
                {resendStatus === 'loading' ? 'Sending link...' : "Didn't receive an email? Resend verification"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. Registration Form
  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Registration failed</p>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">{formError}</p>
          </div>
        </div>
      )}

      {/* Name Fields (First & Last) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="reg-first-name" className="block text-xs font-bold text-[#12304A] dark:text-gray-200 mb-1.5">
            First name
          </label>
          <div className="relative">
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#E6F7F5] dark:bg-teal-900/50 flex items-center justify-center text-[#0D9488] dark:text-teal-300 pointer-events-none">
              <User className="w-4 h-4 stroke-[2.2]" />
            </div>
            <input
              id="reg-first-name"
              name="firstName"
              type="text"
              autoComplete="given-name"
              maxLength={100}
              pattern="[^0-9]+"
              required
              value={formData.firstName}
              onKeyDown={handleNameKeyDown}
              onChange={(e) => handleNameChange('firstName', e.target.value)}
              onBlur={() => handleNameBlur('firstName', 'First name')}
              placeholder="e.g. Maria"
              aria-invalid={Boolean(fieldErrors.firstName)}
              aria-describedby={fieldErrors.firstName ? 'reg-first-name-error' : undefined}
              className={`w-full pl-12 pr-3.5 py-2.5 rounded-xl border text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 ${
                fieldErrors.firstName ? 'border-rose-400 dark:border-rose-500 bg-rose-50/20 dark:bg-rose-950/30' : 'border-slate-300 dark:border-gray-600 hover:border-slate-400 dark:hover:border-gray-500'
              }`}
            />
          </div>
          {fieldErrors.firstName && (
            <p id="reg-first-name-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.firstName}</p>
          )}
        </div>

        <div>
          <label htmlFor="reg-last-name" className="block text-xs font-bold text-[#12304A] dark:text-gray-200 mb-1.5">
            Last name
          </label>
          <div className="relative">
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#E6F7F5] dark:bg-teal-900/50 flex items-center justify-center text-[#0D9488] dark:text-teal-300 pointer-events-none">
              <User className="w-4 h-4 stroke-[2.2]" />
            </div>
            <input
              id="reg-last-name"
              name="lastName"
              type="text"
              autoComplete="family-name"
              maxLength={100}
              pattern="[^0-9]+"
              required
              value={formData.lastName}
              onKeyDown={handleNameKeyDown}
              onChange={(e) => handleNameChange('lastName', e.target.value)}
              onBlur={() => handleNameBlur('lastName', 'Last name')}
              placeholder="e.g. Santos"
              aria-invalid={Boolean(fieldErrors.lastName)}
              aria-describedby={fieldErrors.lastName ? 'reg-last-name-error' : undefined}
              className={`w-full pl-12 pr-3.5 py-2.5 rounded-xl border text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 ${
                fieldErrors.lastName ? 'border-rose-400 dark:border-rose-500 bg-rose-50/20 dark:bg-rose-950/30' : 'border-slate-300 dark:border-gray-600 hover:border-slate-400 dark:hover:border-gray-500'
              }`}
            />
          </div>
          {fieldErrors.lastName && (
            <p id="reg-last-name-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.lastName}</p>
          )}
        </div>
      </div>

      {/* Email Address */}
      <div>
        <label htmlFor="reg-email" className="block text-xs font-bold text-[#12304A] dark:text-gray-200 mb-1.5">
          Email address
        </label>
        <div className="relative">
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#E6F7F5] dark:bg-teal-900/50 flex items-center justify-center text-[#0D9488] dark:text-teal-300 pointer-events-none">
            <Mail className="w-4 h-4 stroke-[2.2]" />
          </div>
          <input
            id="reg-email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={255}
            enterKeyHint="next"
            required
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            onBlur={() => handleFieldBlur('email')}
            placeholder="maria.santos@example.com"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'reg-email-error' : undefined}
            className={`w-full pl-12 pr-3.5 py-2.5 rounded-xl border text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 ${
              fieldErrors.email ? 'border-rose-400 dark:border-rose-500 bg-rose-50/20 dark:bg-rose-950/30' : 'border-slate-300 dark:border-gray-600 hover:border-slate-400 dark:hover:border-gray-500'
            }`}
          />
        </div>
        {fieldErrors.email && (
          <p id="reg-email-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.email}</p>
        )}
      </div>

      {/* Phone Number */}
      <div>
        <label htmlFor="reg-phone" className="block text-xs font-bold text-[#12304A] dark:text-gray-200 mb-1.5">
          Phone number
        </label>
        <div className="relative">
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#E6F7F5] dark:bg-teal-900/50 flex items-center justify-center text-[#0D9488] dark:text-teal-300 pointer-events-none">
            <Phone className="w-4 h-4 stroke-[2.2]" />
          </div>
          <input
            id="reg-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={30}
            pattern="[0-9+\s\-()]{7,30}"
            enterKeyHint="next"
            required
            value={formData.phone}
            onKeyDown={handlePhoneKeyDown}
            onChange={(e) => handlePhoneChange('phone', e.target.value)}
            onBlur={() => handleFieldBlur('phone')}
            placeholder="+63 917 123 4567"
            aria-invalid={Boolean(fieldErrors.phone)}
            aria-describedby={fieldErrors.phone ? 'reg-phone-error' : undefined}
            className={`w-full pl-12 pr-3.5 py-2.5 rounded-xl border text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 ${
              fieldErrors.phone ? 'border-rose-400 dark:border-rose-500 bg-rose-50/20 dark:bg-rose-950/30' : 'border-slate-300 dark:border-gray-600 hover:border-slate-400 dark:hover:border-gray-500'
            }`}
          />
        </div>
        {fieldErrors.phone && (
          <p id="reg-phone-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.phone}</p>
        )}
      </div>

      {/* DOB and Gender */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="reg-dob" className="block text-xs font-bold text-[#12304A] dark:text-gray-200 mb-1.5">
            Date of birth
          </label>
          <div className="relative">
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#E6F7F5] dark:bg-teal-900/50 flex items-center justify-center text-[#0D9488] dark:text-teal-300 pointer-events-none">
              <Calendar className="w-4 h-4 stroke-[2.2]" />
            </div>
            <input
              id="reg-dob"
              name="dateOfBirth"
              type={formData.dateOfBirth ? 'date' : 'text'}
              autoComplete="bday"
              min="1900-01-01"
              max={todayIso}
              onFocus={(e) => (e.target.type = 'date')}
              onBlur={(e) => {
                if (!e.target.value) e.target.type = 'text';
                handleFieldBlur('dateOfBirth');
              }}
              required
              value={formData.dateOfBirth}
              onChange={(e) => handleChange('dateOfBirth', e.target.value)}
              placeholder="yyyy-mm-dd"
              aria-invalid={Boolean(fieldErrors.dateOfBirth)}
              aria-describedby={fieldErrors.dateOfBirth ? 'reg-dob-error' : undefined}
              className={`w-full pl-12 pr-3.5 py-2.5 rounded-xl border text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer ${
                fieldErrors.dateOfBirth ? 'border-rose-400 dark:border-rose-500 bg-rose-50/20 dark:bg-rose-950/30' : 'border-slate-300 dark:border-gray-600 hover:border-slate-400 dark:hover:border-gray-500'
              }`}
            />
          </div>
          {fieldErrors.dateOfBirth && (
            <p id="reg-dob-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.dateOfBirth}</p>
          )}
        </div>

        <div>
          <label htmlFor="reg-gender" className="block text-xs font-bold text-[#12304A] dark:text-gray-200 mb-1.5">
            Gender
          </label>
          <div className="relative">
            <select
              id="reg-gender"
              name="gender"
              value={formData.gender}
              onChange={(e) => handleChange('gender', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-slate-800 dark:text-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 hover:border-slate-400 dark:hover:border-gray-500 appearance-none pr-10"
            >
              <option value="">Select</option>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="OTHER">Other</option>
              <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
            </select>
            <ChevronDown className="w-5 h-5 text-[#12304A] dark:text-gray-300 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.2]" />
          </div>
        </div>
      </div>

      {/* Expandable Optional Medical & Emergency Section */}
      <div className="pt-1">
        <button
          type="button"
          aria-expanded={showOptionalFields}
          aria-controls="reg-optional-fields"
          onClick={() => setShowOptionalFields(!showOptionalFields)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200/90 dark:border-gray-700 text-xs font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
        >
          <span className="flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-[#0D9488] dark:text-teal-400 shrink-0" />
            Address, Medical History & Emergency Contact (Optional)
          </span>
          {showOptionalFields ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
        </button>

        {showOptionalFields && (
          <div
            id="reg-optional-fields"
            className="mt-3 p-4 rounded-2xl bg-[#F8FAFC] dark:bg-gray-900/70 border border-slate-200/80 dark:border-gray-700 space-y-3.5 tch-animate-fade-in"
          >
            {/* Address */}
            <div>
              <label htmlFor="reg-address" className="block text-[11px] font-bold text-[#12304A] dark:text-gray-200 mb-1">
                Complete address
              </label>
              <div className="relative">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center text-slate-400 dark:text-gray-400 pointer-events-none border border-slate-200 dark:border-gray-700">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <input
                  id="reg-address"
                  name="address"
                  type="text"
                  autoComplete="street-address"
                  maxLength={255}
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  onBlur={() => handleFieldBlur('address')}
                  placeholder="Unit, Street, Barangay, City / Municipality"
                  aria-invalid={Boolean(fieldErrors.address)}
                  aria-describedby={fieldErrors.address ? 'reg-address-error' : undefined}
                  className={`w-full pl-11 pr-3 py-2 rounded-xl border text-xs text-slate-800 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
                    fieldErrors.address ? 'border-rose-400 dark:border-rose-500 bg-rose-50/20 dark:bg-rose-950/30' : 'border-slate-300 dark:border-gray-600'
                  }`}
                />
              </div>
              {fieldErrors.address && (
                <p id="reg-address-error" className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.address}</p>
              )}
            </div>

            {/* Emergency Contact Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-emergency-name" className="block text-[11px] font-bold text-[#12304A] dark:text-gray-200 mb-1">
                  Emergency contact name
                </label>
                <input
                  id="reg-emergency-name"
                  name="emergencyContactName"
                  type="text"
                  maxLength={150}
                  pattern="[^0-9]+"
                  value={formData.emergencyContactName}
                  onKeyDown={handleNameKeyDown}
                  onChange={(e) => handleNameChange('emergencyContactName', e.target.value)}
                  onBlur={() => handleNameBlur('emergencyContactName', 'Emergency contact name', { required: false, maxLength: 150 })}
                  placeholder="e.g. Juan Santos (Spouse)"
                  aria-invalid={Boolean(fieldErrors.emergencyContactName)}
                  aria-describedby={fieldErrors.emergencyContactName ? 'reg-emergency-name-error' : undefined}
                  className={`w-full px-3 py-2 rounded-xl border text-xs text-slate-800 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
                    fieldErrors.emergencyContactName ? 'border-rose-400 dark:border-rose-500 bg-rose-50/20 dark:bg-rose-950/30' : 'border-slate-300 dark:border-gray-600'
                  }`}
                />
                {fieldErrors.emergencyContactName && (
                  <p id="reg-emergency-name-error" className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.emergencyContactName}</p>
                )}
              </div>

              <div>
                <label htmlFor="reg-emergency-phone" className="block text-[11px] font-bold text-[#12304A] dark:text-gray-200 mb-1">
                  Emergency contact phone
                </label>
                <input
                  id="reg-emergency-phone"
                  name="emergencyContactPhone"
                  type="tel"
                  inputMode="tel"
                  maxLength={30}
                  pattern="[0-9+\s\-()]{7,30}"
                  value={formData.emergencyContactPhone}
                  onKeyDown={handlePhoneKeyDown}
                  onChange={(e) => handlePhoneChange('emergencyContactPhone', e.target.value)}
                  onBlur={() => handleFieldBlur('emergencyContactPhone')}
                  placeholder="+63 918 765 4321"
                  aria-invalid={Boolean(fieldErrors.emergencyContactPhone)}
                  aria-describedby={fieldErrors.emergencyContactPhone ? 'reg-emergency-phone-error' : undefined}
                  className={`w-full px-3 py-2 rounded-xl border text-xs text-slate-800 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
                    fieldErrors.emergencyContactPhone ? 'border-rose-400 dark:border-rose-500 bg-rose-50/20 dark:bg-rose-950/30' : 'border-slate-300 dark:border-gray-600'
                  }`}
                />
                {fieldErrors.emergencyContactPhone && (
                  <p id="reg-emergency-phone-error" className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.emergencyContactPhone}</p>
                )}
              </div>
            </div>

            {/* Medical History & Alerts */}
            <div>
              <label htmlFor="reg-medical-alerts" className="block text-[11px] font-bold text-[#12304A] dark:text-gray-200 mb-1">
                Medical history & allergies disclosure
              </label>
              <textarea
                id="reg-medical-alerts"
                name="medicalAlerts"
                rows={3}
                maxLength={1000}
                value={formData.medicalAlerts}
                onChange={(e) => handleChange('medicalAlerts', e.target.value)}
                placeholder="List any drug allergies (e.g. Penicillin), medical conditions (hypertension, diabetes), bleeding disorders, or current medications."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-gray-600 text-xs text-slate-800 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] resize-y leading-relaxed"
              />
            </div>
          </div>
        )}
      </div>

      {/* Password Fields */}
      <div>
        <label htmlFor="reg-password" className="block text-xs font-bold text-[#12304A] dark:text-gray-200 mb-1.5">
          Password
        </label>
        <div className="relative">
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#E6F7F5] dark:bg-teal-900/50 flex items-center justify-center text-[#0D9488] dark:text-teal-300 pointer-events-none">
            <Lock className="w-4 h-4 stroke-[2.2]" />
          </div>
          <input
            id="reg-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            minLength={8}
            enterKeyHint="next"
            required
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            onBlur={() => handleFieldBlur('password')}
            placeholder="At least 8 characters"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'reg-password-rules reg-password-error' : 'reg-password-rules'}
            className={`w-full min-w-0 pl-12 pr-12 py-2.5 rounded-xl border text-base sm:text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 ${
              fieldErrors.password ? 'border-rose-400 dark:border-rose-500 bg-rose-50/20 dark:bg-rose-950/30' : 'border-slate-300 dark:border-gray-600 hover:border-slate-400 dark:hover:border-gray-500'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-pressed={showPassword}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 inline-flex items-center justify-center text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded-lg"
          >
            {showPassword ? <EyeOff className="w-4 h-4 stroke-[2]" /> : <Eye className="w-4 h-4 stroke-[2]" />}
          </button>
        </div>

        {/* Password Strength Progress Bar & Requirements */}
        <div className="mt-2 space-y-2">
          <div
            className="flex gap-1.5"
            role="progressbar"
            aria-valuenow={passwordAnalysis.strengthScore}
            aria-valuemin="0"
            aria-valuemax="5"
            aria-label="Password security requirements strength"
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i < passwordAnalysis.strengthScore
                    ? 'bg-emerald-600 dark:bg-emerald-500'
                    : 'bg-slate-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
          <ul
            id="reg-password-rules"
            className="flex flex-nowrap items-center justify-between gap-1"
            aria-label="Password requirements"
          >
            {PASSWORD_RULES.map((rule) => {
              const passed = rule.test(formData.password);
              const showWarning = Boolean(fieldErrors.password) && !passed;
              return (
                <li
                  key={rule.id}
                  className={`inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] sm:text-[10.5px] font-medium border whitespace-nowrap shrink-0 transition-colors ${
                    passed
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : showWarning
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300'
                        : 'bg-slate-50 dark:bg-gray-800/70 border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400'
                  }`}
                >
                  <Check className={`w-2.5 h-2.5 shrink-0 ${passed ? 'opacity-100' : 'opacity-30'}`} aria-hidden="true" />
                  <span>{SHORT_PASSWORD_RULE_LABELS[rule.id] || rule.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
        {fieldErrors.password && (
          <p id="reg-password-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.password}</p>
        )}
      </div>

      {/* Confirm Password */}
      <div>
        <label htmlFor="reg-confirm-password" className="block text-xs font-bold text-[#12304A] dark:text-gray-200 mb-1.5">
          Confirm password
        </label>
        <div className="relative">
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#E6F7F5] dark:bg-teal-900/50 flex items-center justify-center text-[#0D9488] dark:text-teal-300 pointer-events-none">
            <Lock className="w-4 h-4 stroke-[2.2]" />
          </div>
          <input
            id="reg-confirm-password"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            enterKeyHint="done"
            required
            value={formData.confirmPassword}
            onChange={(e) => handleChange('confirmPassword', e.target.value)}
            onBlur={() => handleFieldBlur('confirmPassword')}
            placeholder="Repeat your password"
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            aria-describedby={fieldErrors.confirmPassword ? 'reg-confirm-password-error' : undefined}
            className={`w-full min-w-0 pl-12 pr-12 py-2.5 rounded-xl border text-base sm:text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 ${
              fieldErrors.confirmPassword ? 'border-rose-400 dark:border-rose-500 bg-rose-50/20 dark:bg-rose-950/30' : 'border-slate-300 dark:border-gray-600 hover:border-slate-400 dark:hover:border-gray-500'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            aria-pressed={showConfirmPassword}
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 inline-flex items-center justify-center text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded-lg"
          >
            {showConfirmPassword ? <EyeOff className="w-4 h-4 stroke-[2]" /> : <Eye className="w-4 h-4 stroke-[2]" />}
          </button>
        </div>
        {passwordsMatch && !fieldErrors.confirmPassword && (
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
            Passwords match
          </p>
        )}
        {fieldErrors.confirmPassword && (
          <p id="reg-confirm-password-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.confirmPassword}</p>
        )}
      </div>

      {/* Terms and Privacy Checkbox */}
      <div>
        <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-600 dark:text-gray-300 select-none">
          <input
            id="reg-agree-terms"
            type="checkbox"
            checked={formData.agreeTerms}
            onChange={(e) => handleChange('agreeTerms', e.target.checked)}
            aria-invalid={Boolean(fieldErrors.agreeTerms)}
            aria-describedby={fieldErrors.agreeTerms ? 'reg-agree-terms-error' : undefined}
            className="tch-check mt-0.5 rounded border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-[#0D9488] focus:ring-[#0D9488]"
          />
          <span>
            I agree to the ToothCare Hub{' '}
            <a href="#terms" className="tch-tap text-[#0D9488] dark:text-teal-400 underline hover:text-[#0F766E] dark:hover:text-teal-300">Terms of Service</a>{' '}
            and{' '}
            <a href="#privacy" className="tch-tap text-[#0D9488] dark:text-teal-400 underline hover:text-[#0F766E] dark:hover:text-teal-300">Privacy Policy</a>.
          </span>
        </label>
        {fieldErrors.agreeTerms && (
          <p id="reg-agree-terms-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.agreeTerms}</p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] dark:bg-[#0F766E] dark:hover:bg-[#0D9488] active:bg-[#115E59] text-white font-semibold text-sm shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Creating account...</span>
          </>
        ) : (
          <span>Create Account</span>
        )}
      </button>

      {/* Link to Login */}
      <p className="text-center text-xs text-slate-600 dark:text-gray-400 pt-2">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onNavigateLogin}
          className="tch-tap font-semibold text-[#0D9488] dark:text-teal-400 hover:text-[#0F766E] dark:hover:text-teal-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded"
        >
          Sign in
        </button>
      </p>
    </form>
  );
}

export default RegisterForm;
