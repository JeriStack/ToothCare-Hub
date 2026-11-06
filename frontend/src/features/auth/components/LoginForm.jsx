import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, Loader2, Mail, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { validateEmail } from '../schemas/authSchema';

export function LoginForm({
  onSuccess,
  onNavigateRegister,
  onNavigateForgotPassword,
}) {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const errors = {};
    const emailErr = validateEmail(email);
    if (emailErr) errors.email = emailErr;
    if (!password) errors.password = 'Password is required.';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    const res = await login({ email, password });
    if (res.success) {
      onSuccess?.(res.user);
    } else {
      setFormError(res.error || 'Invalid email or password. Please verify your credentials.');
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Top Error Alert */}
      {formError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Sign in failed</p>
            <p className="text-xs text-rose-700 mt-0.5">{formError}</p>
          </div>
        </div>
      )}

      {/* Email Input */}
      <div>
        <label
          htmlFor="login-email"
          className="block text-xs font-bold text-[#12304A] mb-1.5"
        >
          Email address
        </label>
        <div className="relative">
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#E6F7F5] flex items-center justify-center text-[#0D9488] pointer-events-none">
            <Mail className="w-4 h-4 stroke-[2.2]" />
          </div>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: null }));
            }}
            placeholder="youremail@example.com"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
            className={`w-full pl-12 pr-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder:text-slate-400 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
              fieldErrors.email ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 hover:border-slate-400'
            }`}
          />
        </div>
        {fieldErrors.email && (
          <p id="login-email-error" className="mt-1 text-xs text-rose-600 font-medium">
            {fieldErrors.email}
          </p>
        )}
      </div>

      {/* Password Input */}
      <div>
        <label
          htmlFor="login-password"
          className="block text-xs font-bold text-[#12304A] mb-1.5"
        >
          Password
        </label>
        <div className="relative">
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#E6F7F5] flex items-center justify-center text-[#0D9488] pointer-events-none">
            <Lock className="w-4 h-4 stroke-[2.2]" />
          </div>
          <input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: null }));
            }}
            placeholder="Enter your password"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
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
        {fieldErrors.password && (
          <p id="login-password-error" className="mt-1 text-xs text-rose-600 font-medium">
            {fieldErrors.password}
          </p>
        )}
      </div>

      {/* Remember Me and Forgot Password Row */}
      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 select-none font-medium">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-[#0D9488] focus:ring-[#0D9488]"
          />
          <span>Remember me</span>
        </label>
        <button
          type="button"
          onClick={onNavigateForgotPassword}
          className="text-sm font-semibold text-[#0D9488] hover:text-[#0F766E] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded"
        >
          Forgot password?
        </button>
      </div>

      {/* Primary Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full mt-2 py-3 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] active:bg-[#115E59] text-white font-semibold text-sm shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Signing in...</span>
          </>
        ) : (
          <span>Sign In</span>
        )}
      </button>

      {/* Link to Register */}
      <p className="text-center text-xs text-slate-600 pt-2">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={onNavigateRegister}
          className="font-semibold text-[#0D9488] hover:text-[#0F766E] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded"
        >
          Create an account
        </button>
      </p>
    </form>
  );
}

export default LoginForm;
