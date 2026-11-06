import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  PASSWORD_RULES,
  validatePassword,
  validateEmail,
  validatePhone,
  validateDateOfBirth,
} from '../schemas/authSchema';

export function RegisterForm({ onNavigateLogin, onSuccess }) {
  const { register, resendVerification, isLoading } = useAuth();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: 'PREFER_NOT_TO_SAY',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [registeredSuccessEmail, setRegisteredSuccessEmail] = useState(null);
  const [resendStatus, setResendStatus] = useState(null);

  const passwordAnalysis = validatePassword(formData.password);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: null }));
    }
    setFormError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const errors = {};
    if (!formData.firstName.trim()) errors.firstName = 'First name is required.';
    if (!formData.lastName.trim()) errors.lastName = 'Last name is required.';

    const emailErr = validateEmail(formData.email);
    if (emailErr) errors.email = emailErr;

    const phoneErr = validatePhone(formData.phone);
    if (phoneErr) errors.phone = phoneErr;

    const dobErr = validateDateOfBirth(formData.dateOfBirth);
    if (dobErr) errors.dateOfBirth = dobErr;

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
      return;
    }
    setFieldErrors({});

    const payload = {
      first_name: formData.firstName.trim(),
      last_name: formData.lastName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      date_of_birth: formData.dateOfBirth,
      gender: formData.gender,
      password: formData.password,
    };

    const res = await register(payload);
    if (res.success) {
      setRegisteredSuccessEmail(formData.email);
      onSuccess?.(res.data);
    } else {
      if (res.details && typeof res.details === 'object') {
        const mappedErrors = {};
        for (const [key, msg] of Object.entries(res.details)) {
          const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
          mappedErrors[camelKey] = msg;
        }
        setFieldErrors(mappedErrors);
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
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#CCFBF1] text-[#0D9488] flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-[#12304A]">Account Created Successfully</h2>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
            We sent a verification link to <strong className="text-slate-800">{registeredSuccessEmail}</strong>.
            Please verify your email address to confirm your account and book dental appointments.
          </p>
        </div>

        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={onNavigateLogin}
            className="w-full py-3 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
          >
            Sign In to Your Account
          </button>

          <div className="pt-2">
            {resendStatus === 'sent' ? (
              <p className="text-xs text-[#0D9488] font-medium">Verification link resent! Check your inbox.</p>
            ) : (
              <button
                type="button"
                disabled={resendStatus === 'loading'}
                onClick={handleResend}
                className="text-xs text-slate-500 hover:text-slate-800 transition-colors underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded"
              >
                {resendStatus === 'loading' ? 'Sending link...' : 'Didn\'t receive an email? Resend verification'}
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
          className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Registration failed</p>
            <p className="text-xs text-rose-700 mt-0.5">{formError}</p>
          </div>
        </div>
      )}

      {/* Name Fields (First & Last) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="reg-first-name" className="block text-xs font-semibold text-slate-700 mb-1">
            First name *
          </label>
          <input
            id="reg-first-name"
            name="firstName"
            type="text"
            required
            value={formData.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            placeholder="e.g. Maria"
            aria-invalid={Boolean(fieldErrors.firstName)}
            className={`w-full px-3 py-2 rounded-xl border text-sm text-slate-800 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
              fieldErrors.firstName ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 hover:border-slate-400'
            }`}
          />
          {fieldErrors.firstName && (
            <p className="mt-1 text-xs text-rose-600 font-medium">{fieldErrors.firstName}</p>
          )}
        </div>

        <div>
          <label htmlFor="reg-last-name" className="block text-xs font-semibold text-slate-700 mb-1">
            Last name *
          </label>
          <input
            id="reg-last-name"
            name="lastName"
            type="text"
            required
            value={formData.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            placeholder="e.g. Santos"
            aria-invalid={Boolean(fieldErrors.lastName)}
            className={`w-full px-3 py-2 rounded-xl border text-sm text-slate-800 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
              fieldErrors.lastName ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 hover:border-slate-400'
            }`}
          />
          {fieldErrors.lastName && (
            <p className="mt-1 text-xs text-rose-600 font-medium">{fieldErrors.lastName}</p>
          )}
        </div>
      </div>

      {/* Email Address */}
      <div>
        <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 mb-1">
          Email address *
        </label>
        <input
          id="reg-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="maria.santos@example.com"
          aria-invalid={Boolean(fieldErrors.email)}
          className={`w-full px-3 py-2 rounded-xl border text-sm text-slate-800 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
            fieldErrors.email ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 hover:border-slate-400'
          }`}
        />
        {fieldErrors.email && (
          <p className="mt-1 text-xs text-rose-600 font-medium">{fieldErrors.email}</p>
        )}
      </div>

      {/* Phone Number */}
      <div>
        <label htmlFor="reg-phone" className="block text-xs font-semibold text-slate-700 mb-1">
          Phone number *
        </label>
        <input
          id="reg-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          placeholder="+63 917 123 4567"
          aria-invalid={Boolean(fieldErrors.phone)}
          className={`w-full px-3 py-2 rounded-xl border text-sm text-slate-800 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
            fieldErrors.phone ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 hover:border-slate-400'
          }`}
        />
        {fieldErrors.phone && (
          <p className="mt-1 text-xs text-rose-600 font-medium">{fieldErrors.phone}</p>
        )}
      </div>

      {/* DOB and Gender */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="reg-dob" className="block text-xs font-semibold text-slate-700 mb-1">
            Date of birth *
          </label>
          <input
            id="reg-dob"
            name="dateOfBirth"
            type="date"
            required
            value={formData.dateOfBirth}
            onChange={(e) => handleChange('dateOfBirth', e.target.value)}
            aria-invalid={Boolean(fieldErrors.dateOfBirth)}
            className={`w-full px-3 py-2 rounded-xl border text-sm text-slate-800 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
              fieldErrors.dateOfBirth ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 hover:border-slate-400'
            }`}
          />
          {fieldErrors.dateOfBirth && (
            <p className="mt-1 text-xs text-rose-600 font-medium">{fieldErrors.dateOfBirth}</p>
          )}
        </div>

        <div>
          <label htmlFor="reg-gender" className="block text-xs font-semibold text-slate-700 mb-1">
            Gender
          </label>
          <select
            id="reg-gender"
            name="gender"
            value={formData.gender}
            onChange={(e) => handleChange('gender', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
          >
            <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      {/* Password Fields */}
      <div>
        <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700 mb-1">
          Password *
        </label>
        <div className="relative">
          <input
            id="reg-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            placeholder="At least 12 characters"
            aria-invalid={Boolean(fieldErrors.password)}
            className={`w-full pl-3 pr-10 py-2 rounded-xl border text-sm text-slate-800 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
              fieldErrors.password ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 hover:border-slate-400'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Live Password Strength Checklist */}
        <div className="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
          <p className="text-[11px] font-semibold text-slate-600 mb-1">Password security requirements:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
            {PASSWORD_RULES.map((rule) => {
              const passed = rule.test(formData.password);
              return (
                <div key={rule.id} className="flex items-center gap-1.5">
                  {passed ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className={passed ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                    {rule.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Confirm Password */}
      <div>
        <label htmlFor="reg-confirm-password" className="block text-xs font-semibold text-slate-700 mb-1">
          Confirm password *
        </label>
        <div className="relative">
          <input
            id="reg-confirm-password"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={formData.confirmPassword}
            onChange={(e) => handleChange('confirmPassword', e.target.value)}
            placeholder="Repeat your password"
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            className={`w-full pl-3 pr-10 py-2 rounded-xl border text-sm text-slate-800 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
              fieldErrors.confirmPassword ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 hover:border-slate-400'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded"
          >
            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {fieldErrors.confirmPassword && (
          <p className="mt-1 text-xs text-rose-600 font-medium">{fieldErrors.confirmPassword}</p>
        )}
      </div>

      {/* Terms and Privacy Checkbox */}
      <div>
        <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-600 select-none">
          <input
            type="checkbox"
            checked={formData.agreeTerms}
            onChange={(e) => handleChange('agreeTerms', e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#0D9488] focus:ring-[#0D9488]"
          />
          <span>
            I agree to the ToothCare Hub{' '}
            <a href="#terms" className="text-[#0D9488] underline hover:text-[#0F766E]">Terms of Service</a>{' '}
            and{' '}
            <a href="#privacy" className="text-[#0D9488] underline hover:text-[#0F766E]">Privacy Policy</a>.
          </span>
        </label>
        {fieldErrors.agreeTerms && (
          <p className="mt-1 text-xs text-rose-600 font-medium">{fieldErrors.agreeTerms}</p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] active:bg-[#115E59] text-white font-semibold text-sm shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
      <p className="text-center text-xs text-slate-600 pt-2">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onNavigateLogin}
          className="font-semibold text-[#0D9488] hover:text-[#0F766E] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded"
        >
          Sign in
        </button>
      </p>
    </form>
  );
}

export default RegisterForm;
