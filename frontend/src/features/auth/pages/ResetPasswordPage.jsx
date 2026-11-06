import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, Check, ArrowLeft, Lock, Shield } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { PASSWORD_RULES, validatePassword } from '../schemas/authSchema';

export function ResetPasswordPage({
  token: initialToken,
  onNavigateLogin,
  onNavigateForgotPassword,
  onNavigateHome,
}) {
  const { resetPassword } = useAuth();

  // Extract token from prop or URL query parameter
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const token = initialToken || (searchParams ? searchParams.get('token') : '') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const passwordAnalysis = validatePassword(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const errors = {};
    if (!token) {
      setFormError('Password reset token is missing. Please request a new reset link.');
      return;
    }

    if (!password) {
      errors.password = 'New password is required.';
    } else if (!passwordAnalysis.isValid) {
      errors.password = 'Password does not meet the security criteria.';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setIsLoading(true);
    const res = await resetPassword(token, password);
    setIsLoading(false);

    if (res.success) {
      setIsSuccess(true);
    } else {
      setFormError(res.error || 'Password reset failed. The link may have expired or is invalid.');
    }
  };

  return (
    <AuthLayout
      onNavigateHome={onNavigateHome}
      title="Create New Password"
      subtitle="Enter and confirm your new secure account password"
    >
      {isSuccess ? (
        <div className="text-center py-4 space-y-5 animate-in fade-in duration-300">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#CCFBF1] text-[#0D9488] flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-[#12304A]">Password Updated Successfully</h2>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
              Your password has been changed. You can now use your new password to sign in to your ToothCare Hub account.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onNavigateLogin}
              className="w-full py-3 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
            >
              Sign In Now
            </button>
          </div>
        </div>
      ) : !token ? (
        <div className="text-center py-4 space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#12304A]">Missing Reset Token</h2>
            <p className="mt-1 text-xs text-slate-600">
              No password reset token was detected in your link. Please request a fresh reset link below.
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateForgotPassword}
            className="w-full py-2.5 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
          >
            Request Reset Link
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Reset failed</p>
                <p className="text-xs text-rose-700 mt-0.5">{formError}</p>
              </div>
            </div>
          )}

          {/* New Password */}
          <div>
            <label htmlFor="reset-new-password" className="block text-xs font-bold text-[#12304A] mb-1.5">
              New password
            </label>
            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#E6F7F5] flex items-center justify-center text-[#0D9488] pointer-events-none">
                <Lock className="w-4 h-4 stroke-[2.2]" />
              </div>
              <input
                id="reset-new-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: null }));
                }}
                placeholder="At least 8 characters"
                aria-invalid={Boolean(fieldErrors.password)}
                className={`w-full pl-12 pr-11 py-2.5 rounded-xl border text-sm text-slate-800 placeholder:text-slate-400 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
                  fieldErrors.password ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 hover:border-slate-400'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded p-0.5"
              >
                {showPassword ? <EyeOff className="w-4 h-4 stroke-[2]" /> : <Eye className="w-4 h-4 stroke-[2]" />}
              </button>
            </div>

            {/* Password Strength Progress Bar & Requirements */}
            <div className="mt-2 space-y-1.5">
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
                        ? 'bg-emerald-600'
                        : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
              <p
                className={`text-[11px] text-justify leading-relaxed transition-colors ${
                  passwordAnalysis.isValid ? 'text-emerald-700 font-medium' : 'text-rose-500'
                }`}
              >
                Min. 8 characters, 1 lowercase, 1 uppercase and 1 number. ONLY the following special characters are allowed: !@#$%^&*
              </p>
            </div>
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-rose-600 font-medium">{fieldErrors.password}</p>
            )}
          </div>

          {/* Confirm New Password */}
          <div>
            <label htmlFor="reset-confirm-password" className="block text-xs font-bold text-[#12304A] mb-1.5">
              Confirm new password
            </label>
            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#E6F7F5] flex items-center justify-center text-[#0D9488] pointer-events-none">
                <Lock className="w-4 h-4 stroke-[2.2]" />
              </div>
              <input
                id="reset-confirm-password"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: null }));
                }}
                placeholder="Repeat new password"
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                className={`w-full pl-12 pr-11 py-2.5 rounded-xl border text-sm text-slate-800 placeholder:text-slate-400 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
                  fieldErrors.confirmPassword ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 hover:border-slate-400'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded p-0.5"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4 stroke-[2]" /> : <Eye className="w-4 h-4 stroke-[2]" />}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p className="mt-1 text-xs text-rose-600 font-medium">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] active:bg-[#115E59] text-white font-semibold text-sm shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Updating password...</span>
              </>
            ) : (
              <span>Reset Password</span>
            )}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={onNavigateLogin}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to sign in</span>
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

export default ResetPasswordPage;
